import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument } from "@cantoo/pdf-lib";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IPdfFormsJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    fields?: Record<string, string | boolean>;
    flatten?: boolean;
  };
}

export interface IPdfFormsJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    fieldsCount: number;
    outputSize: number;
  };
}

export class FormsProcessor {
  async process(params: IPdfFormsJobParams): Promise<IPdfFormsJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) throw new ProcessingFailedError("Input file ID is required.");

    const dbFile = await prisma.file.findFirst({
      where: { id: inputFileId, userId },
    });
    if (!dbFile) throw new FileNotFoundError(`Input file ID '${inputFileId}' not found.`);

    const uploadBase = storageService.getStorageRoot();
    const physicalPath = path.resolve(uploadBase, dbFile.storageKey);
    if (!fs.existsSync(physicalPath)) {
      throw new FileNotFoundError(`Physical input file not found on disk.`);
    }

    const userDir = storageService.getUserStorageDir(userId);
    const randomHex = crypto.randomBytes(8).toString("hex");
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    try {
      logger.info(`[JOB] Processing ${jobId}: Processing and flattening PDF form`, "JOB");

      const inputBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });

      const form = pdfDoc.getForm();
      const allFields = form.getFields();
      let filledCount = 0;

      if (options?.fields) {
        for (const [key, val] of Object.entries(options.fields)) {
          try {
            const field = form.getField(key);
            if (typeof val === "boolean") {
              const check = form.getCheckBox(key);
              if (val) check.check(); else check.uncheck();
            } else {
              const text = form.getTextField(key);
              text.setText(String(val));
            }
            filledCount++;
          } catch {}
        }
      }

      // Flatten by default to protect values from client-side tampering
      if (options?.flatten !== false) {
        try {
          form.flatten();
        } catch {}
      }

      const pdfBytes = await pdfDoc.save();
      await fs.promises.writeFile(physicalOutputPath, pdfBytes);

      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
      const outputName = `${baseName}_form.pdf`;
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
          fieldsCount: allFields.length,
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

export const formsProcessor = new FormsProcessor();
