import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument } from "@cantoo/pdf-lib";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface ICropJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    pages?: number[];
  };
}

export interface ICropJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    outputSize: number;
  };
}

export class CropProcessor {
  async process(params: ICropJobParams): Promise<ICropJobResult> {
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
      logger.info(`[JOB] Processing ${jobId}: Cropping PDF margins`, "JOB");

      const inputBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const pageCount = pdfDoc.getPageCount();

      const cropTop = Math.max(0, options?.top || 0);
      const cropBottom = Math.max(0, options?.bottom || 0);
      const cropLeft = Math.max(0, options?.left || 0);
      const cropRight = Math.max(0, options?.right || 0);

      const targetPages = options?.pages && Array.isArray(options.pages)
        ? new Set(options.pages)
        : null;

      for (let i = 0; i < pageCount; i++) {
        const pageNum = i + 1;
        if (targetPages && !targetPages.has(pageNum)) continue;

        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();

        const newX = cropLeft;
        const newY = cropBottom;
        const newWidth = Math.max(50, width - cropLeft - cropRight);
        const newHeight = Math.max(50, height - cropTop - cropBottom);

        page.setCropBox(newX, newY, newWidth, newHeight);
      }

      const pdfBytes = await pdfDoc.save();
      await fs.promises.writeFile(physicalOutputPath, pdfBytes);

      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
      const outputName = `${baseName}_cropped.pdf`;
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

export const cropProcessor = new CropProcessor();
