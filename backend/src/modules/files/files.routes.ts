import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireStrictAuth, AuthRequest } from "../../middlewares/auth.middleware";
import { filesController } from "./files.controller";
import { UnsupportedFormatError } from "../../common/errors/AppError";

const router = Router();

// Configure storage for uploads/users/{userId}/
const fileStorage = multer.diskStorage({
  destination: (req: AuthRequest, file, cb) => {
    const userId = req.userId || "anonymous";
    const userDir = path.join(process.cwd(), "uploads", "users", userId);

    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const randomHex = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".pdf", ".png", ".jpg", ".jpeg"].includes(ext) ? ext : ".pdf";
    cb(null, `file_${randomHex}${safeExt}`);
  },
});

const pdfOnlyFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  const allowImage =
    req.query?.type === "image" ||
    req.query?.allowImages === "true" ||
    req.headers?.["x-allow-image"] === "true";

  if (allowImage) {
    const isImage =
      [".png", ".jpg", ".jpeg"].includes(ext) &&
      ["image/png", "image/jpeg", "image/jpg"].includes(mime);
    const isPdf = ext === ".pdf" && mime === "application/pdf";
    if (!isImage && !isPdf) {
      return cb(
        new UnsupportedFormatError("Allowed formats: .png, .jpg, .jpeg, .pdf")
      );
    }
    return cb(null, true);
  }

  if (ext !== ".pdf" || mime !== "application/pdf") {
    return cb(new UnsupportedFormatError("Only PDF files are supported. Allowed MIME: application/pdf, extension: .pdf"));
  }

  cb(null, true);
};

const upload = multer({
  storage: fileStorage,
  fileFilter: pdfOnlyFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1, // Single file upload for /api/v1/files
  },
});

/**
 * File Management Routes (/api/v1/files)
 */

// 1. Upload file
router.post(
  "/",
  requireStrictAuth,
  upload.single("file"),
  (req, res, next) => filesController.uploadFile(req, res, next)
);

// 2. List user files
router.get(
  "/",
  requireStrictAuth,
  (req, res, next) => filesController.listUserFiles(req, res, next)
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
