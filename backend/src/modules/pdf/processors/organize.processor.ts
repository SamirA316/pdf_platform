import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument, degrees } from "pdf-lib";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IOrganizeJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    pages?: Array<{ sourcePage: number; rotation?: number }>;
  };
}

export interface IOrganizeJobResult {
  outputFileId: string;
  metrics: {
    inputPages: number;
    outputPages: number;
    outputSize: number;
  };
}

export class OrganizeProcessor {
  /**
   * Reorders, deletes, extracts, duplicates, and rotates pages of a PDF based on user specifications.
   */
  async process(params: IOrganizeJobParams): Promise<IOrganizeJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required to organize PDF.");
    }

    const pages = options?.pages || [];
    if (pages.length === 0) {
      throw new ProcessingFailedError("At least one page is required in organize specification.");
    }

    // 1. Resolve input file from database
    const dbFile = await prisma.file.findFirst({
      where: {
        id: inputFileId,
        userId,
      },
    });

    if (!dbFile) {
      throw new FileNotFoundError(`Input file ID '${inputFileId}' not found.`);
    }

    if (dbFile.status !== "READY") {
      throw new ProcessingFailedError(`Input file '${dbFile.originalName}' is not ready for processing.`);
    }

    // 2. Resolve safe physical path
    const uploadBase = storageService.getStorageRoot();
    const physicalPath = path.resolve(uploadBase, dbFile.storageKey);
    const relativePath = path.relative(uploadBase, physicalPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new ProcessingFailedError("Invalid input file path security violation.");
    }

    if (!fs.existsSync(physicalPath)) {
      throw new FileNotFoundError(`Physical input PDF '${dbFile.originalName}' does not exist on disk.`);
    }

    // 3. Prepare user output directory
    const userDir = storageService.getUserStorageDir(userId);

    const randomHex = crypto.randomBytes(8).toString("hex");
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    try {
      logger.info(
        `[JOB] Processing ${jobId}: Organizing file '${dbFile.originalName}' (${pages.length} target pages)`,
        "JOB"
      );

      const inputBytes = await fs.promises.readFile(physicalPath);
      const srcDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const totalPages = srcDoc.getPageCount();

      if (totalPages === 0) {
        throw new ProcessingFailedError("Cannot organize a PDF with 0 pages.");
      }

      const outDoc = await PDFDocument.create();

      for (const item of pages) {
        const sourceIndex = item.sourcePage - 1;
        const [copiedPage] = await outDoc.copyPages(srcDoc, [sourceIndex]);

        if (!copiedPage) {
          throw new Error(`Failed to copy page ${item.sourcePage}`);
        }

        if (item.rotation !== undefined && item.rotation > 0) {
          const currentAngle = copiedPage.getRotation().angle;
          const newAngle = (currentAngle + item.rotation) % 360;
          copiedPage.setRotation(degrees(newAngle));
        }

        outDoc.addPage(copiedPage);
      }

      const organizedPdfBytes = await outDoc.save({ useObjectStreams: false });
      await fs.promises.writeFile(physicalOutputPath, organizedPdfBytes);

      if (!fs.existsSync(physicalOutputPath) || fs.statSync(physicalOutputPath).size === 0) {
        throw new Error("Organize resulted in an empty or missing output file.");
      }

      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
      const outputName = `${baseName}_organized.pdf`;
      const outputSize = Buffer.byteLength(organizedPdfBytes);

      // Record output File in database with atomic quota enforcement
      const outputFile = await filesService.createFile(
        userId,
        outputName,
        storageKey,
        "application/pdf",
        outputSize,
        jobId
      );

      logger.info(
        `[JOB] Completed ${jobId}: Created organized output file ${outputFile.id} (${pages.length} pages, ${outputSize} bytes)`,
        "JOB"
      );

      return {
        outputFileId: outputFile.id,
        metrics: {
          inputPages: totalPages,
          outputPages: pages.length,
          outputSize,
        },
      };
    } catch (err: any) {
      logger.error(`PDF job ${jobId} failed.`, "JOB");

      // Clean up orphaned partial output file on disk
      if (fs.existsSync(physicalOutputPath)) {
        try {
          await fs.promises.unlink(physicalOutputPath);
        } catch {
          logger.warn("[JOB] Failed to clean up partial organized output file.", "JOB");
        }
      }

      if (err.code === "STORAGE_QUOTA_EXCEEDED" || err.code === "PAYLOAD_TOO_LARGE") {
        throw err;
      }

      throw new ProcessingFailedError("We couldn't organize this PDF. Please try again.");
    }
  }
}

export const organizeProcessor = new OrganizeProcessor();
