import fs from "fs";
import path from "path";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { filesService } from "./files.service";
import { sendSuccess } from "../../common/responses/apiResponse";
import {
  FileRequiredError,
  UnauthorizedError,
  EmptyFileError,
  FileNotFoundError,
  PayloadTooLargeError,
} from "../../common/errors/AppError";
import { getMaxFileSizeBytes } from "./files.constants";
import { logger } from "../../common/logger";

export class FilesController {
  /**
   * POST /api/v1/files
   * Handles single PDF upload and records database entry.
   * Enforces:
   * - E1 & E2: Max individual file size limits (both middleware and controller physical verification)
   * - E3 & E5: Atomic per-user storage quota enforcement and race condition protection
   * - E7: Zero-byte file rejection and immediate temporary file cleanup
   */
  async uploadFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const file = req.file;
      if (!file) {
        throw new FileRequiredError("A PDF file is required in 'file' form field.");
      }

      // Read true physical size from disk (never trust declared client header alone)
      let physicalSize = file.size;
      if (file.path && fs.existsSync(file.path)) {
        try {
          const stat = fs.statSync(file.path);
          physicalSize = stat.size;
        } catch {}
      }

      // Reject empty (0-byte) files
      if (physicalSize === 0) {
        if (file.path && fs.existsSync(file.path)) {
          try {
            await fs.promises.unlink(file.path);
          } catch {}
        }
        throw new EmptyFileError("Uploaded file is empty (0 bytes).");
      }

      // Check per-file size limit (E2)
      const maxFileSize = getMaxFileSizeBytes();
      if (physicalSize > maxFileSize) {
        if (file.path && fs.existsSync(file.path)) {
          try {
            await fs.promises.unlink(file.path);
          } catch {}
        }
        throw new PayloadTooLargeError(`File size exceeds maximum permitted limit of ${maxFileSize} bytes.`);
      }

      // Sanitize originalName against path traversal
      const safeOriginalName = path.basename(file.originalname).replace(/[\r\n\0]/g, "") || "document.pdf";

      // Multer stores into uploads/users/{userId}/{filename}
      const storageKey = `users/${userId}/${file.filename}`;

      // Step 1: Atomic quota reservation (fails immediately if remaining quota insufficient)
      await filesService.reserveQuota(userId, physicalSize);

      let createdFile;
      try {
        // Step 2: Create DB File record
        createdFile = await filesService.createFileRecord(
          userId,
          safeOriginalName,
          storageKey,
          file.mimetype || "application/pdf",
          physicalSize
        );
      } catch (dbErr) {
        // DB creation failed -> Rollback quota reservation immediately (no leak)
        try {
          await filesService.releaseQuota(userId, physicalSize);
        } catch {
          logger.error("Critical: Failed to release quota reservation after DB failure.", "STORAGE");
        }

        // Cleanup physical file on DB failure
        if (file.path && fs.existsSync(file.path)) {
          try {
            await fs.promises.unlink(file.path);
          } catch {
            logger.warn("Failed to unlink orphan file after DB failure.", "STORAGE");
          }
        }
        throw dbErr;
      }

      sendSuccess(res, { file: createdFile }, 201);
    } catch (err) {
      // In case quota reservation itself failed (or initial validation failed):
      // Clean up uploaded physical file from disk so no orphan exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          await fs.promises.unlink(req.file.path);
        } catch {}
      }
      next(err);
    }
  }

  /**
   * GET /api/v1/files/quota
   * Returns storage quota, current usage, and remaining allowance for authenticated user (E6).
   */
  async getUserQuota(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const quotaData = await filesService.getUserStorageQuota(userId);
      sendSuccess(res, quotaData);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/files
   * Lists files for the current authenticated user.
   */
  async listUserFiles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const result = await filesService.listFiles(userId, req.query);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/files/:id
   * Retrieves single file metadata for the authenticated user.
   */
  async getFileDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const fileId = String(req.params.id);
      const file = await filesService.getFileById(userId, fileId);
      sendSuccess(res, { file });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/files/:id
   * Renames a file's originalName.
   */
  async renameFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const fileId = String(req.params.id);
      const updated = await filesService.renameFile(userId, fileId, req.body?.name);
      sendSuccess(res, { file: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/files/:id/download
   * Streams the requested file with Content-Disposition attachment.
   * Enforces:
   * - C1: requireStrictAuth verification & scoped query
   * - C4: Content-Disposition RFC 6266 / RFC 5987 filename injection protection
   * - C5: Safe Content-Type header (application/pdf, no executable MIME)
   * - C8: Zero leakage of physical paths, storage keys, or ENOENT
   * - C9: Range requests support via res.sendFile (206 Partial Content, Accept-Ranges, Content-Range)
   * - C10: Security headers (X-Content-Type-Options: nosniff, Cache-Control private)
   */
  async downloadFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const fileId = String(req.params.id);
      const downloadData = await filesService.getFileDownloadData(userId, fileId);

      // Security Headers (C10)
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      // Content-Disposition with RFC 6266 / RFC 5987 injection protection (C4, C7)
      const disposition = `attachment; filename="${downloadData.safeAsciiName}"; filename*=UTF-8''${downloadData.encodedUtf8Name}`;
      res.setHeader("Content-Disposition", disposition);

      // Content-Type Header (C5)
      res.setHeader("Content-Type", downloadData.mimeType);

      // Expose headers for modern clients
      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Disposition, Content-Length, Content-Range, Accept-Ranges"
      );

      // res.sendFile natively handles Content-Length, Range requests (C9), and efficient streaming
      res.sendFile(
        downloadData.physicalPath,
        {
          headers: {
            "Content-Type": downloadData.mimeType,
            "Content-Disposition": disposition,
            "X-Content-Type-Options": "nosniff",
          },
        },
        (err: any) => {
          if (err) {
            if (res.headersSent) {
              return next(err);
            }
            if (err.status === 416) {
              res.status(416).json({
                success: false,
                error: {
                  code: "RANGE_NOT_SATISFIABLE",
                  message: "Requested range not satisfiable.",
                },
              });
              return;
            }
            // Do not leak internal filesystem path or ENOENT (C8)
            return next(new FileNotFoundError("File not found."));
          }
        }
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/files/:id
   * Deletes physical disk file and database record.
   */
  async deleteFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const fileId = String(req.params.id);
      await filesService.deleteFile(userId, fileId);
      sendSuccess(res, { message: "File deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
}

export const filesController = new FilesController();
