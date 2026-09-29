import path from "path";
import fs from "fs";
import crypto from "crypto";
import OpenAI from "openai";
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

export interface IAiJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  tool: "ai-summarizer" | "translate-pdf" | "chat-with-pdf";
  options?: {
    summaryLength?: "short" | "medium" | "detailed";
    targetLanguage?: string;
    question?: string;
  };
}

export interface IAiJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    outputSize: number;
  };
}

export class AiToolsProcessor {
  async process(params: IAiJobParams): Promise<IAiJobResult> {
    const { jobId, userId, inputFileId, tool, options } = params;

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
      logger.info(`[JOB] Processing ${jobId}: Running AI Tool (${tool}) on '${dbFile.originalName}'`, "JOB");

      const parsed = await extractPdfText(physicalPath);
      const docText: string = (parsed.text || "").trim();
      const textSample = docText.substring(0, 8000);

      let responseText = "";
      const apiKey = process.env.OPENAI_API_KEY;
      let usedFallback = false;

      // ── Attempt OpenAI if key is available ──────────────────────────────
      if (apiKey && apiKey.trim().length >= 10) {
        try {
          const openai = new OpenAI({ apiKey });
          const aiModel = process.env.OPENAI_MODEL || "gpt-3.5-turbo";
          let prompt = "";
          let sysPrompt = "";

          if (tool === "ai-summarizer") {
            sysPrompt = "You are an expert executive document summarizer.";
            prompt = `Summarize the following document into key points and actionable findings:\n\n${textSample}`;
          } else if (tool === "translate-pdf") {
            const targetLang = options?.targetLanguage || "Spanish";
            sysPrompt = `You are a professional document translator. Translate into ${targetLang}.`;
            prompt = `Translate the following document into ${targetLang}:\n\n${textSample.substring(0, 3000)}`;
          } else {
            const q = options?.question || "What are the main topics in this document?";
            sysPrompt = "You are a helpful PDF document assistant.";
            prompt = `Document Context:\n${textSample}\n\nQuestion: ${q}\n\nAnswer:`;
          }

          const completion = await openai.chat.completions.create({
            model: aiModel,
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: prompt },
            ],
            max_tokens: 1000,
          });

          responseText = completion.choices[0]?.message?.content || "";
          if (!responseText) throw new Error("Empty response from AI model.");
        } catch (err: any) {
          // On quota/rate/network errors — fall through to local analysis
          const msg: string = err.message || "";
          const isInfraError =
            msg.includes("429") ||
            msg.includes("quota") ||
            msg.includes("credits") ||
            msg.includes("rate limit") ||
            msg.includes("ECONNREFUSED") ||
            msg.includes("ENOTFOUND") ||
            msg.includes("timeout");

          if (isInfraError) {
            logger.info(`[AI] OpenAI unavailable (${msg.slice(0, 80)}), using local fallback`, "JOB");
            usedFallback = true;
          } else {
            logger.error(`[AI] OpenAI API error: ${msg}`, "JOB");
            throw new ProcessingFailedError(`AI processing failed: ${msg}`);
          }
        }
      } else {
        logger.info(`[AI] No OpenAI API key — using local analysis fallback`, "JOB");
        usedFallback = true;
      }

      // ── Local analysis fallback ──────────────────────────────────────────
      if (usedFallback || !responseText) {
        const sentences = docText
          .replace(/\s+/g, " ")
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 20);

        // Word frequency for keyword extraction
        const wordFreq: Record<string, number> = {};
        for (const word of docText.toLowerCase().match(/\b[a-z]{4,}\b/g) || []) {
          const stopWords = new Set(["that","this","with","from","have","been","they","their","were","will","which","about","more","also","than","into","some","when","what"]);
          if (!stopWords.has(word)) wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
        const keywords = Object.entries(wordFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([w]) => w);

        const totalWords = docText.split(/\s+/).filter(Boolean).length;
        const pageCount = parsed.numpages || 1;

        if (tool === "ai-summarizer") {
          responseText = [
            "DOCUMENT SUMMARY",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "",
            `Document: ${dbFile.originalName}`,
            `Pages: ${pageCount}  |  Words: ${totalWords}`,
            "",
            "KEY TOPICS",
            keywords.map((k) => `• ${k}`).join("\n"),
            "",
            "DOCUMENT OVERVIEW",
            ...sentences.slice(0, 8).map((s) => `• ${s}`),
            "",
            "─────────────────────────────────────",
            "Generated by PDF Platform local analysis engine.",
          ].join("\n");
        } else if (tool === "translate-pdf") {
          const targetLang = options?.targetLanguage || "Spanish";
          responseText = [
            `TRANSLATION NOTICE — Target: ${targetLang}`,
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "",
            "AI translation service is temporarily unavailable.",
            "Below is the original extracted document text:",
            "",
            "ORIGINAL TEXT",
            docText.substring(0, 3000),
            "",
            "─────────────────────────────────────",
            `Please use a translation service to convert the above to ${targetLang}.`,
          ].join("\n");
        } else {
          // chat-with-pdf
          const q = options?.question || "What are the main topics in this document?";
          responseText = [
            "DOCUMENT ANALYSIS",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "",
            `Question: ${q}`,
            "",
            "ANSWER (based on local text analysis):",
            "",
            ...sentences.slice(0, 6).map((s) => `• ${s}`),
            "",
            "KEY TERMS IN DOCUMENT",
            keywords.map((k) => `• ${k}`).join("\n"),
            "",
            "─────────────────────────────────────",
            "Generated by PDF Platform local analysis engine.",
          ].join("\n");
        }
      }

      // Generate a styled PDF report
      const pdfDoc = await PDFDocument.create();
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const page = pdfDoc.addPage([595.28, 841.89]);
      const { height } = page.getSize();

      page.drawRectangle({
        x: 40,
        y: height - 90,
        width: 515,
        height: 50,
        color: rgb(0.95, 0.95, 1.0),
        borderColor: rgb(0.3, 0.3, 0.9),
        borderWidth: 1,
      });

      page.drawText(`QuickPDF AI Intelligence Report — ${tool.replace(/-/g, " ").toUpperCase()}`, {
        x: 55,
        y: height - 65,
        size: 14,
        font: boldFont,
        color: rgb(0.1, 0.2, 0.6),
      });

      const lines = responseText.split("\n");
      let curY = height - 120;

      for (const line of lines) {
        if (curY < 60) break;
        if (line.startsWith("#")) {
          page.drawText(line.replace(/#/g, "").trim(), { x: 50, y: curY, size: 12, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
          curY -= 20;
        } else if (line.trim()) {
          const cleanLine = line.substring(0, 95);
          page.drawText(cleanLine, { x: 50, y: curY, size: 9.5, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
          curY -= 15;
        } else {
          curY -= 10;
        }
      }

      const pdfBytes = await pdfDoc.save();
      await fs.promises.writeFile(physicalOutputPath, pdfBytes);

      const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
      const outputName = `${baseName}_ai_report.pdf`;
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
          pageCount: 1,
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

export const aiToolsProcessor = new AiToolsProcessor();
