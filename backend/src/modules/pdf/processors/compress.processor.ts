import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../../../common/prisma";
import { compressPDFFile } from "../../../utils/pdfCompressor";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";

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

    const uploadBase = path.resolve(process.cwd(), "uploads");
    const physicalInputPath = path.resolve(uploadBase, inputFile.storageKey);
    const relativeInput = path.relative(uploadBase, physicalInputPath);

    if (relativeInput.startsWith("..") || path.isAbsolute(relativeInput)) {
      throw new ProcessingFailedError("Invalid input file path security violation.");
    }

    if (!fs.existsSync(physicalInputPath)) {
      throw new FileNotFoundError("Physical input PDF does not exist on disk.");
    }

    // 2. Prepare user output directory
    const userDir = path.join(uploadBase, "users", userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const randomHex = crypto.randomBytes(8).toString("hex");
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    try {
      console.log(`[JOB] Processing ${jobId}: Compressing file ${inputFile.originalName}`);

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

      // 4. Record new output File in database
      const outputName = inputFile.originalName.toLowerCase().endsWith(".pdf")
        ? inputFile.originalName.replace(/\.pdf$/i, "_compressed.pdf")
        : `${inputFile.originalName}_compressed.pdf`;

      const outputFile = await prisma.file.create({
        data: {
          userId,
          originalName: outputName,
          storageKey,
          mimeType: "application/pdf",
          size: result.compressedSize,
          status: "READY",
        },
      });

      console.log(`[JOB] Completed ${jobId}: Created output file ${outputFile.id}`);

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
      console.error(`[JOB] Failed ${jobId}:`, err.message || err);

      // Clean up orphaned partial output file on disk
      if (fs.existsSync(physicalOutputPath)) {
        try {
          await fs.promises.unlink(physicalOutputPath);
        } catch (unlinkErr) {
          console.warn("Failed to clean up partial output file:", unlinkErr);
        }
      }

      throw new ProcessingFailedError("We couldn't process this PDF. Please try another file.");
    }
  }
}

export const compressProcessor = new CompressProcessor();
