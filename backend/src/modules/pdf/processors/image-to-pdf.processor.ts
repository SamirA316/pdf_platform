import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import { PDFDocument } from "@cantoo/pdf-lib";
import type { File as PrismaFile } from "@prisma/client";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IImageToPdfJobParams {
  jobId: string;
  userId: string;
  inputFileIds: string[];
  options?: {
    orientation?: "portrait" | "landscape" | "auto";
    margin?: "none" | "small" | "big";
    pageSize?: "fit" | "a4" | "letter";
    grayscale?: boolean;
  };
}

export interface IImageToPdfJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    inputCount: number;
    outputSize: number;
  };
}

export class ImageToPdfProcessor {
  async process(params: IImageToPdfJobParams): Promise<IImageToPdfJobResult> {
    const { jobId, userId, inputFileIds, options } = params;

    if (!inputFileIds || inputFileIds.length === 0) {
      throw new ProcessingFailedError("At least 1 image file is required to convert to PDF.");
    }

    // 1. Resolve input files from database
    const dbFiles: PrismaFile[] = await prisma.file.findMany({
      where: {
        id: { in: inputFileIds },
        userId,
      },
    });

    const fileMap = new Map<string, PrismaFile>(dbFiles.map((f: PrismaFile) => [f.id, f]));
    const orderedFiles: PrismaFile[] = [];

    for (const id of inputFileIds) {
      const f = fileMap.get(id);
      if (!f) throw new FileNotFoundError(`Input file ID '${id}' not found.`);
      if (f.status !== "READY") throw new ProcessingFailedError(`Input file '${f.originalName}' is not ready.`);
      orderedFiles.push(f);
    }

    const uploadBase = storageService.getStorageRoot();
    const userDir = storageService.getUserStorageDir(userId);
    const randomHex = crypto.randomBytes(8).toString("hex");
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    try {
      logger.info(`[JOB] Processing ${jobId}: Converting ${orderedFiles.length} images to PDF`, "JOB");

      const pdfDoc = await PDFDocument.create();

      for (const fileRecord of orderedFiles) {
        const physicalPath = path.resolve(uploadBase, fileRecord.storageKey);
        if (!fs.existsSync(physicalPath)) {
          throw new FileNotFoundError(`Physical input file '${fileRecord.originalName}' not found.`);
        }

        const rawBuffer = await fs.promises.readFile(physicalPath);

        // Process image with Sharp
        let sharpPipeline = sharp(rawBuffer);
        if (options?.grayscale) {
          sharpPipeline = sharpPipeline.grayscale();
        }
        const pngBuffer = await sharpPipeline.png().toBuffer();
        const embeddedImage = await pdfDoc.embedPng(pngBuffer);

        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;

        let pageWidth = imgWidth;
        let pageHeight = imgHeight;
        let drawX = 0;
        let drawY = 0;
        let drawW = imgWidth;
        let drawH = imgHeight;

        // Custom page size fitting
        if (options?.pageSize === "a4") {
          pageWidth = 595.28;
          pageHeight = 841.89;
        } else if (options?.pageSize === "letter") {
          pageWidth = 612.0;
          pageHeight = 792.0;
        }

        if (options?.orientation === "landscape" && pageWidth < pageHeight) {
          const temp = pageWidth;
          pageWidth = pageHeight;
          pageHeight = temp;
        }

        if (options?.pageSize && options.pageSize !== "fit") {
          let marginPts = 0;
          if (options.margin === "small") marginPts = 20;
          if (options.margin === "big") marginPts = 50;

          const availW = pageWidth - marginPts * 2;
          const availH = pageHeight - marginPts * 2;
          const scale = Math.min(availW / imgWidth, availH / imgHeight);

          drawW = imgWidth * scale;
          drawH = imgHeight * scale;
          drawX = marginPts + (availW - drawW) / 2;
          drawY = marginPts + (availH - drawH) / 2;
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(embeddedImage, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });
      }

      const pdfBytes = await pdfDoc.save();
      await fs.promises.writeFile(physicalOutputPath, pdfBytes);

      const baseName = orderedFiles[0]?.originalName.replace(/\.[^/.]+$/, "") || "converted_images";
      const outputName = `${baseName}.pdf`;
      const outputSize = Buffer.byteLength(pdfBytes);

      const outputFile = await filesService.createFile(
        userId,
        outputName,
        storageKey,
        "application/pdf",
        outputSize,
        jobId
      );

      return {
        outputFileId: outputFile.id,
        metrics: {
          pageCount: pdfDoc.getPageCount(),
          inputCount: orderedFiles.length,
          outputSize,
        },
      };
    } catch (err: any) {
      if (fs.existsSync(physicalOutputPath)) {
        try { await fs.promises.unlink(physicalOutputPath); } catch {}
      }
      throw err;
    }
  }
}

export const imageToPdfProcessor = new ImageToPdfProcessor();
