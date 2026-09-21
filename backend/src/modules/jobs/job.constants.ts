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
  "resize-pdf",
  "watermark-pdf",
  "page-numbers",
  "protect-pdf",
  "unlock-pdf",
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

/**
 * Resize PDF Allowed Page Presets
 */
export const ALLOWED_PAGE_SIZES = new Set<string>([
  "a3",
  "a4",
  "a5",
  "letter",
  "legal",
  "custom",
]);

/**
 * Resize PDF Allowed Units
 */
export const ALLOWED_RESIZE_UNITS = new Set<string>(["mm", "inch", "in", "pt"]);

/**
 * Resize PDF Allowed Orientations
 */
export const ALLOWED_ORIENTATIONS = new Set<string>(["portrait", "landscape"]);

/**
 * Standard Page Dimensions in PDF Points (72 DPI) in portrait orientation
 */
export const STANDARD_PAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  a3: { width: 841.89, height: 1190.55 },
  a4: { width: 595.28, height: 841.89 },
  a5: { width: 419.53, height: 595.28 },
  letter: { width: 612.0, height: 792.0 },
  legal: { width: 612.0, height: 1008.0 },
};

/**
 * Watermark PDF Allowed Types
 */
export const ALLOWED_WATERMARK_TYPES = new Set<string>(["text", "image"]);

/**
 * Watermark PDF Allowed Positions
 */
export const ALLOWED_WATERMARK_POSITIONS = new Set<string>([
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);

/**
 * Page Numbers PDF Allowed Positions
 */
export const ALLOWED_PAGE_NUMBER_POSITIONS = new Set<string>([
  "bottom-center",
  "bottom-left",
  "bottom-right",
  "top-center",
  "top-left",
  "top-right",
]);

