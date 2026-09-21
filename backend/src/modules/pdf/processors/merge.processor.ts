import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { File as PrismaFile } from "@prisma/client";
import { prisma } from "../../../common/prisma";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";

export interface IMergeJobParams {
  jobId: string;
  userId: string;
  inputFileIds: string[];
  options?: Record<string, unknown>;
}

export interface IMergeJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    inputCount: number;
    outputSize: number;
  };
}

export class MergeProcessor {
  /**
   * Merges multiple PDF files into a single output PDF, preserving the user-specified sequence.
   */
  async process(params: IMergeJobParams): Promise<IMergeJobResult> {
    const { jobId, userId, inputFileIds, options } = params;

    if (!inputFileIds || inputFileIds.length < 2) {
      throw new ProcessingFailedError("At least 2 input files are required to execute a merge.");
    }

    // 1. Resolve input files from database
    const dbFiles: PrismaFile[] = await prisma.file.findMany({
      where: {
        id: { in: inputFileIds },
        userId,
      },
    });

    const fileMap = new Map<string, PrismaFile>(dbFiles.map((f) => [f.id, f]));
    const orderedFiles: PrismaFile[] = [];

    for (let i = 0; i < inputFileIds.length; i++) {
      const id = inputFileIds[i]!;
      const f = fileMap.get(id);
      if (!f) {
        throw new FileNotFoundError(`Input file ID '${id}' not found.`);
      }
      if (f.status !== "READY") {
        throw new ProcessingFailedError(`Input file '${f.originalName}' is not ready for processing.`);
      }
      orderedFiles.push(f);
    }

    // 2. Resolve safe physical paths
    const uploadBase = path.resolve(process.cwd(), "uploads");
    const physicalPaths: string[] = [];

    for (const f of orderedFiles) {
      const physicalPath = path.resolve(uploadBase, f!.storageKey);
      const relativePath = path.relative(uploadBase, physicalPath);

      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new ProcessingFailedError("Invalid input file path security violation.");
      }

      if (!fs.existsSync(physicalPath)) {
        throw new FileNotFoundError(`Physical input PDF '${f!.originalName}' does not exist on disk.`);
      }

      physicalPaths.push(physicalPath);
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
      console.log(`[JOB] Processing ${jobId}: Merging ${orderedFiles.length} files`);

      const mergedPdf = await PDFDocument.create();
      let totalPageCount = 0;

      for (let i = 0; i < physicalPaths.length; i++) {
        const physPath = physicalPaths[i]!;
        const pdfBytes = await fs.promises.readFile(physPath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const pageIndices = pdfDoc.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        totalPageCount += pageIndices.length;
      }

      const mergedPdfBytes = await mergedPdf.save({ useObjectStreams: false });
      await fs.promises.writeFile(physicalOutputPath, mergedPdfBytes);

      if (!fs.existsSync(physicalOutputPath) || fs.statSync(physicalOutputPath).size === 0) {
        throw new Error("Merge resulted in an empty or missing output file.");
      }

      const outputName =
        typeof options?.outputName === "string" && options.outputName.trim()
          ? options.outputName.trim().toLowerCase().endsWith(".pdf")
            ? options.outputName.trim()
            : `${options.outputName.trim()}.pdf`
          : "merged-document.pdf";

      const outputSize = Buffer.byteLength(mergedPdfBytes);

      // 4. Record new output File in database
      const outputFile = await prisma.file.create({
        data: {
          userId,
          originalName: outputName,
          storageKey,
          mimeType: "application/pdf",
          size: outputSize,
          status: "READY",
        },
      });

      console.log(`[JOB] Completed ${jobId}: Created merged output file ${outputFile.id} (${totalPageCount} pages, ${outputSize} bytes)`);

      return {
        outputFileId: outputFile.id,
        metrics: {
          pageCount: totalPageCount,
          inputCount: orderedFiles.length,
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
          console.warn("Failed to clean up partial output file:", unlinkErr);
        }
      }

      throw new ProcessingFailedError("We couldn't merge these PDFs. Please try again.");
    }
  }
}

export const mergeProcessor = new MergeProcessor();
