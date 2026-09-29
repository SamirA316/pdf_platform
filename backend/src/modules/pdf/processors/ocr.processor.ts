import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createWorker } from "tesseract.js";
import { PDFDocument } from "@cantoo/pdf-lib";
import puppeteer from "puppeteer";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IOcrJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  tool: "ocr-pdf" | "scan-text";
  options?: {
    language?: string;
  };
}

export interface IOcrJobResult {
  outputFileId: string;
  metrics: {
    wordsRecognized: number;
    outputSize: number;
  };
}

export class OcrProcessor {
  async process(params: IOcrJobParams): Promise<IOcrJobResult> {
    const { jobId, userId, inputFileId, tool, options } = params;

    if (!inputFileId) throw new ProcessingFailedError("Input file ID is required.");

    const dbFile = await prisma.file.findFirst({
      where: { id: inputFileId, userId },
    });
    if (!dbFile) throw new FileNotFoundError(`Input file ID '${inputFileId}' not found.`);

    const uploadBase = storageService.getStorageRoot();
    const physicalPath = path.resolve(uploadBase, dbFile.storageKey);
    if (!fs.existsSync(physicalPath)) {
      throw new FileNotFoundError(`Physical input file not found on disk.`);
    }

    const userDir = storageService.getUserStorageDir(userId);
    const randomHex = crypto.randomBytes(8).toString("hex");
    const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
    let physicalOutputPath = "";

    let browser;
    let worker;

    try {
      logger.info(`[JOB] Processing ${jobId}: Running OCR (${tool}) on '${dbFile.originalName}'`, "JOB");

      const isPdf = dbFile.originalName.toLowerCase().endsWith(".pdf");
      const renderedImages: Buffer[] = [];

      if (isPdf) {
        // Render PDF pages to images using Puppeteer and PDF.js
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

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          await page.evaluate(async (num) => {
            const p = await (window as any)._pdfDoc.getPage(num);
            const viewport = p.getViewport({ scale: 2.0 }); // High resolution for OCR
            const canvas = (window as any).document.getElementById("render-canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await p.render({ canvasContext: ctx, viewport }).promise;
          }, pageNum);

          const buf = (await canvasHandle.screenshot({ type: "png" })) as Buffer;
          renderedImages.push(buf);
        }

        await browser.close();
        browser = undefined;
      } else {
        // Direct image input
        const imgBuffer = await fs.promises.readFile(physicalPath);
        renderedImages.push(imgBuffer);
      }

      const lang = options?.language || "eng";
      worker = await createWorker(lang);

      let fullText = "";
      let outputBuffer: Buffer;
      let outputFilename = "";
      let outputMime = "";

      if (tool === "scan-text") {
        for (const imgBuffer of renderedImages) {
          const { data } = await worker.recognize(imgBuffer);
          fullText += data.text + "\n\n";
        }

        outputFilename = `${baseName}_extracted.txt`;
        outputMime = "text/plain";
        physicalOutputPath = path.join(userDir, `file_${randomHex}.txt`);
        
        if (!fullText.trim()) {
            fullText = "No readable text detected in this document.";
        }
        outputBuffer = Buffer.from(fullText.trim(), "utf-8");
      } else {
        // ocr-pdf
        const finalPdfDoc = await PDFDocument.create();

        for (const imgBuffer of renderedImages) {
          const { data } = await worker.recognize(imgBuffer, { pdfTitle: baseName }, { pdf: true });
          fullText += data.text + "\n\n";
          
          if (data.pdf) {
            const pdfPageDoc = await PDFDocument.load(Buffer.from(data.pdf));
            const copiedPages = await finalPdfDoc.copyPages(pdfPageDoc, pdfPageDoc.getPageIndices());
            for (const copiedPage of copiedPages) {
              finalPdfDoc.addPage(copiedPage);
            }
          } else {
            // Fallback if tesseract fails to generate PDF for some reason
            throw new ProcessingFailedError("Tesseract failed to generate searchable PDF layer.");
          }
        }

        outputFilename = `${baseName}_searchable.pdf`;
        outputMime = "application/pdf";
        physicalOutputPath = path.join(userDir, `file_${randomHex}.pdf`);
        outputBuffer = Buffer.from(await finalPdfDoc.save());
      }

      await worker.terminate();
      worker = undefined;

      await fs.promises.writeFile(physicalOutputPath, outputBuffer);

      const storageKey = `users/${userId}/${path.basename(physicalOutputPath)}`;
      const outputFile = await filesService.createFile(
        userId,
        outputFilename,
        storageKey,
        outputMime,
        outputBuffer.length,
        jobId
      );

      const wordsCount = fullText.split(/\s+/).filter(Boolean).length;

      return {
        outputFileId: outputFile.id,
        metrics: {
          wordsRecognized: wordsCount,
          outputSize: outputBuffer.length,
        },
      };
    } catch (err: any) {
      if (browser) await browser.close().catch(() => {});
      if (worker) await worker.terminate().catch(() => {});
      if (physicalOutputPath && fs.existsSync(physicalOutputPath)) {
        try { await fs.promises.unlink(physicalOutputPath); } catch {}
      }
      throw err;
    }
  }
}

export const ocrProcessor = new OcrProcessor();
