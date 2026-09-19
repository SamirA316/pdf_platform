import express from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { uploadMiddleware } from "../middlewares/upload.middleware";
import { mergePDFs, splitPDF, rotatePDF, organizePDF, watermarkPDF, pageNumbersPDF, imageToPDF, resizePDF, dummyProcessor, protectPDF, unlockPDF, compressPDF, aiSummarize, aiTranslate, chatWithPdf, convertToPdf, pdfToImage, repairPdf, pdfToPdfA, pdfToMarkdown, htmlToPdf, ocrPdf, pdfToOffice, advancedUiProcessor } from "../controllers/pdf.controller";

const router = express.Router();

router.post("/merge", requireAuth, uploadMiddleware.array("files", 10), mergePDFs);
router.post("/split", requireAuth, uploadMiddleware.single("file"), splitPDF);
router.post("/rotate", requireAuth, uploadMiddleware.single("file"), rotatePDF);
router.post("/organize", requireAuth, uploadMiddleware.single("file"), organizePDF);
router.post("/watermark", requireAuth, uploadMiddleware.single("file"), watermarkPDF);
router.post("/page-numbers", requireAuth, uploadMiddleware.single("file"), pageNumbersPDF);
router.post("/image-to-pdf", requireAuth, uploadMiddleware.array("files", 10), imageToPDF);
router.post("/resize", requireAuth, uploadMiddleware.single("file"), resizePDF);

// New Phase 1 & 2 endpoints
router.post("/protect", requireAuth, uploadMiddleware.single("file"), protectPDF);
router.post("/unlock", requireAuth, uploadMiddleware.single("file"), unlockPDF);
router.post("/compress", requireAuth, uploadMiddleware.single("file"), compressPDF);

// New Phase 3 & 4 endpoints
router.post("/summarize", requireAuth, uploadMiddleware.single("file"), aiSummarize);
router.post("/translate", requireAuth, uploadMiddleware.single("file"), aiTranslate);
router.post("/chat", requireAuth, uploadMiddleware.single("file"), chatWithPdf);
router.post("/convert-to-pdf", requireAuth, uploadMiddleware.single("file"), convertToPdf);

// New Phase 5 endpoints
router.post("/pdf-to-image/:slug", requireAuth, uploadMiddleware.single("file"), pdfToImage);
router.post("/repair", requireAuth, uploadMiddleware.single("file"), repairPdf);
router.post("/pdfa", requireAuth, uploadMiddleware.single("file"), pdfToPdfA);
router.post("/markdown", requireAuth, uploadMiddleware.single("file"), pdfToMarkdown);
router.post("/html-to-pdf", requireAuth, uploadMiddleware.single("file"), htmlToPdf);
router.post("/ocr", requireAuth, uploadMiddleware.single("file"), ocrPdf);

// Final 9 Complex/UI tools
router.post("/export/:slug", requireAuth, uploadMiddleware.single("file"), pdfToOffice);
router.post("/ui/:slug", requireAuth, uploadMiddleware.single("file"), advancedUiProcessor);

// Catch-all dummy route for any unrecognized tool
router.post("/:slug", requireAuth, uploadMiddleware.any(), dummyProcessor);

export default router;
