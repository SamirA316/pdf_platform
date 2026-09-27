import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { File as PrismaFile } from "@prisma/client";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import { getMaxFileSizeBytes } from "../../files/files.constants";
import {
  ProcessingFailedError,
  FileNotFoundError,
  PayloadTooLargeError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface ISplitJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    mode?: "ranges" | "pages" | "every-page";
    ranges?: Array<{ start: number; end: number }>;
    pages?: number[];
  };
}

export interface ISplitJobResult {
  outputFileIds: string[];
  metrics: {
    inputPages: number;
    outputFileCount: number;
    totalOutputBytes: number;
  };
}

interface ISubFilePlan {
  originalName: string;
  pageIndices: number[];
}

export class SplitProcessor {
  /**
   * Splits a single PDF into one or more output PDFs based on the chosen mode:
   * 1. ranges: extracts separate PDFs for each start-end range
   * 2. pages: extracts selected pages into a single consolidated PDF
   * 3. every-page: extracts every individual page into its own 1-page PDF
   */
  async process(params: ISplitJobParams): Promise<ISplitJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required to execute a split.");
    }

    const mode = options?.mode || "every-page";

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

    const createdPhysicalPaths: string[] = [];
    const createdFileIds: string[] = [];

    try {
      logger.info(`[JOB] Processing ${jobId}: Splitting file '${dbFile.originalName}' [mode: ${mode}]`, "JOB");

      const inputBytes = await fs.promises.readFile(physicalPath);
      const srcDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const totalPages = srcDoc.getPageCount();

      if (totalPages === 0) {
        throw new ProcessingFailedError("Cannot split a PDF with 0 pages.");
      }

      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";

      // 4. Build execution plan based on mode
      const splitPlans: ISubFilePlan[] = [];

      if (mode === "ranges") {
        const ranges = options?.ranges || [];
        if (ranges.length === 0) {
          throw new ProcessingFailedError("At least one page range is required.");
        }
        for (const r of ranges) {
          const pageIndices: number[] = [];
          for (let p = r.start; p <= r.end; p++) {
            pageIndices.push(p - 1);
          }
          splitPlans.push({
            originalName: `${baseName}_${r.start}-${r.end}.pdf`,
            pageIndices,
          });
        }
      } else if (mode === "pages") {
        const pages = options?.pages || [];
        if (pages.length === 0) {
          throw new ProcessingFailedError("At least one page must be selected.");
        }
        const pageIndices = pages.map((p) => p - 1);
        splitPlans.push({
          originalName: `${baseName}_pages_${pages.join("_")}.pdf`,
          pageIndices,
        });
      } else if (mode === "every-page") {
        for (let i = 0; i < totalPages; i++) {
          splitPlans.push({
            originalName: `${baseName}_page_${i + 1}.pdf`,
            pageIndices: [i],
          });
        }
      } else {
        throw new ProcessingFailedError(`Unsupported split mode '${mode}'.`);
      }

      let totalOutputBytes = 0;

      // 5. Generate each split PDF to disk first
      interface ISplitFileItem {
        originalName: string;
        storageKey: string;
        outputSize: number;
      }
      const splitItems: ISplitFileItem[] = [];

      for (const plan of splitPlans) {
        const subDoc = await PDFDocument.create();
        const copiedPages = await subDoc.copyPages(srcDoc, plan.pageIndices);
        copiedPages.forEach((cp) => subDoc.addPage(cp));

        const subPdfBytes = await subDoc.save({ useObjectStreams: false });
        const randomHex = crypto.randomBytes(8).toString("hex");
        const outputFilename = `file_${randomHex}.pdf`;
        const physicalOutputPath = path.join(userDir, outputFilename);
        const storageKey = `users/${userId}/${outputFilename}`;

        await fs.promises.writeFile(physicalOutputPath, subPdfBytes);
        createdPhysicalPaths.push(physicalOutputPath);

        if (!fs.existsSync(physicalOutputPath) || fs.statSync(physicalOutputPath).size === 0) {
          throw new Error(`Split generated an empty file for '${plan.originalName}'.`);
        }

        const outputSize = Buffer.byteLength(subPdfBytes);

        // Validate each generated file against per-file maximum size limit before reservation
        const maxFileSize = getMaxFileSizeBytes();
        if (outputSize > maxFileSize) {
          throw new PayloadTooLargeError(
            `Generated file '${plan.originalName}' exceeds the maximum permitted size of ${maxFileSize} bytes.`
          );
        }

        totalOutputBytes += outputSize;

        splitItems.push({
          originalName: plan.originalName,
          storageKey,
          outputSize,
        });
      }

      // 6. Atomically reserve quota for all split files combined
      let quotaReserved = false;
      await filesService.reserveQuota(userId, totalOutputBytes);
      quotaReserved = true;

      // 7. Record all files in database with jobId relation
      try {
        for (const item of splitItems) {
          const createdRecord = await filesService.createFileRecord(
            userId,
            item.originalName,
            item.storageKey,
            "application/pdf",
            item.outputSize,
            jobId
          );
          createdFileIds.push(createdRecord.id);
        }
      } catch (dbErr) {
        if (quotaReserved) {
          await filesService.releaseQuota(userId, totalOutputBytes).catch(() => {});
        }
        throw dbErr;
      }

      logger.info(
        `[JOB] Completed ${jobId}: Created ${createdFileIds.length} split files for user ${userId} (${totalOutputBytes} bytes total)`,
        "JOB"
      );

      return {
        outputFileIds: createdFileIds,
        metrics: {
          inputPages: totalPages,
          outputFileCount: createdFileIds.length,
          totalOutputBytes,
        },
      };
    } catch (err: any) {
      logger.error(`PDF job ${jobId} failed.`, "JOB");

      // Clean up orphaned physical files
      for (const physPath of createdPhysicalPaths) {
        if (fs.existsSync(physPath)) {
          try {
            await fs.promises.unlink(physPath);
          } catch {
            logger.warn("[JOB] Failed to clean up partial split file.", "JOB");
          }
        }
      }

      // Clean up database records created for this failed job
      if (createdFileIds.length > 0) {
        try {
          await prisma.file.deleteMany({
            where: { id: { in: createdFileIds } },
          });
        } catch {
          logger.warn("[JOB] Failed to clean up partial split DB file records.", "JOB");
        }
      }

      if (
        err.code === "STORAGE_QUOTA_EXCEEDED" ||
        err.code === "PAYLOAD_TOO_LARGE" ||
        err.code === "FILE_TOO_LARGE" ||
        err.statusCode === 413
      ) {
        throw err;
      }

      throw new ProcessingFailedError("We couldn't split this PDF. Please try again.");
    }
  }
}

export const splitProcessor = new SplitProcessor();
