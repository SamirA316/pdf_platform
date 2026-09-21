import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { File as PrismaFile } from "@prisma/client";
import { prisma } from "../../../common/prisma";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";

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
    const uploadBase = path.resolve(process.cwd(), "uploads");
    const physicalPath = path.resolve(uploadBase, dbFile.storageKey);
    const relativePath = path.relative(uploadBase, physicalPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new ProcessingFailedError("Invalid input file path security violation.");
    }

    if (!fs.existsSync(physicalPath)) {
      throw new FileNotFoundError(`Physical input PDF '${dbFile.originalName}' does not exist on disk.`);
    }

    // 3. Prepare user output directory
    const userDir = path.join(uploadBase, "users", userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const createdPhysicalPaths: string[] = [];
    const createdFileIds: string[] = [];

    try {
      console.log(`[JOB] Processing ${jobId}: Splitting file '${dbFile.originalName}' [mode: ${mode}]`);

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

      // 5. Generate each split PDF
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
        totalOutputBytes += outputSize;

        // Record in database with jobId relation
        const createdRecord = await prisma.file.create({
          data: {
            userId,
            originalName: plan.originalName,
            storageKey,
            mimeType: "application/pdf",
            size: outputSize,
            status: "READY",
            jobId,
          },
        });

        createdFileIds.push(createdRecord.id);
      }

      console.log(
        `[JOB] Completed ${jobId}: Created ${createdFileIds.length} split files for user ${userId} (${totalOutputBytes} bytes total)`
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
      console.error(`[JOB] Failed ${jobId}:`, err.message || err);

      // Clean up orphaned physical files
      for (const physPath of createdPhysicalPaths) {
        if (fs.existsSync(physPath)) {
          try {
            await fs.promises.unlink(physPath);
          } catch (unlinkErr) {
            console.warn(`Failed to clean up partial split file '${physPath}':`, unlinkErr);
          }
        }
      }

      // Clean up database records created for this failed job
      if (createdFileIds.length > 0) {
        try {
          await prisma.file.deleteMany({
            where: { id: { in: createdFileIds } },
          });
        } catch (dbErr) {
          console.warn("Failed to clean up partial split DB file records:", dbErr);
        }
      }

      throw new ProcessingFailedError("We couldn't split this PDF. Please try again.");
    }
  }
}

export const splitProcessor = new SplitProcessor();
