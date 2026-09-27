import { FileRenameInvalidError, BadRequestError } from "../../common/errors/AppError";
import { FileStatus, AllowedSortField, AllowedSortOrder, IValidatedListFilesQuery } from "./files.types";

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

export const ALLOWED_SORT_FIELDS: Record<string, string> = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  filename: "originalName",
  originalName: "originalName",
  size: "size",
};

/**
 * Validates and sanitizes query parameters for listing files (Phase 2.6B).
 * Enforces:
 * - page: Integer >= 1 (Default: 1)
 * - limit: Integer 1..100 (Default: 20)
 * - sortBy: In ALLOWED_SORT_FIELDS (Default: 'createdAt')
 * - sortOrder: 'asc' | 'desc' (Default: 'desc')
 * - status: Optional FileStatus validation
 */
export function validateListFilesQuery(rawQuery: Record<string, any> = {}): IValidatedListFilesQuery {
  // 1. Page validation
  let page = 1;
  if (rawQuery.page !== undefined && rawQuery.page !== null && rawQuery.page !== "") {
    const rawPageStr = String(rawQuery.page).trim();
    if (!/^\d+$/.test(rawPageStr)) {
      throw new BadRequestError(
        "Invalid page number. 'page' must be an integer greater than or equal to 1.",
        "INVALID_PAGE"
      );
    }
    const parsedPage = parseInt(rawPageStr, 10);
    if (parsedPage < 1) {
      throw new BadRequestError(
        "Invalid page number. 'page' must be an integer greater than or equal to 1.",
        "INVALID_PAGE"
      );
    }
    page = parsedPage;
  }

  // 2. Limit validation
  let limit = 20;
  if (rawQuery.limit !== undefined && rawQuery.limit !== null && rawQuery.limit !== "") {
    const rawLimitStr = String(rawQuery.limit).trim();
    if (!/^\d+$/.test(rawLimitStr)) {
      throw new BadRequestError(
        "Invalid limit. 'limit' must be an integer greater than or equal to 1.",
        "INVALID_LIMIT"
      );
    }
    const parsedLimit = parseInt(rawLimitStr, 10);
    if (parsedLimit < 1) {
      throw new BadRequestError(
        "Invalid limit. 'limit' must be an integer greater than or equal to 1.",
        "INVALID_LIMIT"
      );
    }
    if (parsedLimit > 100) {
      throw new BadRequestError(
        "Limit exceeds maximum permitted value of 100.",
        "LIMIT_EXCEEDED"
      );
    }
    limit = parsedLimit;
  }

  // 3. SortBy validation
  let sortBy: AllowedSortField = "createdAt";
  if (rawQuery.sortBy !== undefined && rawQuery.sortBy !== null && rawQuery.sortBy !== "") {
    const rawSortBy = String(rawQuery.sortBy).trim();
    if (!ALLOWED_SORT_FIELDS[rawSortBy]) {
      throw new BadRequestError(
        `Invalid sortBy field '${rawSortBy}'. Allowed fields: createdAt, updatedAt, filename, size.`,
        "INVALID_SORT_FIELD"
      );
    }
    sortBy = rawSortBy as AllowedSortField;
  }

  // 4. SortOrder validation
  let sortOrder: AllowedSortOrder = "desc";
  if (rawQuery.sortOrder !== undefined && rawQuery.sortOrder !== null && rawQuery.sortOrder !== "") {
    const rawSortOrder = String(rawQuery.sortOrder).trim().toLowerCase();
    if (rawSortOrder !== "asc" && rawSortOrder !== "desc") {
      throw new BadRequestError(
        `Invalid sortOrder '${rawQuery.sortOrder}'. Allowed values: 'asc', 'desc'.`,
        "INVALID_SORT_ORDER"
      );
    }
    sortOrder = rawSortOrder as AllowedSortOrder;
  }

  // 5. Status validation (Optional)
  let status: FileStatus | undefined = undefined;
  if (rawQuery.status !== undefined && rawQuery.status !== null && rawQuery.status !== "") {
    status = validateFileStatus(String(rawQuery.status).trim());
  }

  return {
    page,
    limit,
    sortBy,
    sortOrder,
    status,
  };
}

