import path from "path";
import fs from "fs";
import { prisma } from "../../common/prisma";
import {
  IFileDto,
  IFileListQuery,
  IPaginatedFilesResponse,
  IFileDownloadData,
  IStorageQuotaDto,
  FileStatus,
} from "./files.types";
import {
  FileNotFoundError,
  FileDeleteFailedError,
  EmptyFileError,
  PayloadTooLargeError,
  StorageQuotaExceededError,
  BadRequestError,
} from "../../common/errors/AppError";
import { validateAndSanitizeFileName, validateFileStatus, validateListFilesQuery, ALLOWED_SORT_FIELDS } from "./files.validation";
import { getMaxFileSizeBytes, getUserStorageQuotaBytes } from "./files.constants";
import { storageService } from "./storage.service";
import { logger } from "../../common/logger";

/**
 * Async Keyed Mutex:
 * Serializes async critical sections on a per-key basis (e.g. per-user).
 * Guarantees strict FIFO execution order without race conditions or memory leaks.
 */
export class KeyedMutex {
  private tailPromises = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previousPromise = this.tailPromises.get(key) || Promise.resolve();

    let releaseLock: () => void;
    const currentPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.tailPromises.set(key, currentPromise);

    try {
      await previousPromise;
      return await fn();
    } finally {
      releaseLock!();
      if (this.tailPromises.get(key) === currentPromise) {
        this.tailPromises.delete(key);
      }
    }
  }

  getActiveKeyCount(): number {
    return this.tailPromises.size;
  }
}

export class FilesService {
  private userMutex = new KeyedMutex();

  /**
   * Helper to format a Prisma File record into a secure public DTO
   * (never exposing storageKey or server filesystem details).
   */
  private toDto(file: any): IFileDto {
    return {
      id: file.id,
      filename: file.originalName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      status: file.status,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  /**
   * Retrieves or initializes the StorageQuota record for a user.
   * If not present, active usage is computed from existing files.
   */
  async getOrCreateStorageQuota(userId: string): Promise<any> {
    const quotaBytes = getUserStorageQuotaBytes();
    const existing = await prisma.storageQuota.findUnique({
      where: { userId },
    });
    if (existing) {
      if (existing.quotaBytes !== quotaBytes) {
        return prisma.storageQuota.update({
          where: { userId },
          data: { quotaBytes },
        });
      }
      return existing;
    }

    const aggregate = await prisma.file.aggregate({
      where: {
        userId,
        status: { notIn: [FileStatus.FAILED, FileStatus.EXPIRED] },
      },
      _sum: {
        size: true,
      },
    });
    const activeUsage = aggregate._sum.size || 0;

    return prisma.storageQuota.upsert({
      where: { userId },
      create: {
        userId,
        quotaBytes,
        usedBytes: activeUsage,
      },
      update: {
        quotaBytes,
      },
    });
  }

  /**
   * Atomically reserves storage quota using an atomic conditional update:
   * UPDATE StorageQuota SET usedBytes = usedBytes + fileSize
   * WHERE userId = ? AND usedBytes <= quotaBytes - fileSize;
   *
   * If updated rows === 1: allowed.
   * If updated rows === 0: quota exceeded.
   */
  async reserveQuota(userId: string, fileSize: number): Promise<void> {
    if (!Number.isFinite(fileSize) || isNaN(fileSize) || fileSize <= 0) {
      return;
    }

    const quotaBytes = getUserStorageQuotaBytes();
    await this.getOrCreateStorageQuota(userId);

    const result = await prisma.storageQuota.updateMany({
      where: {
        userId,
        usedBytes: {
          lte: quotaBytes - fileSize,
        },
      },
      data: {
        usedBytes: {
          increment: fileSize,
        },
      },
    });

    if (result.count !== 1) {
      const current = await this.getUserStorageQuota(userId);
      throw new StorageQuotaExceededError(
        `Storage quota exceeded. Current usage: ${current.usage} bytes, incoming file: ${fileSize} bytes, maximum quota: ${quotaBytes} bytes.`
      );
    }
  }

  /**
   * Releases previously reserved quota on upload/DB failure or file deletion.
   */
  async releaseQuota(userId: string, fileSize: number): Promise<void> {
    if (!Number.isFinite(fileSize) || isNaN(fileSize) || fileSize <= 0) {
      return;
    }

    await prisma.storageQuota.updateMany({
      where: { userId },
      data: {
        usedBytes: {
          decrement: fileSize,
        },
      },
    });

    // Ensure usedBytes never drops below 0 due to edge case desyncs
    await prisma.storageQuota.updateMany({
      where: { userId, usedBytes: { lt: 0 } },
      data: { usedBytes: 0 },
    });
  }

  /**
   * Synchronizes StorageQuota.usedBytes with actual SUM(File.size) in database.
   */
  async syncQuotaWithActiveFiles(userId: string): Promise<number> {
    const aggregate = await prisma.file.aggregate({
      where: {
        userId,
        status: { notIn: [FileStatus.FAILED, FileStatus.EXPIRED] },
      },
      _sum: {
        size: true,
      },
    });
    const usage = aggregate._sum.size || 0;
    const quotaBytes = getUserStorageQuotaBytes();

    await prisma.storageQuota.upsert({
      where: { userId },
      create: {
        userId,
        quotaBytes,
        usedBytes: usage,
      },
      update: {
        quotaBytes,
        usedBytes: usage,
      },
    });

    return usage;
  }

  /**
   * Creates File database record.
   */
  async createFileRecord(
    userId: string,
    originalName: string,
    storageKey: string,
    mimeType: string,
    size: number,
    jobId?: string
  ): Promise<IFileDto> {
    const file = await prisma.file.create({
      data: {
        userId,
        jobId,
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
   * Creates a new file record with atomic quota reservation and automatic rollback on DB failure.
   */
  async createFile(
    userId: string,
    originalName: string,
    storageKey: string,
    mimeType: string,
    size: number,
    jobId?: string
  ): Promise<IFileDto> {
    if (!Number.isFinite(size) || isNaN(size) || size < 0) {
      throw new BadRequestError("Invalid file size.", "INVALID_FILE_SIZE");
    }

    if (size === 0) {
      throw new EmptyFileError("Uploaded file is empty (0 bytes).");
    }

    const maxFileSize = getMaxFileSizeBytes();
    if (size > maxFileSize) {
      throw new PayloadTooLargeError(`File size (${size} bytes) exceeds maximum permitted limit of ${maxFileSize} bytes.`);
    }

    // Step 1: Atomic quota reservation
    await this.reserveQuota(userId, size);

    // Step 2: Create DB File record with rollback on failure
    try {
      return await this.createFileRecord(userId, originalName, storageKey, mimeType, size, jobId);
    } catch (err) {
      await this.releaseQuota(userId, size);
      throw err;
    }
  }

  /**
   * Retrieves the current storage usage, quota, and remaining allowance for a user (Phase 2.6E).
   */
  async getUserStorageQuota(userId: string): Promise<IStorageQuotaDto> {
    const quota = getUserStorageQuotaBytes();
    const quotaRow = await this.getOrCreateStorageQuota(userId);

    const usage = Math.max(0, quotaRow.usedBytes);
    const remaining = Math.max(0, quota - usage);

    return {
      usage,
      quota,
      remaining,
    };
  }

  /**
   * Lists files belonging to the authenticated user with validated pagination, safe allowlisted sorting, and optional status filter.
   */
  async listFiles(userId: string, rawQuery: IFileListQuery = {}): Promise<IPaginatedFilesResponse> {
    const validated = validateListFilesQuery(rawQuery);
    const { page, limit, sortBy, sortOrder, status } = validated;
    const skip = (page - 1) * limit;

    const whereClause: any = { userId };
    if (status) {
      whereClause.status = status;
    }

    // Safe Prisma field mapping to prevent arbitrary column injection (B3)
    const prismaSortField = ALLOWED_SORT_FIELDS[sortBy] || "createdAt";

    // Query performance optimization (B6): select only safe public columns, no storageKey/userId, no relations
    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where: whereClause,
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { [prismaSortField]: sortOrder },
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

    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });

    if (!file) {
      throw new FileNotFoundError("File not found.");
    }

    const sanitizedName = validateAndSanitizeFileName(newName, path.extname(file.originalName));

    const updated = await prisma.file.update({
      where: { id: fileId },
      data: { originalName: sanitizedName },
    });

    return this.toDto(updated);
  }

  /**
   * Retrieves the physical filesystem path and metadata for secure streaming download.
   * Enforces:
   * - C1: Strict userId and fileId query scoping (no cross-user existence leakage)
   * - C2: Storage path traversal prevention (checks decoding, null bytes, relative traversal, and storage root prefix)
   * - C3: Safe 404 handling if physical file is missing from disk (never leaks internal paths or ENOENT)
   * - C4 & C7: Safe RFC 6266 / RFC 5987 filename sanitization preventing Content-Disposition injection
   * - C5: Safe MIME type verification preventing executable/HTML MIME execution
   */
  async getFileDownloadData(userId: string, fileId: string): Promise<IFileDownloadData> {
    if (!fileId || typeof fileId !== "string" || /[\0\r\n]/.test(fileId)) {
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

    // C2: Storage Path Security
    const rawKey = file.storageKey;
    if (!rawKey || typeof rawKey !== "string") {
      throw new FileNotFoundError("File not found.");
    }

    // Reject null bytes, control characters
    if (/[\0\x00-\x1f]/.test(rawKey)) {
      throw new FileNotFoundError("File not found.");
    }

    // URL decode to catch encoded traversal attempts (%2e%2e, %2f, %5c, etc.)
    let decodedKey = rawKey;
    try {
      decodedKey = decodeURIComponent(rawKey);
    } catch {
      throw new FileNotFoundError("File not found.");
    }

    if (
      decodedKey.includes("..") ||
      rawKey.includes("..") ||
      decodedKey.includes(":") ||
      rawKey.includes(":")
    ) {
      throw new FileNotFoundError("File not found.");
    }

    if (
      path.isAbsolute(rawKey) ||
      path.isAbsolute(decodedKey) ||
      rawKey.startsWith("/") ||
      rawKey.startsWith("\\")
    ) {
      throw new FileNotFoundError("File not found.");
    }

    const uploadBase = storageService.getStorageRoot();
    const physicalPath = path.resolve(uploadBase, rawKey);
    const relativePath = path.relative(uploadBase, physicalPath);

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath) ||
      !physicalPath.startsWith(uploadBase + path.sep)
    ) {
      throw new FileNotFoundError("File not found.");
    }

    // C3: Physical File Missing Check
    if (!fs.existsSync(physicalPath)) {
      throw new FileNotFoundError("File not found.");
    }

    // Symlink escape protection via realpath (Fix 1)
    let realPhysicalPath: string;
    let realUploadBase: string;
    try {
      realUploadBase = await fs.promises.realpath(uploadBase);
      realPhysicalPath = await fs.promises.realpath(physicalPath);
    } catch {
      throw new FileNotFoundError("File not found.");
    }

    if (!realPhysicalPath.startsWith(realUploadBase + path.sep)) {
      throw new FileNotFoundError("File not found.");
    }

    let fileSize = file.size;
    try {
      const stat = await fs.promises.stat(realPhysicalPath);
      if (!stat.isFile()) {
        throw new FileNotFoundError("File not found.");
      }
      fileSize = stat.size;
    } catch {
      throw new FileNotFoundError("File not found.");
    }

    // C5: Content-Type Security
    const DANGEROUS_MIMES = new Set([
      "text/html",
      "text/javascript",
      "application/javascript",
      "application/x-javascript",
      "text/ecmascript",
      "application/ecmascript",
      "text/vbscript",
      "application/x-sh",
      "application/x-csh",
      "application/xhtml+xml",
      "application/xml",
      "text/xml",
      "application/x-msdownload",
      "application/x-executable",
      "application/x-bat",
      "application/x-cmd",
      "application/x-php",
      "text/php",
    ]);

    let safeMime = (file.mimeType || "application/pdf").toLowerCase().trim();
    if (DANGEROUS_MIMES.has(safeMime) || !safeMime) {
      safeMime = "application/pdf";
    }
    if (file.originalName.toLowerCase().endsWith(".pdf")) {
      safeMime = "application/pdf";
    }

    // C4 & C7: Safe Filename Sanitization for Content-Disposition
    let baseName = path.basename(file.originalName)
      .replace(/[\r\n\0\x00-\x1f]/g, "")
      .trim();
    if (!baseName) {
      baseName = "document.pdf";
    }

    // ASCII fallback (quotes, semicolons, backslashes replaced with _)
    const safeAsciiName = baseName
      .replace(/["\\;]/g, "_")
      .replace(/[^\x20-\x7E]/g, "_")
      .trim() || "document.pdf";

    // RFC 5987 / RFC 6266 UTF-8 encoded name
    const encodedUtf8Name = encodeURIComponent(baseName);

    return {
      physicalPath,
      originalName: file.originalName,
      safeAsciiName,
      encodedUtf8Name,
      mimeType: safeMime,
      size: fileSize,
    };
  }

  /**
   * Deletes physical disk file and database record with full 2-phase lifecycle consistency.
   * Enforces:
   * - Strict ownership verification (404 FILE_NOT_FOUND)
   * - Storage path security & symlink escape protection (404 FILE_NOT_FOUND)
   * - Missing physical file handling (cleans up DB record safely)
   * - Atomic staging & rollback:
   *   1. If physical file exists, stage it (rename to .del.<timestamp>)
   *   2. Delete DB record
   *   3. If DB delete fails, rollback staged file back to original physicalPath
   *   4. If DB delete succeeds, permanently remove staged file
   * - Sanitized public errors (never expose Prisma errors, internal paths, or ENOENT)
   */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    if (!fileId || typeof fileId !== "string" || /[\0\r\n]/.test(fileId)) {
      throw new FileNotFoundError("File not found.");
    }

    return this.userMutex.runExclusive(userId, async () => {
      const file = await prisma.file.findFirst({
        where: {
          id: fileId,
          userId,
        },
      });

      if (!file) {
        throw new FileNotFoundError("File not found.");
      }

      // Path security audit: reject traversal and absolute paths
      const rawKey = file.storageKey;
      if (!rawKey || typeof rawKey !== "string" || /[\0\x00-\x1f]/.test(rawKey)) {
        throw new FileNotFoundError("File not found.");
      }

      let decodedKey = rawKey;
      try {
        decodedKey = decodeURIComponent(rawKey);
      } catch {
        throw new FileNotFoundError("File not found.");
      }

      if (
        decodedKey.includes("..") ||
        rawKey.includes("..") ||
        decodedKey.includes(":") ||
        rawKey.includes(":") ||
        path.isAbsolute(rawKey) ||
        path.isAbsolute(decodedKey) ||
        rawKey.startsWith("/") ||
        rawKey.startsWith("\\")
      ) {
        throw new FileNotFoundError("File not found.");
      }

      const uploadBase = storageService.getStorageRoot();
      const physicalPath = path.resolve(uploadBase, rawKey);
      const relativePath = path.relative(uploadBase, physicalPath);

      if (
        relativePath.startsWith("..") ||
        path.isAbsolute(relativePath) ||
        !physicalPath.startsWith(uploadBase + path.sep)
      ) {
        throw new FileNotFoundError("File not found.");
      }

      // Check if physical file exists on disk
      const fileExists = fs.existsSync(physicalPath);

      let realPhysicalPath: string | null = null;
      let realUploadBase: string | null = null;

      if (fileExists) {
        try {
          realUploadBase = await fs.promises.realpath(uploadBase);
          realPhysicalPath = await fs.promises.realpath(physicalPath);
        } catch {
          throw new FileNotFoundError("File not found.");
        }

        if (!realPhysicalPath.startsWith(realUploadBase + path.sep)) {
          throw new FileNotFoundError("File not found.");
        }
      }

      // Case 1: Missing physical file on disk (Ghost DB record)
      // Clean up DB record safely
      if (!fileExists || !realPhysicalPath) {
        try {
          await prisma.file.delete({
            where: { id: fileId },
          });
          try {
            await this.releaseQuota(userId, file.size);
          } catch (quotaErr) {
            await this.syncQuotaWithActiveFiles(userId).catch(() => {});
          }
          return;
        } catch (err: any) {
          throw new FileDeleteFailedError("Failed to delete file.");
        }
      }

      // Case 2: Physical file exists on disk
      // 2-Phase Staging & Rollback to guarantee filesystem & DB consistency:
      const stagingPath = `${realPhysicalPath}.del.${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Phase 1: Atomically stage physical file
      try {
        await fs.promises.rename(realPhysicalPath, stagingPath);
      } catch (fsErr) {
        // Physical move/deletion failed -> do NOT delete DB record! (Blocker 1 fixed)
        throw new FileDeleteFailedError("Failed to delete file.");
      }

      // Phase 2: Delete DB record
      try {
        await prisma.file.delete({
          where: { id: fileId },
        });
      } catch (dbErr) {
        // DB deletion failed -> ROLLBACK staged physical file back to active location (Blocker 2 fixed)
        try {
          await fs.promises.rename(stagingPath, realPhysicalPath);
        } catch {
          logger.error("Critical: Failed to rollback staged file after DB failure.", "STORAGE");
        }
        throw new FileDeleteFailedError("Failed to delete file.");
      }

      // Release quota usage with automatic reconciliation fallback (guarantees usedBytes never becomes stale)
      try {
        await this.releaseQuota(userId, file.size);
      } catch {
        logger.warn("Notice: Quota decrement warning on file delete, reconciling storage quota.", "STORAGE");
        try {
          await this.syncQuotaWithActiveFiles(userId);
        } catch {
          logger.error("Critical: Failed to reconcile storage quota on file delete.", "STORAGE");
        }
      }

      // Phase 3: Finalize physical removal (DB record already safely deleted)
      try {
        await fs.promises.unlink(stagingPath);
      } catch {
        logger.warn("Notice: Staged file cleanup warning.", "STORAGE");
      }
    });
  }
}

export const filesService = new FilesService();
