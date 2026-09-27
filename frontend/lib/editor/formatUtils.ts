/**
 * QuickPDF Platform - Text Formatting Utilities & Validators
 * Phase 5.5.5 Text Formatting Architecture
 */

import { EditorFontFamily, EditorTextAlign } from "@/types/editor";

export const SUPPORTED_FONT_FAMILIES: readonly EditorFontFamily[] = [
  "Helvetica",
  "Times",
  "Courier",
  "Inter",
  "Roboto",
  "Arial",
] as const;

export const MIN_FONT_SIZE = 4;
export const MAX_FONT_SIZE = 500;
export const DEFAULT_FONT_SIZE = 16;

export const MIN_LINE_HEIGHT = 0.5;
export const MAX_LINE_HEIGHT = 3.0;
export const DEFAULT_LINE_HEIGHT = 1.2;

export const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export const SUPPORTED_TEXT_ALIGNS: readonly EditorTextAlign[] = [
  "left",
  "center",
  "right",
] as const;

/**
 * Validates if the font family is in the supported font list.
 */
export function isValidFontFamily(font: string): font is EditorFontFamily {
  return SUPPORTED_FONT_FAMILIES.includes(font as EditorFontFamily);
}

/**
 * Validates whether a font size is a finite positive number.
 */
export function isValidFontSize(size: unknown): size is number {
  return typeof size === "number" && Number.isFinite(size) && size > 0;
}

/**
 * Clamps and sanitizes font size to [MIN_FONT_SIZE, MAX_FONT_SIZE] range.
 */
export function clampFontSize(size: number): number {
  if (!isValidFontSize(size)) return DEFAULT_FONT_SIZE;
  const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  return Math.round(clamped * 10) / 10;
}

/**
 * Validates whether a line height is a finite positive number.
 */
export function isValidLineHeight(lh: unknown): lh is number {
  return typeof lh === "number" && Number.isFinite(lh) && lh > 0;
}

/**
 * Clamps and sanitizes line height to [MIN_LINE_HEIGHT, MAX_LINE_HEIGHT] range.
 */
export function clampLineHeight(lh: number): number {
  if (!isValidLineHeight(lh)) return DEFAULT_LINE_HEIGHT;
  const clamped = Math.max(MIN_LINE_HEIGHT, Math.min(MAX_LINE_HEIGHT, lh));
  return Math.round(clamped * 100) / 100;
}

/**
 * Validates whether a string is a valid standard hex color.
 */
export function isValidHexColor(color: string): boolean {
  return typeof color === "string" && HEX_COLOR_REGEX.test(color.trim());
}

/**
 * Validates whether alignment is one of left, center, right.
 */
export function isValidTextAlign(align: string): align is EditorTextAlign {
  return SUPPORTED_TEXT_ALIGNS.includes(align as EditorTextAlign);
}

/**
 * Toggle font weight between 'normal' and 'bold'.
 */
export function toggleFontWeight(current: "normal" | "bold"): "normal" | "bold" {
  return current === "bold" ? "normal" : "bold";
}

/**
 * Toggle font style between 'normal' and 'italic'.
 */
export function toggleFontStyle(current: "normal" | "italic"): "normal" | "italic" {
  return current === "italic" ? "normal" : "italic";
}

/**
 * Toggle text decoration between 'none' and 'underline'.
 */
export function toggleTextDecoration(current: "none" | "underline"): "none" | "underline" {
  return current === "underline" ? "none" : "underline";
}
