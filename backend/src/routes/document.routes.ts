import express from "express";
import { requireStrictAuth } from "../middlewares/auth.middleware";
import { uploadMiddleware } from "../middlewares/upload.middleware";
import {
  uploadDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  downloadDocument,
} from "../controllers/document.controller";

const router = express.Router();

router.post("/upload", requireStrictAuth, uploadMiddleware.single("file"), uploadDocument);
router.get("/", requireStrictAuth, getDocuments);
router.get("/:id", requireStrictAuth, getDocumentById);
router.get("/download/:id", requireStrictAuth, downloadDocument);
router.get("/:id/download", requireStrictAuth, downloadDocument);
router.delete("/:id", requireStrictAuth, deleteDocument);

export default router;
