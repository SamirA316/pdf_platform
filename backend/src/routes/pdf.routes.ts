import express from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { uploadMiddleware } from "../middlewares/upload.middleware";
import { mergePDFs, splitPDF, rotatePDF, organizePDF, watermarkPDF, pageNumbersPDF, imageToPDF, resizePDF } from "../controllers/pdf.controller";

const router = express.Router();

router.post("/merge", requireAuth, uploadMiddleware.array("files", 10), mergePDFs);
router.post("/split", requireAuth, uploadMiddleware.single("file"), splitPDF);
router.post("/rotate", requireAuth, uploadMiddleware.single("file"), rotatePDF);
router.post("/organize", requireAuth, uploadMiddleware.single("file"), organizePDF);
router.post("/watermark", requireAuth, uploadMiddleware.single("file"), watermarkPDF);
router.post("/page-numbers", requireAuth, uploadMiddleware.single("file"), pageNumbersPDF);
router.post("/image-to-pdf", requireAuth, uploadMiddleware.array("files", 10), imageToPDF);
router.post("/resize", requireAuth, uploadMiddleware.single("file"), resizePDF);

export default router;
