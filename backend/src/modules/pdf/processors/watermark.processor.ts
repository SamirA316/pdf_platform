import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument, rgb, degrees, StandardFonts, RGB } from "pdf-lib";
import { prisma } from "../../../common/prisma";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";

export interface IWatermarkJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    type?: "text" | "image";
    text?: string;
    fontSize?: number;
    opacity?: number;
    rotation?: number;
    position?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    color?: string;
    pages?: "all" | number[];
    imageFileId?: string;
    scale?: number;
  };
}

export interface IWatermarkJobResult {
  outputFileId: string;
  metrics: {
    totalPages: number;
    watermarkedPagesCount: number;
    type: "text" | "image";
    position: string;
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

export class WatermarkProcessor {
  /**
   * Applies text or image watermark to target pages of a PDF.
   */
  async process(params: IWatermarkJobParams): Promise<IWatermarkJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required to watermark PDF.");
    }

    const type = options?.type || "text";
    const position = options?.position || "center";
    const opacity = options?.opacity !== undefined ? Number(options.opacity) : (type === "text" ? 0.3 : 0.4);
    const rotation = options?.rotation !== undefined ? Number(options.rotation) : (type === "text" ? 45 : 0);

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
        `[JOB] Processing ${jobId}: Watermarking '${dbFile.originalName}' (${type}, pos: ${position}, opacity: ${opacity})`
      );

      const inputBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();

      if (totalPages === 0) {
        throw new ProcessingFailedError("Cannot watermark a PDF with 0 pages.");
      }

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

      if (type === "text") {
        const watermarkText = options?.text || "CONFIDENTIAL";
        const fontSize = options?.fontSize || 40;
        const textColor = parseHexColor(options?.color);
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
        const textHeight = font.heightAtSize(fontSize);
        const rad = (rotation * Math.PI) / 180;
        const margin = 40;

        for (const pageIdx of targetPageIndices) {
          const page = pdfDoc.getPage(pageIdx);
          const pageWidth = page.getWidth();
          const pageHeight = page.getHeight();

          let x = 0;
          let y = 0;

          if (position === "center") {
            const cx = pageWidth / 2;
            const cy = pageHeight / 2;
            x = cx - (textWidth / 2) * Math.cos(rad) + (textHeight / 2) * Math.sin(rad);
            y = cy - (textWidth / 2) * Math.sin(rad) - (textHeight / 2) * Math.cos(rad);
          } else if (position === "top-left") {
            x = margin;
            y = pageHeight - margin - textHeight;
          } else if (position === "top-right") {
            x = pageWidth - margin - textWidth;
            y = pageHeight - margin - textHeight;
          } else if (position === "bottom-left") {
            x = margin;
            y = margin;
          } else if (position === "bottom-right") {
            x = pageWidth - margin - textWidth;
            y = margin;
          }

          page.drawText(watermarkText, {
            x,
            y,
            size: fontSize,
            font,
            color: textColor,
            opacity,
            rotate: degrees(rotation),
          });
        }
      } else if (type === "image") {
        if (!options?.imageFileId) {
          throw new ProcessingFailedError("Image watermark requires a valid imageFileId.");
        }

        const imgDbFile = await prisma.file.findFirst({
          where: { id: options.imageFileId, userId },
        });

        if (!imgDbFile) {
          throw new FileNotFoundError(`Watermark image file '${options.imageFileId}' not found.`);
        }

        const imgPhysicalPath = path.resolve(uploadBase, imgDbFile.storageKey);
        if (!fs.existsSync(imgPhysicalPath)) {
          throw new FileNotFoundError("Watermark image physical file does not exist on disk.");
        }

        const imgBytes = await fs.promises.readFile(imgPhysicalPath);
        const isPng = imgDbFile.mimeType.toLowerCase().includes("png");
        const embeddedImg = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

        const scale = options.scale !== undefined ? Number(options.scale) : 0.5;
        const imgWidth = embeddedImg.width * scale;
        const imgHeight = embeddedImg.height * scale;
        const margin = 40;

        for (const pageIdx of targetPageIndices) {
          const page = pdfDoc.getPage(pageIdx);
          const pageWidth = page.getWidth();
          const pageHeight = page.getHeight();

          let x = 0;
          let y = 0;

          if (position === "center") {
            x = (pageWidth - imgWidth) / 2;
            y = (pageHeight - imgHeight) / 2;
          } else if (position === "top-left") {
            x = margin;
            y = pageHeight - margin - imgHeight;
          } else if (position === "top-right") {
            x = pageWidth - margin - imgWidth;
            y = pageHeight - margin - imgHeight;
          } else if (position === "bottom-left") {
            x = margin;
            y = margin;
          } else if (position === "bottom-right") {
            x = pageWidth - margin - imgWidth;
            y = margin;
          }

          page.drawImage(embeddedImg, {
            x,
            y,
            width: imgWidth,
            height: imgHeight,
            opacity,
            rotate: degrees(rotation),
          });
        }
      }

      const watermarkedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
      await fs.promises.writeFile(physicalOutputPath, watermarkedPdfBytes);

      if (!fs.existsSync(physicalOutputPath) || fs.statSync(physicalOutputPath).size === 0) {
        throw new ProcessingFailedError("Generated watermarked PDF is missing or empty.");
      }

      const outputStats = fs.statSync(physicalOutputPath);

      // Create output File record in Prisma
      const baseNameWithoutExt = dbFile.originalName.replace(/\.pdf$/i, "");
      const outputOriginalName = `${baseNameWithoutExt}_watermarked.pdf`;

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
        `[JOB] Completed ${jobId}: Watermarked PDF saved as '${outputOriginalName}' (${outputStats.size} bytes)`
      );

      return {
        outputFileId: newFile.id,
        metrics: {
          totalPages,
          watermarkedPagesCount: targetPageIndices.size,
          type,
          position,
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

      throw new ProcessingFailedError(err.message || "Failed to watermark PDF document.");
    }
  }
}

export const watermarkProcessor = new WatermarkProcessor();
