/**
 * QuickPDF Platform - PDF Editor Zod Validation Schemas
 * Phase 5.1 Foundation Architecture
 */

import { z } from "zod";

const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export const baseEditorObjectSchema = z.object({
  id: z.string().min(1, "Object ID is required"),
  pageIndex: z.number().int().min(0, "pageIndex must be non-negative integer"),
  x: z.number().describe("PDF Standard X coordinate in points"),
  y: z.number().describe("PDF Standard Y coordinate in points"),
  width: z.number().positive("width must be positive"),
  height: z.number().positive("height must be positive"),
  rotation: z.number().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  zIndex: z.number().int().default(1),
  isLocked: z.boolean().optional(),
});

export const textEditorObjectSchema = baseEditorObjectSchema.extend({
  type: z.literal("text"),
  text: z.string().max(10000, "Text payload exceeds maximum length"),
  fontSize: z.number().min(4).max(500).default(16),
  fontFamily: z.enum(["Helvetica", "Times", "Courier", "Inter", "Roboto", "Arial"]).default("Helvetica"),
  fontWeight: z.enum(["normal", "bold"]).default("normal"),
  fontStyle: z.enum(["normal", "italic"]).default("normal"),
  textDecoration: z.enum(["none", "underline"]).default("none"),
  color: z.string().regex(hexColorRegex, "Invalid hex color").default("#000000"),
  textAlign: z.enum(["left", "center", "right"]).default("left"),
  lineHeight: z.number().min(0.5).max(3).default(1.2),
});

export const shapeEditorObjectSchema = baseEditorObjectSchema.extend({
  type: z.literal("shape"),
  shapeType: z.enum(["rectangle", "circle", "line", "arrow"]),
  strokeColor: z.string().regex(hexColorRegex, "Invalid stroke color").default("#000000"),
  strokeWidth: z.number().min(0.25).max(100).default(2),
  strokeDashArray: z.array(z.number().positive()).optional(),
  fillColor: z.string().default("transparent"),
});

export const drawingEditorObjectSchema = baseEditorObjectSchema.extend({
  type: z.literal("drawing"),
  isHighlighter: z.boolean().default(false),
  color: z.string().regex(hexColorRegex, "Invalid drawing color").default("#000000"),
  strokeWidth: z.number().min(0.5).max(100).default(3),
  points: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
      })
    )
    .min(1, "Drawing must contain at least one point"),
});

export const imageEditorObjectSchema = baseEditorObjectSchema.extend({
  type: z.literal("image"),
  src: z.string().min(1, "Image source is required"),
  originalWidth: z.number().positive(),
  originalHeight: z.number().positive(),
  aspectRatio: z.number().positive(),
});

export const editorObjectSchema = z.discriminatedUnion("type", [
  textEditorObjectSchema,
  shapeEditorObjectSchema,
  drawingEditorObjectSchema,
  imageEditorObjectSchema,
]);

export const editorExportPayloadSchema = z.object({
  fileId: z.string().min(1, "fileId is required"),
  options: z
    .object({
      flatten: z.boolean().default(true),
      compatibilityVersion: z.enum(["1.7", "PDF/A-1b", "PDF/A-2b"]).optional(),
    })
    .optional(),
  pages: z
    .array(
      z.object({
        pageIndex: z.number().int().min(0),
        rotationDelta: z.number().int().default(0),
        objects: z.array(editorObjectSchema).default([]),
      })
    )
    .min(1, "At least one page is required in export manifest"),
});
