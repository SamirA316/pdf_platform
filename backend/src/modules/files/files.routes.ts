import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireStrictAuth, AuthRequest } from "../../middlewares/auth.middleware";
import { filesController } from "./files.controller";
import { BadRequestError, UnsupportedFormatError } from "../../common/errors/AppError";

import { storageService } from "./storage.service";
import { verifyFileMagicBytes, EXT_MIME_MAP, fileFilter } from "../../middlewares/upload.middleware";
import { getMaxFileSizeBytes } from "./files.constants";

const router = Router();

// Configure storage for uploads/users/{userId}/ via centralized storageService
const fileStorage = multer.diskStorage({
  destination: (req: AuthRequest, file, cb) => {
    try {
      const userDir = storageService.getUserStorageDir(req.userId || "anonymous");
      cb(null, userDir);
    } catch (err: any) {
      cb(err, "");
    }
  },
  filename: (req, file, cb) => {
    const randomHex = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = EXT_MIME_MAP[ext] ? ext : ".pdf";
    cb(null, `file_${randomHex}${safeExt}`);
  },
});

export const uploadSingleFile = (req: any, res: any, next: any) => {
  multer({
    storage: fileStorage,
    fileFilter: fileFilter,
    limits: {
      fileSize: getMaxFileSizeBytes(),
      files: 1, // Single file upload for /api/v1/files
    },
  }).single("file")(req, res, (err: any) => {
    if (err) return next(err);
    if (req.file) {
      if (req.file.size === 0) {
        if (fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch {}
        }
        return next(new BadRequestError("Uploaded file cannot be empty (0 bytes).", "EMPTY_FILE"));
      }
      const ext = path.extname(req.file.originalname).toLowerCase();
      const isValid = verifyFileMagicBytes(req.file.path, ext);
      if (!isValid) {
        if (fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch {}
        }
        return next(new UnsupportedFormatError(`File does not contain valid magic signature for '${ext}'.`));
      }
    }
    next();
  });
};

/**
 * File Management Routes (/api/v1/files)
 */

// 1. Upload file
router.post(
  "/",
  requireStrictAuth,
  uploadSingleFile,
  (req, res, next) => filesController.uploadFile(req, res, next)
);

// 2. List user files
router.get(
  "/",
  requireStrictAuth,
  (req, res, next) => filesController.listUserFiles(req, res, next)
);

// 2b. Storage Quota & Usage (Phase 2.6E)
router.get(
  "/quota",
  requireStrictAuth,
  (req, res, next) => filesController.getUserQuota(req, res, next)
);

router.get(
  "/storage",
  requireStrictAuth,
  (req, res, next) => filesController.getUserQuota(req, res, next)
);

// 3. Get single file metadata
router.get(
  "/:id",
  requireStrictAuth,
  (req, res, next) => filesController.getFileDetails(req, res, next)
);

// 4. Secure download
router.get(
  "/:id/download",
  requireStrictAuth,
  (req, res, next) => filesController.downloadFile(req, res, next)
);

// 5. Rename file
router.patch(
  "/:id",
  requireStrictAuth,
  (req, res, next) => filesController.renameFile(req, res, next)
);

// 6. Delete file
router.delete(
  "/:id",
  requireStrictAuth,
  (req, res, next) => filesController.deleteFile(req, res, next)
);

export default router;
