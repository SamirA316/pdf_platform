import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IEditJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: any;
}

export interface IEditJobResult {
  outputFileId: string;
  metrics: {
    totalPages: number;
    outputSize: number;
  };
}

export class EditProcessor {
  /**
   * Validates the uploaded edited PDF and creates an output file for the job.
   * Note: Actual editing happens on the frontend via pdf-lib. This backend
   * processor simply validates and stores the final result.
   */
  async process(params: IEditJobParams): Promise<IEditJobResult> {
    const { jobId, userId, inputFileId } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required.");
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
      logger.info(`[JOB] Processing ${jobId}: Validating edited file '${dbFile.originalName}'`, "JOB");

      const inputBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();

      if (totalPages === 0) {
        throw new ProcessingFailedError("Cannot process an empty PDF.");
      }

      // Copy the edited file to the output path
      await fs.promises.copyFile(physicalPath, physicalOutputPath);

      const outputSize = fs.statSync(physicalOutputPath).size;

      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
      const outputName = `${baseName}_edited.pdf`;

      // Record output File in database
      const outputFile = await filesService.createFile(
        userId,
        outputName,
        storageKey,
        "application/pdf",
        outputSize,
        jobId
      );

      logger.info(
        `[JOB] Completed ${jobId}: Created edited output file ${outputFile.id} (${totalPages} pages, ${outputSize} bytes)`,
        "JOB"
      );

      return {
        outputFileId: outputFile.id,
        metrics: {
          totalPages,
          outputSize,
        },
      };
    } catch (err: any) {
      logger.error(`PDF job ${jobId} failed.`, "JOB");

      if (fs.existsSync(physicalOutputPath)) {
        try {
          await fs.promises.unlink(physicalOutputPath);
        } catch {
          logger.warn("[JOB] Failed to clean up output file.", "JOB");
        }
      }

      if (err.code === "STORAGE_QUOTA_EXCEEDED" || err.code === "PAYLOAD_TOO_LARGE") {
        throw err;
      }

      throw new ProcessingFailedError("We couldn't process the edited PDF. Please try again.");
    }
  }
}

export const editProcessor = new EditProcessor();
