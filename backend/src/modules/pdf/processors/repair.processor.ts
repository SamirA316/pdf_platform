import path from "path";
import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";
import { PDFDocument } from "@cantoo/pdf-lib";
import { prisma } from "../../../common/prisma";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";

export interface IRepairJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: Record<string, unknown>;
}

export interface IRepairJobResult {
  outputFileId: string;
  metrics: {
    totalPages: number;
    originalSize: number;
    repairedSize: number;
    method: "qpdf" | "ghostscript" | "engine-reconstruct";
  };
}

export class RepairProcessor {
  /**
   * Attempts to repair a corrupted or damaged PDF document.
   * Multi-stage pipeline:
   * 1. Attempt qpdf linearization/repair if available
   * 2. Attempt Ghostscript re-distillation if available
   * 3. Fallback to resilient parser/reconstructor engine
   * 4. Strict multi-point output validation
   */
  async process(params: IRepairJobParams): Promise<IRepairJobResult> {
    const { jobId, userId, inputFileId } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required to repair PDF.", "INVALID_INPUT_FILE");
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

    const originalStats = fs.statSync(physicalPath);
    let repairMethod: "qpdf" | "ghostscript" | "engine-reconstruct" = "engine-reconstruct";
    let success = false;

    try {
      console.log(`[JOB] Processing ${jobId}: Repairing document '${dbFile.originalName}' (${originalStats.size} bytes)`);

      // Stage 1: Try qpdf external repair if installed
      try {
        const qpdfSuccess = await this.tryQpdfRepair(physicalPath, physicalOutputPath);
        if (qpdfSuccess && (await this.validateRepairedOutput(physicalOutputPath))) {
          repairMethod = "qpdf";
          success = true;
        }
      } catch (err: any) {
        console.log(`[JOB] qpdf repair attempt skipped or failed:`, err.message);
      }

      // Stage 2: Try Ghostscript repair if qpdf failed
      if (!success) {
        try {
          const gsSuccess = await this.tryGhostscriptRepair(physicalPath, physicalOutputPath);
          if (gsSuccess && (await this.validateRepairedOutput(physicalOutputPath))) {
            repairMethod = "ghostscript";
            success = true;
          }
        } catch (err: any) {
          console.log(`[JOB] Ghostscript repair attempt skipped or failed:`, err.message);
        }
      }

      // Stage 3: Resilient internal engine repair fallback
      if (!success) {
        const engineSuccess = await this.tryEngineRepair(physicalPath, physicalOutputPath);
        if (engineSuccess && (await this.validateRepairedOutput(physicalOutputPath))) {
          repairMethod = "engine-reconstruct";
          success = true;
        }
      }

      if (!success) {
        throw new ProcessingFailedError(
          "We couldn't repair this PDF. The document is severely corrupted.",
          "PDF_REPAIR_FAILED"
        );
      }

      // 4. Validate output strictly
      const isValid = await this.validateRepairedOutput(physicalOutputPath);
      if (!isValid) {
        throw new ProcessingFailedError(
          "We couldn't repair this PDF. Repaired output failed validation.",
          "PDF_REPAIR_FAILED"
        );
      }

      const outputStats = fs.statSync(physicalOutputPath);
      const repairedBytes = await fs.promises.readFile(physicalOutputPath);
      const loadedRepaired = await PDFDocument.load(repairedBytes, { ignoreEncryption: true });
      const totalPages = loadedRepaired.getPageCount();

      if (totalPages === 0) {
        throw new ProcessingFailedError(
          "We couldn't repair this PDF. The document contains no readable pages.",
          "PDF_REPAIR_FAILED"
        );
      }

      const baseNameWithoutExt = dbFile.originalName.replace(/\.pdf$/i, "");
      const outputOriginalName = `${baseNameWithoutExt}_repaired.pdf`;

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
        `[JOB] Completed ${jobId}: Repaired PDF saved as '${outputOriginalName}' via ${repairMethod} (${outputStats.size} bytes, ${totalPages} pages)`
      );

      return {
        outputFileId: newFile.id,
        metrics: {
          totalPages,
          originalSize: originalStats.size,
          repairedSize: outputStats.size,
          method: repairMethod,
        },
      };
    } catch (err: any) {
      if (fs.existsSync(physicalOutputPath)) {
        try {
          await fs.promises.unlink(physicalOutputPath);
        } catch (cleanupErr: any) {
          console.warn(`[JOB] Failed to unlink temp output '${physicalOutputPath}':`, cleanupErr.message);
        }
      }
      if (err instanceof ProcessingFailedError) {
        throw err;
      }
      throw new ProcessingFailedError(
        "We couldn't repair this PDF. The document is corrupted or invalid.",
        "PDF_REPAIR_FAILED"
      );
    }
  }

  /**
   * Attempts qpdf repair via safe process spawn
   */
  private async tryQpdfRepair(inputPath: string, outputPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("qpdf", ["--linearize", inputPath, outputPath], {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      });

      proc.on("error", () => resolve(false));
      proc.on("close", (code) => resolve(code === 0 || code === 3)); // qpdf code 3 = warnings but file produced
    });
  }

  /**
   * Attempts Ghostscript repair via safe process spawn
   */
  private async tryGhostscriptRepair(inputPath: string, outputPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(
        "gs",
        [
          "-o",
          outputPath,
          "-sDEVICE=pdfwrite",
          "-dPDFSETTINGS=/prepress",
          "-dCompatibilityLevel=1.4",
          inputPath,
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 15000,
        }
      );

      proc.on("error", () => resolve(false));
      proc.on("close", (code) => resolve(code === 0));
    });
  }

  /**
   * Resilient engine repair fallback:
   * Strips prefix garbage, fixes missing EOF trailer, reconstructs xref into fresh PDF container
   */
  private async tryEngineRepair(inputPath: string, outputPath: string): Promise<boolean> {
    try {
      const rawBytes = await fs.promises.readFile(inputPath);
      if (rawBytes.length === 0) return false;

      // Check for shifted %PDF- signature (e.g. download headers or leading garbage)
      const headerIdx = rawBytes.indexOf(Buffer.from("%PDF-"));
      if (headerIdx === -1) {
        return false; // Not a PDF at all
      }

      let candidateBytes = headerIdx > 0 ? rawBytes.subarray(headerIdx) : rawBytes;

      // Check if %%EOF is present in the final 1024 bytes
      const eofStr = "%%EOF";
      const hasEOF = candidateBytes.includes(Buffer.from(eofStr));
      if (!hasEOF) {
        candidateBytes = Buffer.concat([candidateBytes, Buffer.from("\n%%EOF\n")]);
      }

      // Attempt parsing with Cantoo PDF-lib error tolerance
      let sourceDoc: PDFDocument;
      try {
        sourceDoc = await PDFDocument.load(candidateBytes, { ignoreEncryption: true });
      } catch {
        // If still failing, try rawBytes directly
        try {
          sourceDoc = await PDFDocument.load(rawBytes, { ignoreEncryption: true });
        } catch {
          return false;
        }
      }

      const pageCount = sourceDoc.getPageCount();
      if (pageCount === 0) return false;

      // Reconstruct document into fresh container to completely rebuild xref table & stream dictionaries
      const cleanDoc = await PDFDocument.create();
      const pageIndices = sourceDoc.getPageIndices();
      const copiedPages = await cleanDoc.copyPages(sourceDoc, pageIndices);
      copiedPages.forEach((p) => cleanDoc.addPage(p));

      const cleanBytes = await cleanDoc.save({ useObjectStreams: false });
      await fs.promises.writeFile(outputPath, cleanBytes);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Multi-point output validation:
   * 1. Output file exists
   * 2. File size > 0
   * 3. Valid %PDF- magic bytes signature
   * 4. Successfully parsable by PDF engine
   * 5. Page count > 0
   */
  private async validateRepairedOutput(filePath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) return false;
      const stats = fs.statSync(filePath);
      if (stats.size === 0) return false;

      const fd = await fs.promises.open(filePath, "r");
      const buffer = Buffer.alloc(10);
      await fd.read(buffer, 0, 10, 0);
      await fd.close();

      if (!buffer.toString("utf-8").startsWith("%PDF-")) {
        return false;
      }

      const bytes = await fs.promises.readFile(filePath);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      return doc.getPageCount() > 0;
    } catch {
      return false;
    }
  }
}

export const repairProcessor = new RepairProcessor();
