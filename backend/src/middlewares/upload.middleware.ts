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

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  cb(null, true);
};

export const uploadMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

/**
 * Universal flexible upload middleware that accepts any field name ('file', 'files', etc.)
 * and normalizes req.file and req.files so that every controller works without field-mismatch errors.
 */
export const flexibleUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadMiddleware.any()(req, res, (err) => {
    if (err) {
      console.error("Multer upload error:", err);
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || "File upload failed" });
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
