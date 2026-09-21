import express from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { flexibleUpload } from "../middlewares/upload.middleware";
import {
  mergePDFs,
  splitPDF,
  rotatePDF,
  organizePDF,
  watermarkPDF,
  pageNumbersPDF,
  imageToPDF,
  resizePDF,
  dummyProcessor,
  protectPDF,
  unlockPDF,
  compressPDF,
  aiSummarize,
  aiTranslate,
  chatWithPdf,
  convertToPdf,
  pdfToImage,
  repairPdf,
  pdfToPdfA,
  pdfToMarkdown,
  htmlToPdf,
  ocrPdf,
  ocrCrop,
  pdfToOffice,
  advancedUiProcessor,
} from "../controllers/pdf.controller";

const router = express.Router();

router.post("/ocr-crop", ocrCrop);

router.post("/merge", requireAuth, flexibleUpload, mergePDFs);
router.post("/split", requireAuth, flexibleUpload, splitPDF);
router.post("/rotate", requireAuth, flexibleUpload, rotatePDF);
router.post("/organize", requireAuth, flexibleUpload, organizePDF);
router.post("/watermark", requireAuth, flexibleUpload, watermarkPDF);
router.post("/page-numbers", requireAuth, flexibleUpload, pageNumbersPDF);
router.post("/image-to-pdf", requireAuth, flexibleUpload, imageToPDF);
router.post("/resize", requireAuth, flexibleUpload, resizePDF);

// Phase 1 & 2 endpoints
router.post("/protect", requireAuth, flexibleUpload, protectPDF);
router.post("/unlock", requireAuth, flexibleUpload, unlockPDF);
router.post("/compress", requireAuth, flexibleUpload, compressPDF);

// Phase 3 & 4 endpoints
router.post("/summarize", requireAuth, flexibleUpload, aiSummarize);
router.post("/translate", requireAuth, flexibleUpload, aiTranslate);
router.post("/chat", requireAuth, flexibleUpload, chatWithPdf);
router.post("/convert-to-pdf", requireAuth, flexibleUpload, convertToPdf);

// Phase 5 endpoints
router.post("/pdf-to-image/:slug", requireAuth, flexibleUpload, pdfToImage);
router.post("/repair", requireAuth, flexibleUpload, repairPdf);
router.post("/pdfa", requireAuth, flexibleUpload, pdfToPdfA);
router.post("/markdown", requireAuth, flexibleUpload, pdfToMarkdown);
router.post("/html-to-pdf", requireAuth, flexibleUpload, htmlToPdf);
router.post("/ocr", requireAuth, flexibleUpload, ocrPdf);

// Final Complex/UI tools
router.post("/export/:slug", requireAuth, flexibleUpload, pdfToOffice);
router.post("/ui/:slug", requireAuth, flexibleUpload, advancedUiProcessor);

// Catch-all route for any unrecognized tool
router.post("/:slug", requireAuth, flexibleUpload, dummyProcessor);

export default router;
