import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../../../common/prisma";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { STANDARD_PAGE_DIMENSIONS } from "../../jobs/job.constants";

export interface IResizeJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    size?: string;
    orientation?: "portrait" | "landscape";
    width?: number;
    height?: number;
    unit?: string;
    targetWidthPt?: number;
    targetHeightPt?: number;
  };
}

export interface IResizeJobResult {
  outputFileId: string;
  metrics: {
    totalPages: number;
    targetSize: string;
    orientation: string;
    targetWidthPt: number;
    targetHeightPt: number;
    outputSize: number;
  };
}

export class ResizeProcessor {
  /**
   * Resizes all pages of a PDF to the specified page dimensions without cropping,
   * scaling and centering existing content proportionally.
   */
  async process(params: IResizeJobParams): Promise<IResizeJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required to resize PDF.");
    }

    const size = (options?.size || "a4").toLowerCase();
    const orientation = (options?.orientation || "portrait").toLowerCase();

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

    // 3. Compute target width and height in points
    let baseWidthPt = options?.targetWidthPt;
    let baseHeightPt = options?.targetHeightPt;

    if (!baseWidthPt || !baseHeightPt) {
      if (size === "custom" && options?.width && options?.height) {
        const unit = (options?.unit || "mm").toLowerCase();
        if (unit === "mm") {
          baseWidthPt = options.width * (72 / 25.4);
          baseHeightPt = options.height * (72 / 25.4);
        } else if (unit === "inch" || unit === "in") {
          baseWidthPt = options.width * 72;
          baseHeightPt = options.height * 72;
        } else {
          baseWidthPt = options.width;
          baseHeightPt = options.height;
        }
      } else {
        const preset = STANDARD_PAGE_DIMENSIONS[size] || STANDARD_PAGE_DIMENSIONS.a4!;
        baseWidthPt = preset.width;
        baseHeightPt = preset.height;
      }
    }

    // Apply orientation: portrait vs landscape
    let targetWidth: number;
    let targetHeight: number;
    if (orientation === "landscape") {
      targetWidth = Math.max(baseWidthPt, baseHeightPt);
      targetHeight = Math.min(baseWidthPt, baseHeightPt);
    } else {
      targetWidth = Math.min(baseWidthPt, baseHeightPt);
      targetHeight = Math.max(baseWidthPt, baseHeightPt);
    }

    // 4. Prepare user output directory
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
        `[JOB] Processing ${jobId}: Resizing file '${dbFile.originalName}' to ${size.toUpperCase()} (${orientation}) [${Math.round(targetWidth)}x${Math.round(targetHeight)} pt]`
      );

      const inputBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();

      if (totalPages === 0) {
        throw new ProcessingFailedError("Cannot resize a PDF with 0 pages.");
      }

      for (let i = 0; i < totalPages; i++) {
        const page = pdfDoc.getPage(i);
        const origWidth = page.getWidth();
        const origHeight = page.getHeight();

        // Calculate proportional scale factor to fit within target page dimensions
        const scale = Math.min(targetWidth / origWidth, targetHeight / origHeight);
        const scaledWidth = origWidth * scale;
        const scaledHeight = origHeight * scale;

        // Calculate centering offsets
        const xOffset = (targetWidth - scaledWidth) / 2;
        const yOffset = (targetHeight - scaledHeight) / 2;

        // Scale and translate existing content, then adjust bounding page size
        page.scaleContent(scale, scale);
        page.translateContent(xOffset, yOffset);
        page.setSize(targetWidth, targetHeight);
      }

      const resizedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
      await fs.promises.writeFile(physicalOutputPath, resizedPdfBytes);

      if (!fs.existsSync(physicalOutputPath) || fs.statSync(physicalOutputPath).size === 0) {
        throw new ProcessingFailedError("Generated output PDF is missing or zero bytes.");
      }

      const outputStats = fs.statSync(physicalOutputPath);

      // Create output File record in Prisma
      const baseNameWithoutExt = dbFile.originalName.replace(/\.pdf$/i, "");
      const outputOriginalName = `${baseNameWithoutExt}_resized_${size}.pdf`;

      const newFile = await prisma.file.create({
        data: {
          userId,
          storageKey,
          originalName: outputOriginalName,
          mimeType: "application/pdf",
          size: outputStats.size,
          status: "READY",
          jobId,
        },
      });

      console.log(
        `[JOB] Completed ${jobId}: Resized PDF saved as '${outputOriginalName}' (${outputStats.size} bytes)`
      );

      return {
        outputFileId: newFile.id,
        metrics: {
          totalPages,
          targetSize: size,
          orientation,
          targetWidthPt: Math.round(targetWidth * 100) / 100,
          targetHeightPt: Math.round(targetHeight * 100) / 100,
          outputSize: outputStats.size,
        },
      };
    } catch (err: any) {
      // Physical output cleanup on failure
      if (fs.existsSync(physicalOutputPath)) {
        try {
          await fs.promises.unlink(physicalOutputPath);
        } catch (cleanupErr: any) {
          console.warn(`[JOB] Failed to unlink temp output '${physicalOutputPath}':`, cleanupErr.message);
        }
      }

      throw new ProcessingFailedError(err.message || "Failed to resize PDF document.");
    }
  }
}

export const resizeProcessor = new ResizeProcessor();
