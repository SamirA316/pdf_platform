import multer from "multer";
import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";

const uploadDir = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, (file.fieldname || "file") + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg", ".jpeg", ".png", ".webp",
  ".doc", ".docx",
  ".xls", ".xlsx",
  ".ppt", ".pptx",
  ".html", ".htm", ".txt",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/html",
  "text/plain",
  "application/octet-stream",
]);

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`INVALID_EXTENSION: File extension '${ext}' is not supported. Allowed: PDF, Images, Office & Text documents.`));
  }

  // NOTE [Phase 0 Known Limitation]:
  // Current: Extension + MIME allowlist.
  // Limitation: Because ALLOWED_EXTENSIONS was checked above, this condition currently permits
  // an allowed extension even when MIME mismatches or is generic (e.g., application/octet-stream).
  // Planned: Deep magic-byte file signature validation in Security Phase.
  if (!ALLOWED_MIME_TYPES.has(mime) && !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`INVALID_MIME: MIME type '${mime}' is not permitted.`));
  }

  cb(null, true);
};

export const uploadMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 20, // Max 20 files per batch
  },
});

/**
 * Universal flexible upload middleware that accepts any field name ('file', 'files', etc.)
 * and normalizes req.file and req.files so that every controller works without field-mismatch errors.
 *
 * NOTE [Phase 0 Technical Debt]:
 * uploadMiddleware.any() currently accepts any multipart field name ('file', 'files', 'xyz', etc.).
 * Retained in Phase 0 to avoid breaking existing frontend tool payloads.
 * Strict tool-specific upload validation will replace this in Phase 2.
 */
export const flexibleUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadMiddleware.any()(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err);
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "FILE_TOO_LARGE", message: "File exceeds the 100MB size limit." });
        }
        return res.status(400).json({ error: "UPLOAD_LIMIT_ERROR", message: err.message });
      }
      return res.status(400).json({ error: "UPLOAD_VALIDATION_ERROR", message: err.message || "File upload failed" });
    }

    // Normalize req.file and req.files
    const files = req.files as Express.Multer.File[] | undefined;
    if (files && Array.isArray(files) && files.length > 0) {
      if (!req.file) {
        req.file = files[0];
      }
    } else if (req.file && (!files || files.length === 0)) {
      req.files = [req.file];
    }

    next();
  });
};
