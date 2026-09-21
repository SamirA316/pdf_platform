import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument, degrees } from "pdf-lib";
import { prisma } from "../../../common/prisma";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";

export interface IRotateJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    rotation?: number;
    rotations?: Array<{ page: number; rotation: number }>;
  };
}

export interface IRotateJobResult {
  outputFileId: string;
  metrics: {
    totalPages: number;
    rotatedPagesCount: number;
    outputSize: number;
  };
}

export class RotateProcessor {
  /**
   * Rotates PDF pages either globally across the entire document or selectively for specified pages.
   */
  async process(params: IRotateJobParams): Promise<IRotateJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required to execute rotation.");
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
      console.log(`[JOB] Processing ${jobId}: Rotating file '${dbFile.originalName}'`);

      const inputBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();

      if (totalPages === 0) {
        throw new ProcessingFailedError("Cannot rotate a PDF with 0 pages.");
      }

      let rotatedPagesCount = 0;

      if (options?.rotations && Array.isArray(options.rotations)) {
        // Selective per-page rotation
        const rotationMap = new Map<number, number>();
        for (const item of options.rotations) {
          rotationMap.set(Number(item.page), Number(item.rotation));
        }

        for (let i = 0; i < totalPages; i++) {
          const pageNum = i + 1;
          const delta = rotationMap.get(pageNum);
          if (delta !== undefined && delta > 0) {
            const page = pdfDoc.getPage(i);
            const currentAngle = page.getRotation().angle;
            const newAngle = (currentAngle + delta) % 360;
            page.setRotation(degrees(newAngle));
            rotatedPagesCount++;
          }
        }
      } else {
        // Global rotation for all pages
        const delta = options?.rotation !== undefined ? Number(options.rotation) : 90;
        for (let i = 0; i < totalPages; i++) {
          const page = pdfDoc.getPage(i);
          const currentAngle = page.getRotation().angle;
          const newAngle = (currentAngle + delta) % 360;
          page.setRotation(degrees(newAngle));
          rotatedPagesCount++;
        }
      }

      const rotatedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
      await fs.promises.writeFile(physicalOutputPath, rotatedPdfBytes);

      if (!fs.existsSync(physicalOutputPath) || fs.statSync(physicalOutputPath).size === 0) {
        throw new Error("Rotation resulted in an empty or missing output file.");
      }

      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
      const outputName = `${baseName}_rotated.pdf`;
      const outputSize = Buffer.byteLength(rotatedPdfBytes);

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
        `[JOB] Completed ${jobId}: Created rotated output file ${outputFile.id} (${rotatedPagesCount}/${totalPages} pages rotated, ${outputSize} bytes)`
      );

      return {
        outputFileId: outputFile.id,
        metrics: {
          totalPages,
          rotatedPagesCount,
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
          console.warn("Failed to clean up partial rotated output file:", unlinkErr);
        }
      }

      throw new ProcessingFailedError("We couldn't rotate this PDF. Please try again.");
    }
  }
}

export const rotateProcessor = new RotateProcessor();
