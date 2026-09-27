import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument, EncryptedPDFError } from "@cantoo/pdf-lib";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
  BadRequestError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IUnlockJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    password?: string;
  };
}

export interface IUnlockJobResult {
  outputFileId: string;
  metrics: {
    totalPages: number;
    isEncrypted: boolean;
    outputSize: number;
  };
}

export class UnlockProcessor {
  /**
   * Decrypts a protected PDF using user-supplied password and creates an unlocked PDF.
   */
  async process(params: IUnlockJobParams): Promise<IUnlockJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required to unlock PDF.");
    }

    const password = options?.password;
    if (!password) {
      throw new BadRequestError("Password is required to unlock this PDF.", "INVALID_PASSWORD");
    }

    // 1. Resolve input file from database
    const dbFile = await prisma.file.findFirst({
      where: { id: inputFileId, userId },
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

    const randomHex = crypto.randomBytes(8).toString("hex");
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    try {
      logger.info(`[JOB] Processing ${jobId}: Decrypting document '${dbFile.originalName}'`, "JOB");

      const inputBytes = await fs.promises.readFile(physicalPath);

      // Verify that the file is actually encrypted
      let isEncrypted = false;
      try {
        await PDFDocument.load(inputBytes);
      } catch (err: any) {
        if (err instanceof EncryptedPDFError || (err.message && err.message.includes("encrypted"))) {
          isEncrypted = true;
        }
      }

      if (!isEncrypted) {
        throw new BadRequestError("This PDF document is not password-protected.", "PDF_NOT_ENCRYPTED");
      }

      // Attempt unlocking with provided password
      let unlockedDoc: PDFDocument;
      try {
        unlockedDoc = await PDFDocument.load(inputBytes, { password });
      } catch {
        throw new BadRequestError("Incorrect PDF password provided.", "INVALID_PDF_PASSWORD");
      }

      const totalPages = unlockedDoc.getPageCount();
      if (totalPages === 0) {
        throw new ProcessingFailedError("Cannot unlock a PDF with 0 pages.");
      }

      // Copy pages to a clean unencrypted PDF document
      const cleanDoc = await PDFDocument.create();
      const pageIndices = unlockedDoc.getPageIndices();
      const copiedPages = await cleanDoc.copyPages(unlockedDoc, pageIndices);
      copiedPages.forEach((p) => cleanDoc.addPage(p));

      const unlockedBytes = await cleanDoc.save({ useObjectStreams: false });
      await fs.promises.writeFile(physicalOutputPath, unlockedBytes);

      if (!fs.existsSync(physicalOutputPath) || fs.statSync(physicalOutputPath).size === 0) {
        throw new ProcessingFailedError("Generated unlocked PDF is missing or zero bytes.");
      }

      const outputStats = fs.statSync(physicalOutputPath);
      const baseNameWithoutExt = dbFile.originalName.replace(/\.pdf$/i, "");
      const outputOriginalName = `${baseNameWithoutExt}_unlocked.pdf`;

      const newFile = await filesService.createFile(
        userId,
        outputOriginalName,
        storageKey,
        "application/pdf",
        outputStats.size,
        jobId
      );

      logger.info(
        `[JOB] Completed ${jobId}: Unlocked PDF saved as '${outputOriginalName}' (${outputStats.size} bytes)`,
        "JOB"
      );

      return {
        outputFileId: newFile.id,
        metrics: {
          totalPages,
          isEncrypted: false,
          outputSize: outputStats.size,
        },
      };
    } catch (err: any) {
      if (fs.existsSync(physicalOutputPath)) {
        try {
          await fs.promises.unlink(physicalOutputPath);
        } catch {
          logger.warn("[JOB] Failed to unlink temporary output file.", "JOB");
        }
      }
      if (err.code === "STORAGE_QUOTA_EXCEEDED" || err.code === "PAYLOAD_TOO_LARGE") {
        throw err;
      }
      if (err instanceof BadRequestError) {
        throw err;
      }
      throw new ProcessingFailedError(err.message || "Failed to unlock PDF document.");
    }
  }
}

export const unlockProcessor = new UnlockProcessor();
