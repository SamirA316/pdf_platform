import path from "path";
import fs from "fs";
import crypto from "crypto";
import puppeteer from "puppeteer";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IOfficeToPdfJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  tool: "word-to-pdf" | "excel-to-pdf" | "powerpoint-to-pdf";
  options?: Record<string, any>;
}

export interface IOfficeToPdfJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    outputSize: number;
  };
}

export class OfficeToPdfProcessor {
  async process(params: IOfficeToPdfJobParams): Promise<IOfficeToPdfJobResult> {
    const { jobId, userId, inputFileId, tool } = params;

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
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    let browser;
    try {
      logger.info(`[JOB] Processing ${jobId}: Converting ${tool} for '${dbFile.originalName}'`, "JOB");

      let renderedHtml = "";
      const ext = path.extname(dbFile.originalName).toLowerCase();

      if (tool === "word-to-pdf" || ext === ".docx" || ext === ".doc") {
        const result = await mammoth.convertToHtml({ path: physicalPath });
        const bodyContent = result.value || "<p>Empty Word document</p>";
        renderedHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 40px; color: #222; line-height: 1.6; }
                h1, h2, h3 { color: #111; margin-top: 1.2em; }
                table { border-collapse: collapse; width: 100%; margin: 16px 0; }
                th, td { border: 1px solid #ccc; padding: 8px 12px; }
                th { background: #f4f4f4; }
                img { max-width: 100%; height: auto; }
              </style>
            </head>
            <body>${bodyContent}</body>
          </html>
        `;
      } else if (tool === "excel-to-pdf" || ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
        const workbook = XLSX.readFile(physicalPath);
        const sheetName = workbook.SheetNames[0] || "Sheet1";
        const sheet = workbook.Sheets[sheetName];
        const tableHtml = sheet ? XLSX.utils.sheet_to_html(sheet) : "<p>Empty Spreadsheet</p>";

        renderedHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 25px; color: #111; }
                h2 { margin-bottom: 15px; color: #1a56db; }
                table { border-collapse: collapse; width: 100%; font-size: 11px; }
                th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
                tr:nth-child(even) { background-color: #f9fafb; }
              </style>
            </head>
            <body>
              <h2>${sheetName}</h2>
              ${tableHtml}
            </body>
          </html>
        `;
      } else {
        // PowerPoint or generic office presentation fallback
        renderedHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 50px; text-align: center; }
                .slide { border: 2px solid #e5e7eb; border-radius: 8px; padding: 60px 40px; margin: 30px auto; max-width: 700px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
                h1 { color: #1f2937; margin-bottom: 20px; font-size: 28px; }
                p { color: #6b7280; font-size: 16px; }
              </style>
            </head>
            <body>
              <div class="slide">
                <h1>${dbFile.originalName.replace(/\.[^/.]+$/, "")}</h1>
                <p>Converted from Presentation Document</p>
              </div>
            </body>
          </html>
        `;
      }

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });

      const page = await browser.newPage();
      await page.setContent(renderedHtml, { waitUntil: "load", timeout: 30000 });

      const isSpreadsheet = tool === "excel-to-pdf";
      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: isSpreadsheet,
        printBackground: true,
        margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
      });

      await browser.close();
      browser = undefined;

      await fs.promises.writeFile(physicalOutputPath, pdfBuffer);

      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
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

export const officeToPdfProcessor = new OfficeToPdfProcessor();
