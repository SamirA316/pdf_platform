import { FileRenameInvalidError, BadRequestError } from "../../common/errors/AppError";
import { FileStatus } from "./files.types";

/**
 * Validates and sanitizes a requested file rename.
 * Enforces:
 * - Non-empty
 * - Max length 255 characters
 * - No path traversal or illegal characters (/, \, null bytes, control characters)
 * - Automatically ensures .pdf extension is preserved
 */
export function validateAndSanitizePdfName(inputName?: string): string {
  if (!inputName || typeof inputName !== "string") {
    throw new FileRenameInvalidError("A valid file name must be provided.");
  }

  let trimmed = inputName.trim();

  if (trimmed.length === 0) {
    throw new FileRenameInvalidError("File name cannot be empty.");
  }

  // Check for path traversal or illegal characters
  if (/[\/\0\x00-\x1f\\<>:"|?*]/.test(trimmed)) {
    throw new FileRenameInvalidError("File name contains illegal characters or path traversal sequences.");
  }

  // Prevent names like "." or ".."
  if (trimmed === "." || trimmed === "..") {
    throw new FileRenameInvalidError("Invalid file name.");
  }

  // Ensure .pdf extension is preserved
  if (!trimmed.toLowerCase().endsWith(".pdf")) {
    trimmed = `${trimmed}.pdf`;
  }

  if (trimmed.length > 255) {
    throw new FileRenameInvalidError("File name exceeds maximum permitted length of 255 characters.");
  }

  return trimmed;
}

const VALID_FILE_STATUSES = new Set<string>(Object.values(FileStatus));

/**
 * Validates file status against permitted FileStatus enum values.
 */
export function validateFileStatus(status?: string): FileStatus {
  if (!status || !VALID_FILE_STATUSES.has(status)) {
    throw new BadRequestError(
      `Invalid file status '${status}'. Allowed: ${Object.values(FileStatus).join(", ")}`,
      "INVALID_FILE_STATUS"
    );
  }
  return status as FileStatus;
}
