import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument, degrees } from "pdf-lib";
import { prisma } from "../../../common/prisma";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";

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

    const randomHex = crypto.randomBytes(8).toString("hex");
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    try {
      console.log(
        `[JOB] Processing ${jobId}: Organizing file '${dbFile.originalName}' (${pages.length} target pages)`
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

      // Record output File in database
      const outputFile = await prisma.file.create({
        data: {
          userId,
          originalName: outputName,
          storageKey,
          mimeType: "application/pdf",
          size: outputSize,
          status: "READY",
          jobId,
        },
      });

      console.log(
        `[JOB] Completed ${jobId}: Created organized output file ${outputFile.id} (${pages.length} pages, ${outputSize} bytes)`
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
      console.error(`[JOB] Failed ${jobId}:`, err.message || err);

      // Clean up orphaned partial output file on disk
      if (fs.existsSync(physicalOutputPath)) {
        try {
          await fs.promises.unlink(physicalOutputPath);
        } catch (unlinkErr) {
          console.warn("Failed to clean up partial organized output file:", unlinkErr);
        }
      }

      throw new ProcessingFailedError("We couldn't organize this PDF. Please try again.");
    }
  }
}

export const organizeProcessor = new OrganizeProcessor();
