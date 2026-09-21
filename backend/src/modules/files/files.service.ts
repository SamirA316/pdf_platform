import path from "path";
import fs from "fs";
import { prisma } from "../../common/prisma";
import { IFileDto, IFileListQuery, IPaginatedFilesResponse, FileStatus } from "./files.types";
import { FileNotFoundError, FileDeleteFailedError } from "../../common/errors/AppError";
import { validateAndSanitizePdfName, validateFileStatus } from "./files.validation";

export class FilesService {
  /**
   * Helper to format a Prisma File record into a secure public DTO
   * (never exposing storageKey or server filesystem details).
   */
  private toDto(file: any): IFileDto {
    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      status: file.status,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  /**
   * Creates a new file record in the database.
   */
  async createFile(
    userId: string,
    originalName: string,
    storageKey: string,
    mimeType: string,
    size: number
  ): Promise<IFileDto> {
    const file = await prisma.file.create({
      data: {
        userId,
        originalName,
        storageKey,
        mimeType,
        size,
        status: FileStatus.READY,
      },
    });

    return this.toDto(file);
  }

  /**
   * Lists files belonging to the authenticated user with pagination and optional status filter.
   */
  async listFiles(userId: string, query: IFileListQuery): Promise<IPaginatedFilesResponse> {
    const rawPage = parseInt(String(query.page || 1), 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(String(query.limit || 20), 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(100, rawLimit);
    const skip = (page - 1) * limit;

    const whereClause: any = { userId };
    if (query.status) {
      whereClause.status = validateFileStatus(query.status);
    }

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.file.count({ where: whereClause }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      files: files.map((f: any) => this.toDto(f)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves single file metadata strictly verifying ownership.
   */
  async getFileById(userId: string, fileId: string): Promise<IFileDto> {
    if (!fileId || typeof fileId !== "string") {
      throw new FileNotFoundError("File not found.");
    }

    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });

    if (!file) {
      // Do not leak existence if owned by another user
      throw new FileNotFoundError("File not found.");
    }

    return this.toDto(file);
  }

  /**
   * Renames a file's originalName, strictly preserving .pdf extension.
   */
  async renameFile(userId: string, fileId: string, newName?: string): Promise<IFileDto> {
    if (!fileId || typeof fileId !== "string") {
      throw new FileNotFoundError("File not found.");
    }

    const sanitizedName = validateAndSanitizePdfName(newName);

    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });

    if (!file) {
      throw new FileNotFoundError("File not found.");
    }

    const updated = await prisma.file.update({
      where: { id: fileId },
      data: { originalName: sanitizedName },
    });

    return this.toDto(updated);
  }

  /**
   * Retrieves the physical filesystem path and metadata for secure streaming download.
   */
  async getFileDownloadData(
    userId: string,
    fileId: string
  ): Promise<{ physicalPath: string; originalName: string; mimeType: string }> {
    if (!fileId || typeof fileId !== "string") {
      throw new FileNotFoundError("File not found.");
    }

    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });

    if (!file) {
      throw new FileNotFoundError("File not found.");
    }

    const uploadBase = path.resolve(process.cwd(), "uploads");
    const physicalPath = path.resolve(uploadBase, file.storageKey);
    const relativePath = path.relative(uploadBase, physicalPath);

    // Prevent directory traversal outside upload directory
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new FileNotFoundError("Invalid file path.");
    }

    if (!fs.existsSync(physicalPath)) {
      throw new FileNotFoundError("File content not found on server.");
    }

    return {
      physicalPath,
      originalName: file.originalName,
      mimeType: file.mimeType,
    };
  }

  /**
   * Deletes physical disk file and database record.
   */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    if (!fileId || typeof fileId !== "string") {
      throw new FileNotFoundError("File not found.");
    }

    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });

    if (!file) {
      throw new FileNotFoundError("File not found.");
    }

    // Attempt physical deletion gracefully with safe path resolution
    try {
      const uploadBase = path.resolve(process.cwd(), "uploads");
      const physicalPath = path.resolve(uploadBase, file.storageKey);
      const relativePath = path.relative(uploadBase, physicalPath);

      if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
        if (fs.existsSync(physicalPath)) {
          await fs.promises.unlink(physicalPath);
        }
      }
    } catch (err) {
      console.warn(`Could not delete physical file for ${fileId}:`, err);
    }

    try {
      await prisma.file.delete({
        where: { id: fileId },
      });
    } catch (err: any) {
      throw new FileDeleteFailedError(err.message || "Failed to remove file record from database.");
    }
  }
}

export const filesService = new FilesService();
