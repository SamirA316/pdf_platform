import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import path from "path";
import fs from "fs";
import { AuthRequest } from "./auth.controller";

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
