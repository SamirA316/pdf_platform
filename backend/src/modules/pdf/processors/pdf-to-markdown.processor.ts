import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";
import { extractPdfText } from "../utils/pdf-text-extractor";

export interface IPdfToMarkdownJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    includePageNumbers?: boolean;
    format?: "standard" | "compact";
  };
}

export interface IPdfToMarkdownJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    textLength: number;
    outputSize: number;
  };
}

export class PdfToMarkdownProcessor {
  async process(params: IPdfToMarkdownJobParams): Promise<IPdfToMarkdownJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required.");
    }

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
    const outputFilename = `file_${randomHex}.md`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    try {
      logger.info(`[JOB] Processing ${jobId}: Converting PDF to Markdown`, "JOB");

      const pdfData = await extractPdfText(physicalPath);

      const rawText: string = pdfData.text || "";
      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";

      // Format text into structured Markdown
      const lines = rawText.split("\n");
      const mdLines: string[] = [`# ${baseName}\n`];

      let inParagraph = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim();
        if (!line) {
          if (inParagraph) {
            mdLines.push("\n");
            inParagraph = false;
          }
          continue;
        }

        // Detect potential headers (short uppercase or numbered headings)
        if (line.length < 60 && (/^[0-9]+(\.[0-9]+)*\s+[A-Z]/.test(line) || (line === line.toUpperCase() && line.length > 3))) {
          mdLines.push(`\n## ${line}\n`);
          inParagraph = false;
        } else if (/^[-*•]\s+/.test(line)) {
          mdLines.push(`- ${line.replace(/^[-*•]\s+/, "")}`);
          inParagraph = false;
        } else {
          mdLines.push(line);
          inParagraph = true;
        }
      }

      const markdownContent = mdLines.join("\n");
      const mdBuffer = Buffer.from(markdownContent, "utf-8");

      await fs.promises.writeFile(physicalOutputPath, mdBuffer);

      const outputName = `${baseName}.md`;
      const outputSize = mdBuffer.length;

      const outputFile = await filesService.createFile(
        userId,
        outputName,
        storageKey,
        "text/markdown",
        outputSize,
        jobId
      );

      return {
        outputFileId: outputFile.id,
        metrics: {
          pageCount: pdfData.numpages || 1,
          textLength: markdownContent.length,
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

export const pdfToMarkdownProcessor = new PdfToMarkdownProcessor();
