/**
 * Centralized Storage Service (Launch Plan Item 3 & 25)
 *
 * Centralizes all filesystem storage operations, directory path resolutions,
 * and path-traversal / escape security checks across the entire platform.
 */

import path from "path";
import fs from "fs";

export class StorageService {
  /**
   * Returns the absolute base directory for all stored files.
   * Driven by STORAGE_ROOT environment variable with a safe local fallback in non-production.
   * In production, STORAGE_ROOT must be non-empty and absolute.
   */
  getStorageRoot(): string {
    const customRoot = process.env.STORAGE_ROOT;
    if (process.env.NODE_ENV === "production") {
      if (!customRoot || !customRoot.trim()) {
        throw new Error("FATAL: STORAGE_ROOT environment variable is mandatory in production.");
      }
      if (!path.isAbsolute(customRoot.trim())) {
        throw new Error(`FATAL: STORAGE_ROOT must be an absolute path in production (received: "${customRoot}").`);
      }
      return customRoot.trim();
    }
    if (customRoot && customRoot.trim()) {
      return path.resolve(customRoot.trim());
    }
    return path.resolve(process.cwd(), "uploads");
  }

  /**
   * Ensures the storage root directory exists on disk.
   */
  ensureStorageRoot(): string {
    const root = this.getStorageRoot();
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true, mode: 0o750 });
    }
    return root;
  }

  /**
   * Resolves and creates the user-isolated directory: <STORAGE_ROOT>/users/<safeUserId>
   */
  getUserStorageDir(userId: string): string {
    const safeUserId = (userId || "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeUserId) {
      throw new Error("Invalid user ID provided for storage directory resolution.");
    }

    const userDir = path.join(this.getStorageRoot(), "users", safeUserId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true, mode: 0o750 });
    }
    return userDir;
  }

  /**
   * Safely resolves a relative storageKey (e.g. "users/<userId>/<file>.pdf") against the storage root.
   * Throws or returns an error if any traversal, null-byte, or escaping is attempted.
   */
  resolveStorageKey(storageKey: string): { physicalPath: string; isValid: boolean } {
    if (!storageKey || typeof storageKey !== "string" || /[\0\x00-\x1f]/.test(storageKey)) {
      return { physicalPath: "", isValid: false };
    }

    let decodedKey = storageKey;
    try {
      decodedKey = decodeURIComponent(storageKey);
    } catch {
      return { physicalPath: "", isValid: false };
    }

    if (
      decodedKey.includes("..") ||
      storageKey.includes("..") ||
      decodedKey.includes(":") ||
      storageKey.includes(":") ||
      path.isAbsolute(storageKey) ||
      path.isAbsolute(decodedKey) ||
      storageKey.startsWith("/") ||
      storageKey.startsWith("\\")
    ) {
      return { physicalPath: "", isValid: false };
    }

    const uploadBase = this.getStorageRoot();
    const physicalPath = path.resolve(uploadBase, storageKey);
    const relativePath = path.relative(uploadBase, physicalPath);

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath) ||
      !physicalPath.startsWith(uploadBase + path.sep)
    ) {
      return { physicalPath: "", isValid: false };
    }

    return { physicalPath, isValid: true };
  }
}

export const storageService = new StorageService();
