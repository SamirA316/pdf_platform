import path from "path";
import fs from "fs";
import crypto from "crypto";
import puppeteer from "puppeteer";
import JSZip from "jszip";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IPdfToImageJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    format?: "jpg" | "png";
    dpi?: number;
    pages?: number[];
  };
}

export interface IPdfToImageJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    format: string;
    outputSize: number;
  };
}

export class PdfToImageProcessor {
  async process(params: IPdfToImageJobParams): Promise<IPdfToImageJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required.");
    }

    const dbFile = await prisma.file.findFirst({
      where: { id: inputFileId, userId },
    });

    if (!dbFile) throw new FileNotFoundError(`Input file ID '${inputFileId}' not found.`);
    if (dbFile.status !== "READY") throw new ProcessingFailedError(`Input file is not ready.`);

    const uploadBase = storageService.getStorageRoot();
    const physicalPath = path.resolve(uploadBase, dbFile.storageKey);
    if (!fs.existsSync(physicalPath)) {
      throw new FileNotFoundError(`Physical input file not found on disk.`);
    }

    const isPng = options?.format === "png";
    const ext = isPng ? "png" : "jpg";
    const mimeType = isPng ? "image/png" : "image/jpeg";

    const userDir = storageService.getUserStorageDir(userId);
    const randomHex = crypto.randomBytes(8).toString("hex");
    let physicalOutputPath = "";
    
    let browser;
    try {
      logger.info(`[JOB] Processing ${jobId}: Converting PDF to ${ext.toUpperCase()}`, "JOB");

      const pdfBuffer = await fs.promises.readFile(physicalPath);
      const pdfBase64 = pdfBuffer.toString("base64");

      browser = await puppeteer.launch({
        headless: true,
        args: ["--disable-dev-shm-usage"],
      });

      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url() === 'http://localhost/') {
          request.respond({
            status: 200,
            contentType: 'text/html',
            body: `<!DOCTYPE html>
        <html>
          <body style="margin:0; padding:0; background:white;">
            <canvas id="render-canvas"></canvas>
            <script type="module">
              import * as pdfjsLib from 'http://localhost/pdf.mjs';
              pdfjsLib.GlobalWorkerOptions.workerSrc = 'http://localhost/pdf.worker.mjs';
              window.pdfjsLib = pdfjsLib;
            </script>
          </body>
        </html>`
          });
        } else if (request.url().endsWith('pdf.mjs')) {
          request.respond({
            status: 200,
            contentType: 'application/javascript',
            body: fs.readFileSync(require.resolve('pdfjs-dist/build/pdf.min.mjs'))
          });
        } else if (request.url().endsWith('pdf.worker.mjs')) {
          request.respond({
            status: 200,
            contentType: 'application/javascript',
            body: fs.readFileSync(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'))
          });
        } else {
          request.continue();
        }
      });
      await page.goto(`http://localhost/`, { waitUntil: 'networkidle0' });
      await page.waitForFunction('window.pdfjsLib !== undefined');

      const totalPages = await page.evaluate(async (dataB64) => {
        const raw = atob(dataB64);
        const uint8 = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);
        const pdf = await (window as any).pdfjsLib.getDocument({ data: uint8 }).promise;
        (window as any)._pdfDoc = pdf;
        return pdf.numPages;
      }, pdfBase64);

      if (totalPages === 0) {
        throw new ProcessingFailedError("PDF contains 0 pages.");
      }

      const canvasHandle = await page.$("#render-canvas");
      if (!canvasHandle) throw new ProcessingFailedError("Failed to initialize canvas renderer.");

      const renderedImages: { filename: string; buffer: Buffer }[] = [];
      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        await page.evaluate(async (num) => {
          const p = await (window as any)._pdfDoc.getPage(num);
          const viewport = p.getViewport({ scale: 2.0 });
          const canvas = (window as any).document.getElementById("render-canvas") as HTMLCanvasElement;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await p.render({ canvasContext: ctx, viewport }).promise;
        }, pageNum);

        const screenshotOpts = isPng
          ? ({ type: "png" as const })
          : ({ type: "jpeg" as const, quality: 92 });
        const buf = (await canvasHandle.screenshot(screenshotOpts)) as Buffer;

        renderedImages.push({
          filename: `${baseName}_page_${pageNum}.${ext}`,
          buffer: buf,
        });
      }

      await browser.close();
      browser = undefined;

      let finalBuffer: Buffer;
      let finalFilename: string;
      let finalMimeType: string;

      if (renderedImages.length === 1) {
        // Single page -> direct image output
        finalBuffer = renderedImages[0]!.buffer;
        finalFilename = `${baseName}.${ext}`;
        finalMimeType = mimeType;
      } else {
        // Multiple pages -> Zip archive
        const zip = new JSZip();
        for (const img of renderedImages) {
          zip.file(img.filename, img.buffer);
        }
        finalBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
        finalFilename = `${baseName}_images.zip`;
        finalMimeType = "application/zip";
      }

      const outExt = path.extname(finalFilename);
      const diskFilename = `file_${randomHex}${outExt}`;
      physicalOutputPath = path.join(userDir, diskFilename);
      const storageKey = `users/${userId}/${diskFilename}`;

      await fs.promises.writeFile(physicalOutputPath, finalBuffer);

      const outputFile = await filesService.createFile(
        userId,
        finalFilename,
        storageKey,
        finalMimeType,
        finalBuffer.length,
        jobId
      );

      return {
        outputFileId: outputFile.id,
        metrics: {
          pageCount: totalPages,
          format: ext,
          outputSize: finalBuffer.length,
        },
      };
    } catch (err: any) {
      if (browser) await browser.close().catch(() => {});
      if (physicalOutputPath && fs.existsSync(physicalOutputPath)) {
        try { await fs.promises.unlink(physicalOutputPath); } catch {}
      }
      throw err;
    }
  }
}

export const pdfToImageProcessor = new PdfToImageProcessor();
