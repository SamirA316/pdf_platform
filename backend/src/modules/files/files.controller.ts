import fs from "fs";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { filesService } from "./files.service";
import { sendSuccess } from "../../common/responses/apiResponse";
import { FileRequiredError, UnauthorizedError } from "../../common/errors/AppError";

export class FilesController {
  /**
   * POST /api/v1/files
   * Handles single PDF upload and records database entry.
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

      // Multer stores into uploads/users/{userId}/{filename}
      const storageKey = `users/${userId}/${file.filename}`;

      let createdFile;
      try {
        createdFile = await filesService.createFile(
          userId,
          file.originalname,
          storageKey,
          file.mimetype || "application/pdf",
          file.size
        );
      } catch (dbErr) {
        // Atomic cleanup: remove physical file if database record creation fails
        if (file.path && fs.existsSync(file.path)) {
          try {
            await fs.promises.unlink(file.path);
          } catch (unlinkErr) {
            console.warn("Failed to unlink orphan file after DB failure:", unlinkErr);
          }
        }
        throw dbErr;
      }

      sendSuccess(res, { file: createdFile }, 201);
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
   */
  async downloadFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const fileId = String(req.params.id);
      const downloadData = await filesService.getFileDownloadData(userId, fileId);
      res.download(downloadData.physicalPath, downloadData.originalName);
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
