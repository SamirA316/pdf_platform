import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { PDFDocument, degrees, rgb, StandardFonts, PageSizes } from "pdf-lib";
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
