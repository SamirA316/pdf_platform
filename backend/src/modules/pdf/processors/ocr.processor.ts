import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createWorker } from "tesseract.js";
import { PDFDocument, rgb, StandardFonts } from "@cantoo/pdf-lib";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";
import { extractPdfText } from "../utils/pdf-text-extractor";

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

    try {
      logger.info(`[JOB] Processing ${jobId}: Running OCR (${tool}) on '${dbFile.originalName}'`, "JOB");

      let recognizedText = "";
      const isPdf = dbFile.originalName.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        // Fast PDF text parse first
        const parsed = await extractPdfText(physicalPath);
        recognizedText = (parsed.text || "").trim();
      }

      // If text is minimal or it's an image, run Tesseract OCR
      if (!recognizedText || recognizedText.length < 50) {
        try {
          const lang = options?.language || "eng";
          const worker = await createWorker(lang);
          const ret = await worker.recognize(physicalPath);
          recognizedText = ret.data.text;
          await worker.terminate();
        } catch {
          logger.warn(`[OCR] Tesseract fallback failed, using available text.`, "JOB");
        }
      }

      if (!recognizedText) {
        recognizedText = "No readable text detected in this document.";
      }

      let outputFilename = "";
      let outputMime = "";
      let physicalOutputPath = "";
      let outputBuffer: Buffer;

      if (tool === "scan-text") {
        outputFilename = `${baseName}_extracted.txt`;
        outputMime = "text/plain";
        physicalOutputPath = path.join(userDir, `file_${randomHex}.txt`);
        outputBuffer = Buffer.from(recognizedText, "utf-8");
      } else {
        // ocr-pdf -> Embed OCR text layer into a clean searchable PDF
        outputFilename = `${baseName}_searchable.pdf`;
        outputMime = "application/pdf";
        physicalOutputPath = path.join(userDir, `file_${randomHex}.pdf`);

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.addPage([595.28, 841.89]);
        const { height } = page.getSize();

        // Draw recognized text lines
        const lines = recognizedText.split("\n").filter(Boolean);
        let curY = height - 50;

        for (let i = 0; i < lines.length && curY > 50; i++) {
          const line = lines[i]!.substring(0, 90);
          page.drawText(line, {
            x: 50,
            y: curY,
            size: 10,
            font,
            color: rgb(0.1, 0.1, 0.1),
          });
          curY -= 14;
        }

        outputBuffer = Buffer.from(await pdfDoc.save());
      }

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

      const wordsCount = recognizedText.split(/\s+/).filter(Boolean).length;

      return {
        outputFileId: outputFile.id,
        metrics: {
          wordsRecognized: wordsCount,
          outputSize: outputBuffer.length,
        },
      };
    } catch (err: any) {
      throw err;
    }
  }
}

export const ocrProcessor = new OcrProcessor();
