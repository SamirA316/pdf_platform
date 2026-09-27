import path from "path";
import fs from "fs";
import crypto from "crypto";
import puppeteer from "puppeteer";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IHtmlToPdfJobParams {
  jobId: string;
  userId: string;
  inputFileId?: string | undefined;
  options?: {
    url?: string;
    html?: string;
    format?: "A4" | "Letter" | "Legal";
    landscape?: boolean;
    printBackground?: boolean;
  };
}

export interface IHtmlToPdfJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    outputSize: number;
  };
}

export class HtmlToPdfProcessor {
  async process(params: IHtmlToPdfJobParams): Promise<IHtmlToPdfJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    let targetUrl = options?.url ? String(options.url).trim() : undefined;
    let htmlContent = options?.html ? String(options.html).trim() : undefined;
    let baseName = "webpage";

    if (inputFileId) {
      const dbFile = await prisma.file.findFirst({
        where: { id: inputFileId, userId },
      });
      if (dbFile) {
        const uploadBase = storageService.getStorageRoot();
        const physicalPath = path.resolve(uploadBase, dbFile.storageKey);
        if (fs.existsSync(physicalPath)) {
          htmlContent = await fs.promises.readFile(physicalPath, "utf-8");
          baseName = dbFile.originalName.replace(/\.[^/.]+$/, "");
        }
      }
    }

    if (!targetUrl && !htmlContent) {
      throw new ProcessingFailedError("Either an HTML file, raw HTML content, or website URL is required.");
    }

    const userDir = storageService.getUserStorageDir(userId);
    const randomHex = crypto.randomBytes(8).toString("hex");
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    let browser;
    try {
      logger.info(`[JOB] Processing ${jobId}: Converting HTML/Web to PDF`, "JOB");

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });

      const page = await browser.newPage();

      if (targetUrl) {
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
          targetUrl = "https://" + targetUrl;
        }
        await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 30000 });
        try {
          const parsed = new URL(targetUrl);
          baseName = parsed.hostname.replace(/[^a-zA-Z0-9.-]/g, "_");
        } catch {}
      } else if (htmlContent) {
        await page.setContent(htmlContent, { waitUntil: "load", timeout: 30000 });
      }

      const pdfBuffer = await page.pdf({
        format: (options?.format as any) || "A4",
        landscape: Boolean(options?.landscape),
        printBackground: options?.printBackground !== false,
        margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
      });

      await browser.close();
      browser = undefined;

      await fs.promises.writeFile(physicalOutputPath, pdfBuffer);

      const outputName = `${baseName}.pdf`;
      const outputSize = pdfBuffer.length;

      const outputFile = await filesService.createFile(
        userId,
        outputName,
        storageKey,
        "application/pdf",
        outputSize,
        jobId
      );

      return {
        outputFileId: outputFile.id,
        metrics: {
          pageCount: 1,
          outputSize,
        },
      };
    } catch (err: any) {
      if (browser) await browser.close().catch(() => {});
      if (fs.existsSync(physicalOutputPath)) {
        try { await fs.promises.unlink(physicalOutputPath); } catch {}
      }
      throw err;
    }
  }
}

export const htmlToPdfProcessor = new HtmlToPdfProcessor();
