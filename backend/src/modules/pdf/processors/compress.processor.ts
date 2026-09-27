import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import { compressPDFFile } from "../../../utils/pdfCompressor";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface ICompressJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: Record<string, unknown>;
}

export interface ICompressJobResult {
  outputFileId: string;
  metrics: {
    originalSize: number;
    compressedSize: number;
    savedBytes: number;
    savedPercentage: number;
  };
}

export class CompressProcessor {
  /**
   * Executes PDF compression pipeline in an isolated, decoupled processor.
   */
  async process(params: ICompressJobParams): Promise<ICompressJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    // 1. Resolve input file from database
    const inputFile = await prisma.file.findFirst({
      where: {
        id: inputFileId,
        userId,
      },
    });

    if (!inputFile) {
      throw new FileNotFoundError("Input file not found for processing.");
    }

    const uploadBase = storageService.getStorageRoot();
    const physicalInputPath = path.resolve(uploadBase, inputFile.storageKey);
    const relativeInput = path.relative(uploadBase, physicalInputPath);

    if (relativeInput.startsWith("..") || path.isAbsolute(relativeInput)) {
      throw new ProcessingFailedError("Invalid input file path security violation.");
    }

    if (!fs.existsSync(physicalInputPath)) {
      throw new FileNotFoundError("Physical input PDF does not exist on disk.");
    }

    // 2. Prepare user output directory
    const userDir = storageService.getUserStorageDir(userId);

    const randomHex = crypto.randomBytes(8).toString("hex");
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    try {
      logger.info(`[JOB] Processing ${jobId}: Compressing file ${inputFile.originalName}`, "JOB");

      // 3. Execute compression pipeline
      const level = typeof options?.level === "string" ? options.level : "recommended";
      const compressOpts: { level?: string; customSize?: string } = { level };
      if (typeof options?.customSize === "string" && options.customSize) {
        compressOpts.customSize = options.customSize;
      }
      const result = await compressPDFFile(physicalInputPath, physicalOutputPath, compressOpts);

      if (!fs.existsSync(physicalOutputPath) || fs.statSync(physicalOutputPath).size === 0) {
        throw new Error("Compression resulted in an empty or missing output file.");
      }

      // 4. Record new output File in database with atomic quota enforcement
      const outputName = inputFile.originalName.toLowerCase().endsWith(".pdf")
        ? inputFile.originalName.replace(/\.pdf$/i, "_compressed.pdf")
        : `${inputFile.originalName}_compressed.pdf`;

      const outputFile = await filesService.createFile(
        userId,
        outputName,
        storageKey,
        "application/pdf",
        result.compressedSize,
        jobId
      );

      logger.info(`[JOB] Completed ${jobId}: Created output file ${outputFile.id}`, "JOB");

      return {
        outputFileId: outputFile.id,
        metrics: {
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          savedBytes: result.savedBytes,
          savedPercentage: result.savedPercentage,
        },
      };
    } catch (err: any) {
      logger.error(`PDF job ${jobId} failed.`, "JOB");

      // Clean up orphaned partial output file on disk
      if (fs.existsSync(physicalOutputPath)) {
        try {
          await fs.promises.unlink(physicalOutputPath);
        } catch {
          logger.warn("[JOB] Failed to clean up partial output file.", "JOB");
        }
      }

      if (err.code === "STORAGE_QUOTA_EXCEEDED" || err.code === "PAYLOAD_TOO_LARGE") {
        throw err;
      }

      throw new ProcessingFailedError("We couldn't process this PDF. Please try another file.");
    }
  }
}

export const compressProcessor = new CompressProcessor();
