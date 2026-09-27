/**
 * File & Storage Quota Constants (Phase 2.6E)
 */

// Maximum single file size allowed for upload: 50MB default
export const DEFAULT_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 52,428,800 bytes (50MB)
export const MAX_FILE_SIZE_BYTES = DEFAULT_MAX_FILE_SIZE_BYTES;

// Maximum total storage quota per user: 100MB default
export const DEFAULT_USER_STORAGE_QUOTA_BYTES = 100 * 1024 * 1024; // 104,857,600 bytes (100MB)
export const USER_STORAGE_QUOTA_BYTES = DEFAULT_USER_STORAGE_QUOTA_BYTES;

export function getMaxFileSizeBytes(): number {
  const envVal = process.env.MAX_FILE_SIZE_BYTES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_MAX_FILE_SIZE_BYTES;
}

export function getUserStorageQuotaBytes(): number {
  const envVal = process.env.USER_STORAGE_QUOTA_BYTES;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_USER_STORAGE_QUOTA_BYTES;
}
