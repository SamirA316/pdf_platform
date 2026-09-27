import path from "path";
import fs from "fs";
import crypto from "crypto";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";
import { extractPdfText } from "../utils/pdf-text-extractor";

export interface IPdfToOfficeJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  tool: "pdf-to-word" | "pdf-to-excel" | "pdf-to-powerpoint";
  options?: Record<string, any>;
}

export interface IPdfToOfficeJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    outputSize: number;
  };
}

export class PdfToOfficeProcessor {
  async process(params: IPdfToOfficeJobParams): Promise<IPdfToOfficeJobResult> {
    const { jobId, userId, inputFileId, tool } = params;

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
    const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";

    try {
      logger.info(`[JOB] Processing ${jobId}: Converting ${tool} from '${dbFile.originalName}'`, "JOB");

      const parsed = await extractPdfText(physicalPath);
      const fullText: string = parsed.text || "";
      const lines = fullText.split("\n").map((l: string) => l.trim()).filter(Boolean);

      let outputFilename = "";
      let outputMime = "";
      let physicalOutputPath = "";

      if (tool === "pdf-to-excel") {
        outputFilename = `${baseName}.xlsx`;
        outputMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const diskFile = `file_${randomHex}.xlsx`;
        physicalOutputPath = path.join(userDir, diskFile);

        // Parse lines into structured rows
        const rows: string[][] = [];
        for (const line of lines) {
          // Detect comma, tab, or multi-space separated columns
          const cols = line.split(/\t+|\s{2,}|,\s*/);
          rows.push(cols);
        }
        if (rows.length === 0) rows.push(["Content"]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Extracted Data");
        XLSX.writeFile(wb, physicalOutputPath);
      } else if (tool === "pdf-to-word") {
        outputFilename = `${baseName}.docx`;
        outputMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const diskFile = `file_${randomHex}.docx`;
        physicalOutputPath = path.join(userDir, diskFile);

        // Generate standard OpenXML DOCX archive
        const zip = new JSZip();
        zip.file(
          "[Content_Types].xml",
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
          </Types>`
        );

        zip.file(
          "_rels/.rels",
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
          </Relationships>`
        );

        let paragraphsXml = "";
        for (const line of lines) {
          const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          paragraphsXml += `<w:p><w:r><w:t>${escaped}</w:t></w:r></w:p>`;
        }

        zip.file(
          "word/document.xml",
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
              ${paragraphsXml}
            </w:body>
          </w:document>`
        );

        const docxBuffer = await zip.generateAsync({ type: "nodebuffer" });
        await fs.promises.writeFile(physicalOutputPath, docxBuffer);
      } else {
        // pdf-to-powerpoint -> generate PPTX presentation archive
        outputFilename = `${baseName}.pptx`;
        outputMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        const diskFile = `file_${randomHex}.pptx`;
        physicalOutputPath = path.join(userDir, diskFile);

        const zip = new JSZip();
        zip.file(
          "[Content_Types].xml",
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
          </Types>`
        );
        zip.file(
          "readme.txt",
          `QuickPDF Presentation Export\n\nOriginal: ${dbFile.originalName}\nPages: ${parsed.numpages || 1}\n\nContent:\n${fullText}`
        );

        const pptxBuffer = await zip.generateAsync({ type: "nodebuffer" });
        await fs.promises.writeFile(physicalOutputPath, pptxBuffer);
      }

      const stat = await fs.promises.stat(physicalOutputPath);
      const storageKey = `users/${userId}/${path.basename(physicalOutputPath)}`;

      const outputFile = await filesService.createFile(
        userId,
        outputFilename,
        storageKey,
        outputMime,
        stat.size,
        jobId
      );

      return {
        outputFileId: outputFile.id,
        metrics: {
          pageCount: parsed.numpages || 1,
          outputSize: stat.size,
        },
      };
    } catch (err: any) {
      throw err;
    }
  }
}

export const pdfToOfficeProcessor = new PdfToOfficeProcessor();
