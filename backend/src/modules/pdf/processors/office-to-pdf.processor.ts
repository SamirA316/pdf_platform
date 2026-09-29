import path from "path";
import fs from "fs";
import crypto from "crypto";
import { exec } from "child_process";
import util from "util";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";

export interface IOfficeToPdfJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  tool: "word-to-pdf" | "excel-to-pdf" | "powerpoint-to-pdf";
  options?: Record<string, any>;
}

export interface IOfficeToPdfJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    outputSize: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Try to convert using LibreOffice; returns the output path or throws. */
async function tryLibreOffice(
  physicalPath: string,
  userDir: string,
  outputFilename: string,
  physicalOutputPath: string
): Promise<void> {
  const execAsync = util.promisify(exec);
  const inputFileBaseName = path.basename(physicalPath, path.extname(physicalPath));
  const loOutputFileName = `${inputFileBaseName}.pdf`;
  const loPhysicalOutputPath = path.join(userDir, loOutputFileName);

  const cmd = `"${physicalPath}"`;
  try {
    await execAsync(`libreoffice --headless --nologo --nofirststartwizard --convert-to pdf --outdir "${userDir}" ${cmd}`);
  } catch {
    await execAsync(`soffice --headless --nologo --nofirststartwizard --convert-to pdf --outdir "${userDir}" ${cmd}`);
  }

  if (!fs.existsSync(loPhysicalOutputPath)) {
    throw new ProcessingFailedError("LibreOffice conversion produced no output.");
  }
  await fs.promises.rename(loPhysicalOutputPath, physicalOutputPath);
}

/** Wrap text at maxWidth chars for PDF rendering */
function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (rawLine.length <= maxWidth) { lines.push(rawLine); continue; }
    let remaining = rawLine;
    while (remaining.length > maxWidth) {
      const cut = remaining.lastIndexOf(" ", maxWidth);
      const splitAt = cut > 0 ? cut : maxWidth;
      lines.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    if (remaining) lines.push(remaining);
  }
  return lines;
}

/** Render plain text lines into a PDF using pdf-lib. Returns a PDF Buffer. */
async function textToPdfBuffer(
  title: string,
  lines: string[],
  subtitle?: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 50;
  const FONT_SIZE = 10;
  const LINE_HEIGHT = 15;
  const TITLE_SIZE = 16;
  const CONTENT_WIDTH = PAGE_W - MARGIN * 2;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Title
  page.drawText(title.slice(0, 80), { x: MARGIN, y, font: boldFont, size: TITLE_SIZE, color: rgb(0.13, 0.13, 0.23) });
  y -= TITLE_SIZE + 8;

  if (subtitle) {
    page.drawText(subtitle.slice(0, 100), { x: MARGIN, y, font: regularFont, size: 9, color: rgb(0.4, 0.4, 0.4) });
    y -= 12;
  }

  // Divider
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= LINE_HEIGHT;

  const maxChars = Math.floor(CONTENT_WIDTH / (FONT_SIZE * 0.52));

  for (const rawLine of lines) {
    const wrapped = wrapText(rawLine, maxChars);
    for (const wl of wrapped) {
      if (y < MARGIN + LINE_HEIGHT) {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      // Sanitize: remove non-WinAnsi chars
      const safe = wl.replace(/[^\x20-\x7E\n]/g, " ");
      page.drawText(safe, { x: MARGIN, y, font: regularFont, size: FONT_SIZE, color: rgb(0.1, 0.1, 0.1) });
      y -= LINE_HEIGHT;
    }
  }

  return Buffer.from(await pdfDoc.save());
}

// ─── Pure-JS fallbacks ───────────────────────────────────────────────────────

async function wordToPdfFallback(physicalPath: string): Promise<Buffer> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: physicalPath });
  const rawText = result.value || "(No readable text found in document)";
  const lines = rawText.split("\n").map((l: string) => l.trimEnd());
  const baseName = path.basename(physicalPath, path.extname(physicalPath));
  return textToPdfBuffer(`${baseName} — Converted Document`, lines, "Converted from Word via PDF Platform");
}

async function excelToPdfFallback(physicalPath: string): Promise<Buffer> {
  const xlsxLib: any =
    typeof (XLSX as any)?.readFile === "function"
      ? XLSX
      : typeof (XLSX as any)?.default?.readFile === "function"
      ? (XLSX as any).default
      : require("xlsx");
  const workbook = xlsxLib.readFile(physicalPath);
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    lines.push(`=== Sheet: ${sheetName} ===`, "");
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    const csvData = xlsxLib.utils.sheet_to_csv(ws);
    for (const row of csvData.split("\n")) {
      if (row.trim()) lines.push(row);
    }
    lines.push("");
  }
  if (lines.length === 0) lines.push("(No readable data found in workbook)");
  const baseName = path.basename(physicalPath, path.extname(physicalPath));
  return textToPdfBuffer(`${baseName} — Spreadsheet Export`, lines, "Converted from Excel via PDF Platform");
}

async function powerpointToPdfFallback(physicalPath: string): Promise<Buffer> {
  // Extract slide text from PPTX using JSZip + XML parsing
  const JSZip = (await import("jszip")).default;
  const zipBuffer = await fs.promises.readFile(physicalPath);
  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    const baseName = path.basename(physicalPath, path.extname(physicalPath));
    return textToPdfBuffer(`${baseName} — Presentation`, ["(Could not parse presentation file)"], "Converted from PowerPoint via PDF Platform");
  }

  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? "0");
      const nb = parseInt(b.match(/\d+/)?.[0] ?? "0");
      return na - nb;
    });

  const lines: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xmlContent = await zip.files[slideFiles[i]!]!.async("string");
    // Extract text nodes from XML
    const textMatches = xmlContent.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
    const slideText = textMatches
      .map((m) => m.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .join(" ");
    lines.push(`--- Slide ${i + 1} ---`);
    if (slideText) {
      lines.push(...slideText.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean));
    } else {
      lines.push("(Slide has no extractable text)");
    }
    lines.push("");
  }
  if (lines.length === 0) lines.push("(No slides found in presentation)");
  const baseName = path.basename(physicalPath, path.extname(physicalPath));
  return textToPdfBuffer(
    `${baseName} — Presentation`,
    lines,
    `${slideFiles.length} slide(s) extracted via PDF Platform`
  );
}

// ─── Main Processor ──────────────────────────────────────────────────────────

export class OfficeToPdfProcessor {
  async process(params: IOfficeToPdfJobParams): Promise<IOfficeToPdfJobResult> {
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
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    try {
      logger.info(`[JOB] Processing ${jobId}: Converting ${tool} for '${dbFile.originalName}'`, "JOB");

      let pdfBuffer: Buffer | null = null;

      // Step 1: Try LibreOffice (best quality, only available if installed)
      try {
        await tryLibreOffice(physicalPath, userDir, outputFilename, physicalOutputPath);
        pdfBuffer = await fs.promises.readFile(physicalOutputPath);
        logger.info(`[JOB] ${jobId}: LibreOffice conversion succeeded`, "JOB");
      } catch (loErr: any) {
        logger.info(`[JOB] ${jobId}: LibreOffice unavailable (${loErr.message?.slice(0, 60)}), using pure-JS fallback`, "JOB");
      }

      // Step 2: Pure-JS fallback (always available)
      if (!pdfBuffer) {
        if (tool === "word-to-pdf") {
          pdfBuffer = await wordToPdfFallback(physicalPath);
        } else if (tool === "excel-to-pdf") {
          pdfBuffer = await excelToPdfFallback(physicalPath);
        } else {
          // powerpoint-to-pdf
          pdfBuffer = await powerpointToPdfFallback(physicalPath);
        }
      }

      await fs.promises.writeFile(physicalOutputPath, pdfBuffer);

      const outputSize = pdfBuffer.length;
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const actualPageCount = pdfDoc.getPageCount();

      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
      const outputName = `${baseName}.pdf`;

      logger.info(`[JOB] Completed ${jobId}: ${tool} → '${outputName}' (${outputSize} bytes, ${actualPageCount} pages)`, "JOB");

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
          pageCount: actualPageCount,
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

export const officeToPdfProcessor = new OfficeToPdfProcessor();
