/**
 * Job Status Lifecycle Enum
 */
export enum JobStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

/**
 * Permitted PDF Tools for Job System
 * In Phase 3, strictly 'compress-pdf' is supported as the active implemented processor.
 * Other tools will be added incrementally in Phase 4 as processors are implemented & verified.
 */
export const ALLOWED_TOOLS = new Set<string>([
  "compress-pdf",
  "merge-pdf",
  "split-pdf",
  "rotate-pdf",
  "organize-pdf",
]);

/**
 * Compression Option Presets
 */
export const ALLOWED_COMPRESS_LEVELS = new Set<string>([
  "extreme",
  "recommended",
  "less",
  "low",
  "custom",
]);

/**
 * Split PDF Supported Extraction Modes
 */
export const ALLOWED_SPLIT_MODES = new Set<string>([
  "ranges",
  "pages",
  "every-page",
]);

/**
 * Rotate PDF Allowed Rotation Angles (degrees clockwise)
 */
export const ALLOWED_ROTATION_ANGLES = new Set<number>([90, 180, 270]);

