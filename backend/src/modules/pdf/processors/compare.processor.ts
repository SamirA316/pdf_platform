import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument, rgb, StandardFonts } from "@cantoo/pdf-lib";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";
import { extractPdfText } from "../utils/pdf-text-extractor";

export interface ICompareJobParams {
  jobId: string;
  userId: string;
  inputFileIds: string[];
  options?: Record<string, any>;
}

export interface ICompareJobResult {
  outputFileId: string;
  metrics: {
    diffCount: number;
    file1Pages: number;
    file2Pages: number;
    outputSize: number;
  };
}

export class CompareProcessor {
  async process(params: ICompareJobParams): Promise<ICompareJobResult> {
    const { jobId, userId, inputFileIds } = params;

    if (!inputFileIds || inputFileIds.length < 2) {
      throw new ProcessingFailedError("Two PDF files are required to perform document comparison.");
    }

    const dbFiles = await prisma.file.findMany({
      where: { id: { in: inputFileIds.slice(0, 2) }, userId },
    });

    if (dbFiles.length < 2) {
      throw new FileNotFoundError("Both input files must exist and belong to the user.");
    }

    const uploadBase = storageService.getStorageRoot();
    const path1 = path.resolve(uploadBase, dbFiles[0]!.storageKey);
    const path2 = path.resolve(uploadBase, dbFiles[1]!.storageKey);

    const userDir = storageService.getUserStorageDir(userId);
    const randomHex = crypto.randomBytes(8).toString("hex");
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    try {
      logger.info(`[JOB] Processing ${jobId}: Comparing documents '${dbFiles[0]!.originalName}' and '${dbFiles[1]!.originalName}'`, "JOB");

      const parsed1 = await extractPdfText(path1);
      const parsed2 = await extractPdfText(path2);

      const words1 = (parsed1.text || "").split(/\s+/);
      const words2 = (parsed2.text || "").split(/\s+/);

      const reportDoc = await PDFDocument.create();
      const boldFont = await reportDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await reportDoc.embedFont(StandardFonts.Helvetica);

      const page = reportDoc.addPage([595.28, 841.89]);
      const { height } = page.getSize();

      // Title & Header Banner
      page.drawRectangle({
        x: 40,
        y: height - 100,
        width: 515,
        height: 60,
        color: rgb(0.95, 0.97, 1.0),
        borderColor: rgb(0.2, 0.4, 0.9),
        borderWidth: 1,
      });

      page.drawText("QuickPDF — Document Comparison Report", {
        x: 60,
        y: height - 70,
        size: 16,
        font: boldFont,
        color: rgb(0.1, 0.2, 0.6),
      });

      page.drawText(`File 1: ${dbFiles[0]!.originalName} (${parsed1.numpages || 1} pages, ${words1.length} words)`, {
        x: 60,
        y: height - 125,
        size: 10,
        font: regularFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText(`File 2: ${dbFiles[1]!.originalName} (${parsed2.numpages || 1} pages, ${words2.length} words)`, {
        x: 60,
        y: height - 145,
        size: 10,
        font: regularFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Comparison Metrics
      const isIdentical = parsed1.text.trim() === parsed2.text.trim();
      page.drawText(
        isIdentical
          ? "Status: Documents are 100% text-identical."
          : `Status: Content differences detected between documents.`,
        {
          x: 60,
          y: height - 180,
          size: 12,
          font: boldFont,
          color: isIdentical ? rgb(0.1, 0.6, 0.2) : rgb(0.8, 0.2, 0.1),
        }
      );

      // Draw sample text preview
      const preview1 = words1.slice(0, 40).join(" ") || "No text found.";
      const preview2 = words2.slice(0, 40).join(" ") || "No text found.";

      page.drawText("File 1 Content Sample:", { x: 60, y: height - 220, size: 10, font: boldFont });
      page.drawText(preview1.substring(0, 90), { x: 60, y: height - 235, size: 9, font: regularFont });

      page.drawText("File 2 Content Sample:", { x: 60, y: height - 270, size: 10, font: boldFont });
      page.drawText(preview2.substring(0, 90), { x: 60, y: height - 285, size: 9, font: regularFont });

      const pdfBytes = await reportDoc.save();
      await fs.promises.writeFile(physicalOutputPath, pdfBytes);

      const outputName = `comparison_report.pdf`;
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
          diffCount: isIdentical ? 0 : Math.abs(words1.length - words2.length) + 1,
          file1Pages: parsed1.numpages || 1,
          file2Pages: parsed2.numpages || 1,
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

export const compareProcessor = new CompareProcessor();
