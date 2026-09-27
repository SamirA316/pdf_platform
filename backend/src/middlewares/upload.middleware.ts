import multer from "multer";
import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";
import { storageService } from "../modules/files/storage.service";
import { getMaxFileSizeBytes } from "../modules/files/files.constants";
import { UnsupportedFormatError } from "../common/errors/AppError";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = storageService.getStorageRoot();
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, (file.fieldname || "file") + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// Strict Extension to Permitted MIME Types mapping (Launch Plan Item 6)
const EXT_MIME_MAP: Record<string, string[]> = {
  ".pdf": ["application/pdf", "application/x-pdf"],
  ".jpg": ["image/jpeg", "image/pjpeg"],
  ".jpeg": ["image/jpeg", "image/pjpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".txt": ["text/plain"],
  ".html": ["text/html"],
  ".htm": ["text/html"],
};

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || "").toLowerCase().trim();

  const allowedMimes = EXT_MIME_MAP[ext];
  if (!allowedMimes) {
    return cb(new Error(`INVALID_EXTENSION: File extension '${ext}' is not supported. Allowed: PDF, Images, Office & Text documents.`));
  }

  // Both extension AND MIME must match the valid pair (prevents evil.pdf with text/html)
  if (!allowedMimes.includes(mime)) {
    return cb(new Error(`INVALID_MIME: MIME type '${mime}' is not permitted for extension '${ext}'.`));
  }

  cb(null, true);
};

/**
 * Validates magic-byte signatures of uploaded files on disk (Launch Plan Item 7).
 * Removes file immediately if spoofed / malicious content is detected.
 */
export function verifyFileMagicBytes(filePath: string, ext: string): boolean {
  if (!fs.existsSync(filePath)) return false;

  const stat = fs.statSync(filePath);
  if (stat.size === 0) return false;

  const buffer = Buffer.alloc(Math.min(1024, stat.size));
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  const normalizedExt = ext.toLowerCase();

  // PDF: %PDF- within the first 1024 bytes (per ISO 32000-1 §7.5.2)
  if (normalizedExt === ".pdf") {
    const sample = buffer.toString("utf-8", 0, Math.min(buffer.length, 1024));
    return sample.includes("%PDF-");
  }

  // JPEG: FF D8 FF
  if (normalizedExt === ".jpg" || normalizedExt === ".jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (normalizedExt === ".png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // Office OOXML (DOCX, XLSX, PPTX) are ZIP containers: 50 4B 03 04
  if ([".docx", ".xlsx", ".pptx"].includes(normalizedExt)) {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  // Plain text / HTML - check for zero null bytes in sample
  if ([".txt", ".html", ".htm"].includes(normalizedExt)) {
    return !buffer.includes(0x00);
  }

  return true;
}

export const uploadMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    get fileSize() {
      return getMaxFileSizeBytes();
    },
    files: 20, // Max 20 files per batch
  },
});

/**
 * Universal flexible upload middleware with post-upload magic-byte verification.
 */
export const flexibleUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadMiddleware.any()(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          const maxBytes = getMaxFileSizeBytes();
          return res.status(413).json({
            error: "FILE_TOO_LARGE",
            message: `File exceeds the allowed size limit of ${maxBytes} bytes.`,
          });
        }
        return res.status(400).json({ error: err.code, message: err.message });
      }
      return res.status(400).json({ error: "UPLOAD_ERROR", message: err.message });
    }

    // Verify magic bytes for all uploaded files
    const files = req.files as Express.Multer.File[] | undefined;
    if (files && files.length > 0) {
      for (const file of files) {
        const ext = path.extname(file.originalname);
        const isValidSignature = verifyFileMagicBytes(file.path, ext);
        if (!isValidSignature) {
          // Clean up all uploaded files in batch
          for (const f of files) {
            if (fs.existsSync(f.path)) {
              try { fs.unlinkSync(f.path); } catch {}
            }
          }
          return res.status(400).json({
            error: "UNSUPPORTED_FORMAT",
            message: `File '${file.originalname}' does not contain a valid file signature for '${ext}'.`,
          });
        }
      }
    }

    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const isValid = verifyFileMagicBytes(req.file.path, ext);
      if (!isValid) {
        if (fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch {}
        }
        return res.status(400).json({
          error: "UNSUPPORTED_FORMAT",
          message: `File '${req.file.originalname}' does not contain a valid file signature for '${ext}'.`,
        });
      }
    }

    next();
  });
};
