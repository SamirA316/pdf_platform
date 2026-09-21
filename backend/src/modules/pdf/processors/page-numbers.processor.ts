import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument, rgb, StandardFonts, RGB } from "pdf-lib";
import { prisma } from "../../../common/prisma";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";

export interface IPageNumbersJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    position?: "bottom-center" | "bottom-left" | "bottom-right" | "top-center" | "top-left" | "top-right";
    startNumber?: number;
    fontSize?: number;
    margin?: number;
    format?: string;
    color?: string;
    pages?: "all" | number[];
  };
}

export interface IPageNumbersJobResult {
  outputFileId: string;
  metrics: {
    totalPages: number;
    numberedPagesCount: number;
    position: string;
    startNumber: number;
    format: string;
    outputSize: number;
  };
}

function parseHexColor(hexStr?: string): RGB {
  if (!hexStr) return rgb(0, 0, 0);
  const cleanHex = hexStr.replace(/^#/, "");
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return rgb(r, g, b);
    }
  }
  return rgb(0, 0, 0);
}

export class PageNumbersProcessor {
  /**
   * Stamped page numbers on targeted pages according to template format and position.
   */
  async process(params: IPageNumbersJobParams): Promise<IPageNumbersJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required to add page numbers.");
    }

    const position = options?.position || "bottom-center";
    const startNumber = options?.startNumber !== undefined ? Number(options.startNumber) : 1;
    const fontSize = options?.fontSize !== undefined ? Number(options.fontSize) : 12;
    const margin = options?.margin !== undefined ? Number(options.margin) : 30;
    const format = options?.format || "Page {n} / {total}";
    const textColor = parseHexColor(options?.color);

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
        `[JOB] Processing ${jobId}: Adding page numbers to '${dbFile.originalName}' (pos: ${position}, start: ${startNumber}, format: "${format}")`
      );

      const inputBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();

      if (totalPages === 0) {
        throw new ProcessingFailedError("Cannot add page numbers to a PDF with 0 pages.");
      }

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Determine target page indices (0-indexed)
      const targetPageIndices: Set<number> = new Set();
      if (!options?.pages || options.pages === "all") {
        for (let i = 0; i < totalPages; i++) {
          targetPageIndices.add(i);
        }
      } else if (Array.isArray(options.pages)) {
        for (const p of options.pages) {
          const idx = Number(p) - 1;
          if (idx >= 0 && idx < totalPages) {
            targetPageIndices.add(idx);
          }
        }
      }

      for (let i = 0; i < totalPages; i++) {
        if (!targetPageIndices.has(i)) {
          continue;
        }

        const page = pdfDoc.getPage(i);
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        // Calculate page number based on physical index and startNumber
        const pageNum = i + startNumber;
        const pageText = format
          .replace(/\{n\}/g, String(pageNum))
          .replace(/\{total\}/g, String(totalPages));

        const textWidth = font.widthOfTextAtSize(pageText, fontSize);
        const textHeight = font.heightAtSize(fontSize);

        let x = 0;
        let y = 0;

        if (position === "bottom-center") {
          x = (pageWidth - textWidth) / 2;
          y = margin;
        } else if (position === "bottom-left") {
          x = margin;
          y = margin;
        } else if (position === "bottom-right") {
          x = pageWidth - margin - textWidth;
          y = margin;
        } else if (position === "top-center") {
          x = (pageWidth - textWidth) / 2;
          y = pageHeight - margin - textHeight;
        } else if (position === "top-left") {
          x = margin;
          y = pageHeight - margin - textHeight;
        } else if (position === "top-right") {
          x = pageWidth - margin - textWidth;
          y = pageHeight - margin - textHeight;
        }

        page.drawText(pageText, {
          x,
          y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      const numberedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
      await fs.promises.writeFile(physicalOutputPath, numberedPdfBytes);

      if (!fs.existsSync(physicalOutputPath) || fs.statSync(physicalOutputPath).size === 0) {
        throw new ProcessingFailedError("Generated numbered PDF is missing or zero bytes.");
      }

      const outputStats = fs.statSync(physicalOutputPath);

      // Create output File record in Prisma
      const baseNameWithoutExt = dbFile.originalName.replace(/\.pdf$/i, "");
      const outputOriginalName = `${baseNameWithoutExt}_numbered.pdf`;

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
        `[JOB] Completed ${jobId}: Page numbers added as '${outputOriginalName}' (${outputStats.size} bytes)`
      );

      return {
        outputFileId: newFile.id,
        metrics: {
          totalPages,
          numberedPagesCount: targetPageIndices.size,
          position,
          startNumber,
          format,
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

      throw new ProcessingFailedError(err.message || "Failed to add page numbers to PDF document.");
    }
  }
}

export const pageNumbersProcessor = new PageNumbersProcessor();
