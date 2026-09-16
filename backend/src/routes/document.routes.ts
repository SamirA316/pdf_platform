import express from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { uploadMiddleware } from "../middlewares/upload.middleware";
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
  downloadDocument,
} from "../controllers/document.controller";

const router = express.Router();

router.post("/upload", requireAuth, uploadMiddleware.single("file"), uploadDocument);
router.get("/", requireAuth, getDocuments);
router.delete("/:id", requireAuth, deleteDocument);
router.get("/download/:id", requireAuth, downloadDocument);

export default router;
