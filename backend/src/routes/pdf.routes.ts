import express from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { uploadMiddleware } from "../middlewares/upload.middleware";
import { mergePDFs, splitPDF } from "../controllers/pdf.controller";

const router = express.Router();

router.post("/merge", requireAuth, uploadMiddleware.array("files", 10), mergePDFs);
router.post("/split", requireAuth, uploadMiddleware.single("file"), splitPDF);

export default router;
