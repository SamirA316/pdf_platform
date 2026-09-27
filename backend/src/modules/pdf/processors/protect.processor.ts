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

export interface IProtectJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    userPassword?: string;
    ownerPassword?: string;
    permissions?: {
      print?: boolean;
      copy?: boolean;
      modify?: boolean;
      annotate?: boolean;
    };
  };
}

export interface IProtectJobResult {
  outputFileId: string;
  metrics: {
    totalPages: number;
    isEncrypted: boolean;
    permissions: {
      print: boolean;
      copy: boolean;
      modify: boolean;
      annotate: boolean;
    };
    outputSize: number;
  };
}

export class ProtectProcessor {
  /**
   * Encrypts a PDF with user password and fine-grained permissions using AES-256 encryption.
   */
  async process(params: IProtectJobParams): Promise<IProtectJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required to protect PDF.");
    }

    const userPassword = options?.userPassword;
    if (!userPassword) {
      throw new ProcessingFailedError("User password is required to encrypt PDF.");
    }

    const perms = {
      print: options?.permissions?.print !== false,
      copy: Boolean(options?.permissions?.copy),
      modify: Boolean(options?.permissions?.modify),
      annotate: Boolean(options?.permissions?.annotate),
    };

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
      logger.info(`[JOB] Processing ${jobId}: Encrypting document '${dbFile.originalName}'`, "JOB");

      const inputBytes = await fs.promises.readFile(physicalPath);
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();

      if (totalPages === 0) {
        throw new ProcessingFailedError("Cannot protect a PDF with 0 pages.");
      }

      // Generate random owner password if none provided
      const ownerPassword = options?.ownerPassword || crypto.randomBytes(16).toString("hex");

      /**
       * Cryptographic Profile:
       * Algorithm: AES-256 (Revision 6, Version 5)
       * Standard: ISO 32000-1 / ExtensionLevel 8
       * Cipher: AES-256-CBC with SHA-256 / SHA-384 / SHA-512 key derivation and /AESV3 CryptFilter
       */
      pdfDoc.encrypt({
        userPassword,
        ownerPassword,
        algorithm: "AES-256",
        permissions: {
          printing: perms.print ? "highResolution" : false,
          copying: perms.copy,
          modifying: perms.modify,
          annotating: perms.annotate,
        },
      });

      const encryptedBytes = await pdfDoc.save({ useObjectStreams: false });
      await fs.promises.writeFile(physicalOutputPath, encryptedBytes);

      if (!fs.existsSync(physicalOutputPath) || fs.statSync(physicalOutputPath).size === 0) {
        throw new ProcessingFailedError("Generated encrypted PDF is missing or zero bytes.");
      }

      const outputStats = fs.statSync(physicalOutputPath);
      const baseNameWithoutExt = dbFile.originalName.replace(/\.pdf$/i, "");
      const outputOriginalName = `${baseNameWithoutExt}_protected.pdf`;

      const newFile = await filesService.createFile(
        userId,
        outputOriginalName,
        storageKey,
        "application/pdf",
        outputStats.size,
        jobId
      );

      logger.info(
        `[JOB] Completed ${jobId}: Protected PDF saved as '${outputOriginalName}' (${outputStats.size} bytes)`,
        "JOB"
      );

      return {
        outputFileId: newFile.id,
        metrics: {
          totalPages,
          isEncrypted: true,
          permissions: perms,
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

      throw new ProcessingFailedError(err.message || "Failed to protect PDF document.");
    }
  }
}

export const protectProcessor = new ProtectProcessor();
