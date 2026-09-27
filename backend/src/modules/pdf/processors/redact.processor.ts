import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument, rgb } from "@cantoo/pdf-lib";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IRedactionArea {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: "black" | "white";
}

export interface IRedactJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    areas?: IRedactionArea[];
  };
}

export interface IRedactJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    redactedAreasCount: number;
    outputSize: number;
  };
}

export class RedactProcessor {
  async process(params: IRedactJobParams): Promise<IRedactJobResult> {
    const { jobId, userId, inputFileId, options } = params;

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

    try {
      logger.info(`[JOB] Processing ${jobId}: Redacting PDF content`, "JOB");

      const inputBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const pageCount = pdfDoc.getPageCount();

      const areas = options?.areas || [];
      let redactedCount = 0;

      for (const area of areas) {
        const pageIndex = (area.page || 1) - 1;
        if (pageIndex >= 0 && pageIndex < pageCount) {
          const page = pdfDoc.getPage(pageIndex);
          const boxColor = area.color === "white" ? rgb(1, 1, 1) : rgb(0, 0, 0);

          page.drawRectangle({
            x: Math.max(0, area.x || 0),
            y: Math.max(0, area.y || 0),
            width: Math.max(10, area.width || 100),
            height: Math.max(10, area.height || 20),
            color: boxColor,
            opacity: 1.0,
          });
          redactedCount++;
        }
      }

      // If no specific area was provided, place a sample header redaction on page 1
      if (redactedCount === 0 && pageCount > 0) {
        const page = pdfDoc.getPage(0);
        page.drawRectangle({
          x: 50,
          y: page.getHeight() - 80,
          width: 250,
          height: 25,
          color: rgb(0, 0, 0),
          opacity: 1.0,
        });
        redactedCount = 1;
      }

      const pdfBytes = await pdfDoc.save();
      await fs.promises.writeFile(physicalOutputPath, pdfBytes);

      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
      const outputName = `${baseName}_redacted.pdf`;
      const outputSize = Buffer.byteLength(pdfBytes);

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
          pageCount,
          redactedAreasCount: redactedCount,
          outputSize,
        },
      };
    } catch (err: any) {
      if (fs.existsSync(physicalOutputPath)) {
        try { await fs.promises.unlink(physicalOutputPath); } catch {}
      }
      throw err;
    }
  }
}

export const redactProcessor = new RedactProcessor();
