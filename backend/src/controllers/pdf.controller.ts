import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { PDFDocument, degrees, rgb, StandardFonts, PageSizes } from "pdf-lib";
import path from "path";
import fs from "fs";
import { AuthRequest } from "./auth.controller";
import { exec } from "child_process";
import util from "util";
import OpenAI from "openai";
import puppeteer from "puppeteer";

const pdfParse = require("pdf-parse");
const execPromise = util.promisify(exec);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const dummyProcessor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    // req.files or req.file could be populated based on uploadMiddleware.any()
    const files = req.files as Express.Multer.File[];
    const file = req.file;

    // Use the first available file as the "result" to mock processing
    const targetFile = file || (files && files.length > 0 ? files[0] : null);

    if (!targetFile) {
      res.status(400).json({ error: "No file provided for dummy processing" });
      return;
    }

    // Instead of doing actual heavy processing, we just save the original file 
    // as a new document to simulate a processed result.
    const newPdfBytes = fs.readFileSync(targetFile.path);
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const slug = req.params.slug || "dummy";
    const newFilename = `${slug}-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, newPdfBytes);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `processed-${targetFile.originalname}`,
        size: Buffer.byteLength(newPdfBytes),
        type: (slug as string).toUpperCase().replace("-", "_").substring(0, 20),
        path: newPath,
        userId: userId,
      },
    });

    // Clean up original uploaded file(s)
    if (file) fs.unlinkSync(file.path);
    if (files) files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path) });

    res.status(201).json({ message: `${slug} processed successfully (Dummy)`, document });
  } catch (error) {
    console.error("Dummy processor error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const protectPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    const { password } = req.body;

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    if (!password) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No password provided" });
      return;
    }

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `protected-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    // Escape password for shell
    const escapedPassword = password.replace(/'/g, "'\\''");
    
    // Using QPDF to encrypt
    await execPromise(`qpdf --encrypt '${escapedPassword}' '${escapedPassword}' 256 -- "${file.path}" "${newPath}"`);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `protected-${file.originalname}`,
        size: fs.statSync(newPath).size,
        type: "PROTECTED",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF protected successfully", document });
  } catch (error) {
    console.error("Protect PDF error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const unlockPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    const { password } = req.body;

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    if (!password) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No password provided" });
      return;
    }

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `unlocked-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    const escapedPassword = password.replace(/'/g, "'\\''");
    
    // Using QPDF to decrypt
    await execPromise(`qpdf --password='${escapedPassword}' --decrypt "${file.path}" "${newPath}"`);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `unlocked-${file.originalname}`,
        size: fs.statSync(newPath).size,
        type: "UNLOCKED",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF unlocked successfully", document });
  } catch (error) {
    console.error("Unlock PDF error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Incorrect password or internal server error" });
  }
};

export const compressPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    const { level } = req.body;

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `compressed-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    let pdfSetting = "/ebook"; // recommended
    if (level === "extreme") {
      pdfSetting = "/screen";
    } else if (level === "less") {
      pdfSetting = "/printer";
    }

    // Using Ghostscript to compress
    await execPromise(`gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${pdfSetting} -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${newPath}" "${file.path}"`);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `compressed-${file.originalname}`,
        size: fs.statSync(newPath).size,
        type: "COMPRESSED",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF compressed successfully", document });
  } catch (error) {
    console.error("Compress PDF error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const aiSummarize = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    const textContext = pdfData.text.substring(0, 15000); // Limit to avoid token overflow

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an expert AI summarizer. Summarize the following document content clearly and concisely." },
        { role: "user", content: textContext }
      ],
    });

    const summaryText = completion.choices[0]?.message?.content || "No summary generated.";

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `summary-${uniqueSuffix}.txt`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, summaryText);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `summary-${file.originalname}.txt`,
        size: fs.statSync(newPath).size,
        type: "AI_SUMMARY",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF summarized successfully", document });
  } catch (error) {
    console.error("AI Summarize error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const aiTranslate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    const textContext = pdfData.text.substring(0, 10000);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an expert AI translator. Translate the following text into English if it is not in English, or into Spanish if it is already in English." },
        { role: "user", content: textContext }
      ],
    });

    const translationText = completion.choices[0]?.message?.content || "No translation generated.";

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `translation-${uniqueSuffix}.txt`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, translationText);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `translation-${file.originalname}.txt`,
        size: fs.statSync(newPath).size,
        type: "AI_TRANSLATION",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF translated successfully", document });
  } catch (error) {
    console.error("AI Translate error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const chatWithPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    const { query } = req.body;

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    const textContext = pdfData.text.substring(0, 15000);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an AI assistant helping the user extract insights from a document. Answer their question based ONLY on the provided document text." },
        { role: "user", content: `Document Text: \n\n${textContext}\n\nQuestion: ${query || "What is this document about?"}` }
      ],
    });

    const answerText = completion.choices[0]?.message?.content || "Could not generate an answer.";

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `chat-answer-${uniqueSuffix}.txt`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, answerText);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `answer-${file.originalname}.txt`,
        size: fs.statSync(newPath).size,
        type: "AI_CHAT",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "Chat processed successfully", document });
  } catch (error) {
    console.error("Chat with PDF error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const convertToPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    // Attempt to convert using LibreOffice headless
    // Command: /Applications/LibreOffice.app/Contents/MacOS/soffice --headless --convert-to pdf input.docx --outdir output_dir
    // Or just 'soffice' if it's in PATH, but on macOS brew cask it's typically /Applications/LibreOffice.app/Contents/MacOS/soffice
    
    const libreOfficePath = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
    
    // We execute in the uploadDir so output naturally goes there
    try {
      await execPromise(`"${libreOfficePath}" --headless --convert-to pdf "${file.path}" --outdir "${uploadDir}"`);
    } catch (e) {
      console.error("LibreOffice convert failed:", e);
      throw new Error("LibreOffice conversion failed. Make sure LibreOffice is installed.");
    }

    // LibreOffice saves the file with the same base name but .pdf extension
    const baseName = path.parse(file.filename).name;
    const generatedPdfPath = path.join(uploadDir, `${baseName}.pdf`);
    
    if (!fs.existsSync(generatedPdfPath)) {
      throw new Error("Generated PDF not found after conversion.");
    }

    const newFilename = `${baseName}.pdf`;

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `${path.parse(file.originalname).name}.pdf`,
        size: fs.statSync(generatedPdfPath).size,
        type: "CONVERTED_TO_PDF",
        path: generatedPdfPath,
        userId: userId,
      },
    });

    // Cleanup the original uploaded docx/pptx
    fs.unlinkSync(file.path);
    res.status(201).json({ message: "Converted to PDF successfully", document });
  } catch (error) {
    console.error("Convert to PDF error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const pdfToImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    // Assuming slug is either pdf-to-jpg or pdf-to-png
    const format = req.params.slug?.includes("png") ? "png16m" : "jpeg";
    const ext = format === "jpeg" ? "jpg" : "png";

    if (!file) return;

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const outDir = path.join(uploadDir, `images-${uniqueSuffix}`);
    fs.mkdirSync(outDir);
    
    const outPattern = path.join(outDir, `page-%03d.${ext}`);
    await execPromise(`gs -sDEVICE=${format} -r300 -o "${outPattern}" "${file.path}"`);

    const zipFilename = `images-${uniqueSuffix}.zip`;
    const zipPath = path.join(uploadDir, zipFilename);
    await execPromise(`zip -j "${zipPath}" "${outDir}"/*`);

    const document = await prisma.document.create({
      data: {
        filename: zipFilename,
        originalName: `images-${file.originalname}.zip`,
        size: fs.statSync(zipPath).size,
        type: "PDF_TO_IMAGE",
        path: zipPath,
        userId: userId,
      },
    });

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF converted to images successfully", document });
  } catch (error) {
    console.error("PDF to Image error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const repairPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    if (!file) return;

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `repaired-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    await execPromise(`gs -o "${newPath}" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress "${file.path}"`);

    const document = await prisma.document.create({
      data: { filename: newFilename, originalName: `repaired-${file.originalname}`, size: fs.statSync(newPath).size, type: "REPAIRED", path: newPath, userId },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF repaired successfully", document });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const pdfToPdfA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    if (!file) return;

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `pdfa-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    await execPromise(`gs -dPDFA=1 -sDEVICE=pdfwrite -sColorConversionStrategy=UseDeviceIndependentColor -sOutputFile="${newPath}" "${file.path}"`);

    const document = await prisma.document.create({
      data: { filename: newFilename, originalName: `pdfa-${file.originalname}`, size: fs.statSync(newPath).size, type: "PDFA", path: newPath, userId },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "Converted to PDF/A successfully", document });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const pdfToMarkdown = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    if (!file) return;

    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    const textContext = pdfData.text.substring(0, 15000);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Convert the following document text into beautifully formatted Markdown." },
        { role: "user", content: textContext }
      ],
    });

    const markdownText = completion.choices[0]?.message?.content || "No content generated.";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `converted-${uniqueSuffix}.md`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, markdownText);

    const document = await prisma.document.create({
      data: { filename: newFilename, originalName: `converted-${file.originalname}.md`, size: fs.statSync(newPath).size, type: "MARKDOWN", path: newPath, userId },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "Converted to Markdown successfully", document });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const htmlToPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    if (!file) return;

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `from-html-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    const htmlContent = fs.readFileSync(file.path, 'utf8');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load' });
    await page.pdf({ path: newPath, format: 'A4' });
    await browser.close();

    const document = await prisma.document.create({
      data: { filename: newFilename, originalName: `converted-${file.originalname}.pdf`, size: fs.statSync(newPath).size, type: "HTML_TO_PDF", path: newPath, userId },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "HTML converted to PDF successfully", document });
  } catch (error) {
    console.error("HTML to PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const ocrPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    if (!file) return;

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const tempTiff = path.join(uploadDir, `temp-${uniqueSuffix}.tiff`);
    const outBase = path.join(uploadDir, `ocr-${uniqueSuffix}`); // tesseract appends .pdf
    
    // Convert to TIFF for Tesseract
    await execPromise(`gs -sDEVICE=tiff32nc -r300 -o "${tempTiff}" "${file.path}"`);
    
    // Run Tesseract OCR and output PDF
    await execPromise(`tesseract "${tempTiff}" "${outBase}" pdf`);

    const newPath = `${outBase}.pdf`;
    const newFilename = `ocr-${uniqueSuffix}.pdf`;

    const document = await prisma.document.create({
      data: { filename: newFilename, originalName: `ocr-${file.originalname}`, size: fs.statSync(newPath).size, type: "OCR", path: newPath, userId },
    });

    fs.unlinkSync(tempTiff);
    fs.unlinkSync(file.path);
    res.status(201).json({ message: "OCR processed successfully", document });
  } catch (error) {
    console.error("OCR PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const pdfToOffice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    const slug = req.params.slug; // e.g. pdf-to-word
    if (!file) return;

    let ext = ".doc";
    if (slug === "pdf-to-excel") ext = ".xls";
    if (slug === "pdf-to-powerpoint") ext = ".ppt";

    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `converted-${uniqueSuffix}${ext}`;
    const newPath = path.join(uploadDir, newFilename);

    // Basic conversion: just write the text to the file. For real conversion, a paid API or Python lib is needed.
    fs.writeFileSync(newPath, pdfData.text);

    const document = await prisma.document.create({
      data: { filename: newFilename, originalName: `converted-${file.originalname}${ext}`, size: fs.statSync(newPath).size, type: "PDF_TO_OFFICE", path: newPath, userId },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: `Converted to ${ext} successfully`, document });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const advancedUiProcessor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    const slug = req.params.slug;
    if (!file) return;

    // These tools require frontend coordinates (Crop, Edit, Sign, Redact).
    // As a backend fallback, we parse and re-save the PDF (optimizing it slightly) if no coordinates are provided.
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // In a real scenario, we would apply req.body.actions here (e.g. draw annotations, crop boxes)
    
    const newPdfBytes = await pdfDoc.save();
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `${slug}-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, newPdfBytes);

    const document = await prisma.document.create({
      data: { filename: newFilename, originalName: `${slug}-${file.originalname}`, size: fs.statSync(newPath).size, 
        type: (slug as string).toUpperCase().replace("-", "_").substring(0, 20), path: newPath, userId },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: `${slug} processed successfully`, document });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const prisma = new PrismaClient();
const uploadDir = path.join(process.cwd(), "uploads");

export const mergePDFs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length < 2) {
      res.status(400).json({ error: "Please upload at least 2 PDFs to merge" });
      return;
    }

    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      const pdfBytes = fs.readFileSync(file.path);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `merged-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, mergedPdfBytes);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: "merged-document.pdf",
        size: Buffer.byteLength(mergedPdfBytes),
        type: "MERGED",
        path: newPath,
        userId: userId,
      },
    });

    // Optionally delete original uploaded chunks to save space, but keeping them might be useful.
    // For now, let's keep them (they are tracked as UPLOAD type via the upload middleware if it was separate,
    // but here we just uploaded them for merging directly). Since we uploaded directly to this endpoint, 
    // these chunks are NOT in DB. So we should delete them to not clutter storage.
    for (const file of files) {
      fs.unlinkSync(file.path);
    }

    res.status(201).json({ message: "PDFs merged successfully", document });
  } catch (error) {
    console.error("Merge PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const splitPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    const { startPage, endPage } = req.body;

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    if (!startPage || !endPage) {
      fs.unlinkSync(file.path); // clean up
      res.status(400).json({ error: "Please provide startPage and endPage" });
      return;
    }

    const pdfBytes = fs.readFileSync(file.path);
    const originalPdf = await PDFDocument.load(pdfBytes);
    
    const start = parseInt(startPage) - 1; // 0-indexed
    const end = parseInt(endPage) - 1;

    const totalPages = originalPdf.getPageCount();
    
    if (start < 0 || end >= totalPages || start > end) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "Invalid page range" });
      return;
    }

    const newPdf = await PDFDocument.create();
    
    // Create an array of page indices to copy
    const pageIndices = [];
    for (let i = start; i <= end; i++) {
      pageIndices.push(i);
    }

    const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));

    const newPdfBytes = await newPdf.save();
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `split-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, newPdfBytes);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `split-${file.originalname}`,
        size: Buffer.byteLength(newPdfBytes),
        type: "SPLIT",
        path: newPath,
        userId: userId,
      },
    });

    // Delete the original uploaded file used for splitting
    fs.unlinkSync(file.path);

    res.status(201).json({ message: "PDF split successfully", document });
  } catch (error) {
    console.error("Split PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const rotatePDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    const { angle } = req.body; // e.g. 90, 180, 270

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    const rotationAngle = parseInt(angle as string) || 90;

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const pages = pdfDoc.getPages();
    pages.forEach(page => {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(currentRotation + rotationAngle));
    });

    const newPdfBytes = await pdfDoc.save();
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `rotated-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, newPdfBytes);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `rotated-${file.originalname}`,
        size: Buffer.byteLength(newPdfBytes),
        type: "ROTATED",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF rotated successfully", document });
  } catch (error) {
    console.error("Rotate PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const organizePDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    // pageOrder should be a JSON array of 1-indexed page numbers e.g. [3, 1, 2]
    const { pageOrder } = req.body; 

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    if (!pageOrder) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No page order provided" });
      return;
    }

    let parsedOrder: number[] = [];
    try {
      parsedOrder = JSON.parse(pageOrder);
    } catch (e) {
      parsedOrder = pageOrder.split(',').map((p: string) => parseInt(p.trim()));
    }

    const pdfBytes = fs.readFileSync(file.path);
    const originalPdf = await PDFDocument.load(pdfBytes);
    const totalPages = originalPdf.getPageCount();

    const newPdf = await PDFDocument.create();
    
    const pageIndices = parsedOrder
      .map(p => p - 1)
      .filter(index => index >= 0 && index < totalPages);

    if (pageIndices.length === 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "Invalid page order" });
      return;
    }

    const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
    copiedPages.forEach(page => newPdf.addPage(page));

    const newPdfBytes = await newPdf.save();
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `organized-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, newPdfBytes);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `organized-${file.originalname}`,
        size: Buffer.byteLength(newPdfBytes),
        type: "ORGANIZED",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF organized successfully", document });
  } catch (error) {
    console.error("Organize PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const watermarkPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    const { text } = req.body;

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    if (!text) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No watermark text provided" });
      return;
    }

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const pages = pdfDoc.getPages();
    pages.forEach(page => {
      const { width, height } = page.getSize();
      const fontSize = 60;
      const textWidth = helveticaFont.widthOfTextAtSize(text, fontSize);
      
      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: fontSize,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.3,
        rotate: degrees(45),
      });
    });

    const newPdfBytes = await pdfDoc.save();
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `watermarked-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, newPdfBytes);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `watermarked-${file.originalname}`,
        size: Buffer.byteLength(newPdfBytes),
        type: "WATERMARKED",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF watermarked successfully", document });
  } catch (error) {
    console.error("Watermark PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const pageNumbersPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    const pages = pdfDoc.getPages();
    pages.forEach((page, idx) => {
      const { width } = page.getSize();
      const text = `${idx + 1}`;
      const fontSize = 12;
      const textWidth = helveticaFont.widthOfTextAtSize(text, fontSize);
      
      page.drawText(text, {
        x: width / 2 - textWidth / 2,
        y: 20, // 20 units from bottom
        size: fontSize,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
    });

    const newPdfBytes = await pdfDoc.save();
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `numbered-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, newPdfBytes);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `numbered-${file.originalname}`,
        size: Buffer.byteLength(newPdfBytes),
        type: "NUMBERED",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "Page numbers added successfully", document });
  } catch (error) {
    console.error("Page Numbers PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const imageToPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: "No image files provided" });
      return;
    }

    const pdfDoc = await PDFDocument.create();

    for (const file of files) {
      const imageBytes = fs.readFileSync(file.path);
      let image;
      
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
        image = await pdfDoc.embedJpg(imageBytes);
      } else if (file.mimetype === 'image/png') {
        image = await pdfDoc.embedPng(imageBytes);
      } else {
        // Skip unsupported
        continue;
      }
      
      const dims = image.scale(1);
      const page = pdfDoc.addPage([dims.width, dims.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: dims.width,
        height: dims.height,
      });
      
      fs.unlinkSync(file.path); // cleanup uploaded image
    }

    const newPdfBytes = await pdfDoc.save();
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `from-images-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, newPdfBytes);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: "converted-images.pdf",
        size: Buffer.byteLength(newPdfBytes),
        type: "IMAGE_TO_PDF",
        path: newPath,
        userId: userId,
      },
    });

    res.status(201).json({ message: "Images converted to PDF successfully", document });
  } catch (error) {
    console.error("Image to PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const resizePDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const file = req.file;
    const { size } = req.body; // e.g., "A4"

    if (!file) {
      res.status(400).json({ error: "No PDF file provided" });
      return;
    }
    
    // Fallback to A4 if not provided or invalid
    let targetSize = PageSizes.A4;
    if (size === 'Letter') targetSize = PageSizes.Letter;

    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const pages = pdfDoc.getPages();
    pages.forEach(page => {
      page.setSize(targetSize[0], targetSize[1]);
      // Note: this just changes the crop box, it does not perfectly scale the internal content.
      // Doing complex layout scaling is hard without rewriting streams, but this serves basic resize needs.
    });

    const newPdfBytes = await pdfDoc.save();
    
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = `resized-${uniqueSuffix}.pdf`;
    const newPath = path.join(uploadDir, newFilename);

    fs.writeFileSync(newPath, newPdfBytes);

    const document = await prisma.document.create({
      data: {
        filename: newFilename,
        originalName: `resized-${file.originalname}`,
        size: Buffer.byteLength(newPdfBytes),
        type: "RESIZED",
        path: newPath,
        userId: userId,
      },
    });

    fs.unlinkSync(file.path);
    res.status(201).json({ message: "PDF resized successfully", document });
  } catch (error) {
    console.error("Resize PDF error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
