"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Type,
  PenLine,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  SlidersHorizontal,
  Download,
  MousePointer,
  Highlighter,
  Loader2,
  Check,
  Image as ImageIcon,
  Search,
  Bold,
  Italic,
  Eraser,
  X,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  FileSignature,
  RotateCw,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  RefreshCw,
  Plus,
  List,
  Bookmark,
  MoreHorizontal,
  ArrowLeftRight,
  Settings
} from "lucide-react";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { apiClient } from "@/lib/apiClient";

// ==========================================
// INTERFACES & TYPES
// ==========================================

export interface RawBox {
  x: number;
  y: number;
  width: number;
  height: number;
  origPdfX: number;
  origPdfY: number;
  origWidth: number;
  origHeight: number;
}

export interface ParagraphLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  origPdfX?: number;
  origPdfY?: number;
  origWidth?: number;
  origHeight?: number;
  rawBoxes?: RawBox[];
}

export interface EditableText {
  id: string;
  page: number;
  originalText: string;
  currentText: string;
  x: number; // canvas px
  y: number; // canvas px
  width: number;
  height: number;
  fontSize: number;
  fontFamily: "Helvetica" | "TimesRoman" | "Courier";
  fontNameRaw?: string;
  isBold: boolean;
  isItalic: boolean;
  color: string;
  bgColor: string; // sampled background color
  bgRgb: [number, number, number];
  align: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  isOriginal: boolean;
  whiteoutOriginal: boolean;
  origX?: number;
  origY?: number;
  origPdfX?: number;
  origPdfY?: number;
  origWidth?: number;
  origHeight?: number;
  rawBoxes?: RawBox[];
  lines?: ParagraphLine[];
  originalLineCount?: number;
  isScrambled?: boolean;
}

export interface EmbeddedPdfImage {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  origPdfX: number;
  origPdfY: number;
  origWidth: number;
  origHeight: number;
  dataUrl: string;
  isDeleted?: boolean;
  replacementDataUrl?: string;
  replacementFile?: File;
}

export interface ImageAnnotation {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
  file?: File;
  isSignature?: boolean;
}

export interface ShapeAnnotation {
  id: string;
  page: number;
  type: "rectangle" | "circle" | "line" | "arrow";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
}

export interface WhiteoutAnnotation {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface HistorySnapshot {
  textList: EditableText[];
  whiteouts: WhiteoutAnnotation[];
  images: ImageAnnotation[];
  shapes: ShapeAnnotation[];
  embeddedImages: EmbeddedPdfImage[];
}

interface EditConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>, customFile?: File) => void;
  slug?: string;
}

const COLORS = [
  { name: "Black", value: "#000000", rgb: [0, 0, 0] },
  { name: "White", value: "#ffffff", rgb: [1, 1, 1] },
  { name: "Charcoal", value: "#374151", rgb: [0.22, 0.25, 0.32] },
  { name: "Navy", value: "#1E3A8A", rgb: [0.12, 0.23, 0.54] },
  { name: "Red", value: "#E5322D", rgb: [0.9, 0.2, 0.18] },
  { name: "Blue", value: "#2563EB", rgb: [0.15, 0.39, 0.92] },
  { name: "Green", value: "#16A34A", rgb: [0.09, 0.64, 0.29] },
  { name: "Purple", value: "#7C3AED", rgb: [0.49, 0.23, 0.93] },
  { name: "Orange", value: "#EA580C", rgb: [0.92, 0.35, 0.05] },
];

export function parseColorToRgb(colorStr: string): [number, number, number] {
  if (!colorStr) return [0, 0, 0];
  const c = colorStr.trim().toLowerCase();
  if (c === "white" || c === "#fff" || c === "#ffffff") return [1, 1, 1];
  if (c === "black" || c === "#000" || c === "#000000") return [0, 0, 0];

  if (c.startsWith("#")) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    } else if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    }
  }

  const rgbMatch = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10) / 255;
    const g = parseInt(rgbMatch[2], 10) / 255;
    const b = parseInt(rgbMatch[3], 10) / 255;
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
  }

  const colorObj = COLORS.find(co => co.value.toLowerCase() === c);
  if (colorObj) return colorObj.rgb as [number, number, number];

  return [0, 0, 0];
}

function cleanTextForPdf(text: string): string {
  if (!text) return "";
  let s = text;
  // Convert unicode superscripts and subscripts to standard ASCII
  const SUPERSCRIPT_MAP: Record<string, string> = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
    "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
    "⁺": "+", "⁻": "-", "⁼": "=", "⁽": "(", "⁾": ")",
    "ⁿ": "n", "ⁱ": "i",
    "ᵗ": "t", "ʰ": "h", "ˢ": "s", "ᵈ": "d", "ʳ": "r",
    "ᵀ": "T", "ᴴ": "H",
    "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
    "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  };
  for (const [k, v] of Object.entries(SUPERSCRIPT_MAP)) {
    s = s.replaceAll(k, v);
  }
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2026]/g, "...")
    .replace(/[\u2022]/g, "\u00B7") // middle dot '·' which standard pdf-lib WinAnsi fonts support cleanly
    .replace(/[\u20B9]/g, "Rs.")
    .replace(/[^\x00-\x7F\xA0-\xFF]/g, "");
}

// Robust Text Sanitizer for OCR output (strips icon noise, fixes pipe/digit confusion for pronoun 'I', etc.)
export function sanitizeOcrText(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // 1. Fix pronoun 'I' disguised as pipe, 1, or l
  // Contractions: |'m, 1'm, l'm -> I'm
  s = s.replace(/\b[|1l]['’]m\b/g, "I'm");
  s = s.replace(/\b[|1l]['’]ve\b/g, "I've");
  s = s.replace(/\b[|1l]['’]d\b/g, "I'd");
  s = s.replace(/\b[|1l]['’]ll\b/g, "I'll");

  // Pronoun I before common verbs: | am, | have, | enjoy, 1 am, etc.
  s = s.replace(/(^|[.!?]\s+|\b)[|1l]\s+(am|have|had|enjoy|enjoyed|was|were|will|would|can|could|do|did|feel|felt|hope|want|need|wish|believe|think|work|worked|graduated|studied|specialize|specialized|strive|aim|love|like|create|created|manage|managed|lead|led)\b/gi, "$1I $2");

  // Sentence start: '| lowercase_word' -> 'I lowercase_word'
  s = s.replace(/(^|[.!?]\s+)[|1l]\s+([a-z]{2,})/g, "$1I $2");

  // 2. Fix Contact line icon noise:
  // Before Phone: e.g. '| 0 +91' or ' 0 +91' -> '| +91'
  s = s.replace(/(\s*\|\s*|\s+)[0-9oO=\-~•*#@$%^&+/\\(\[\]<>]{1,2}\s*(?=\+\d{1,4}|\b\d{10}\b|\b\d{3}[-.\s]\d{3})/g, "$1");

  // Before Email: e.g. '| = samir939415@gmail.com' -> '| samir939415@gmail.com'
  s = s.replace(/(\s*\|\s*|\s+)[0-9=~•\-_–*#@$%^&+/\\(\[\]<>]+\s*(?=[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "$1");

  // Leading icon noise at start of line before address/name/location: e.g. '2 Siwan, Bihar' -> 'Siwan, Bihar'
  s = s.replace(/^[0-9=~•\-_–*#@$%^&+/\\(\[\]<>]\s+(?=[A-Z][a-zA-Z]+)/, "");

  // 3. Bullet points: normalize OCR bullet gibberish at line start
  s = s.replace(/^[ǳ§¢©]\s*/, "• ");

  // Clean multiple consecutive spaces and trailing whitespace
  s = s.replace(/[ \t]{2,}/g, " ");

  return s.trim();
}

// Robust Detection for PDFs with missing/corrupt font ToUnicode CMaps (scrambled character codes)
export function isScrambledText(str: string): boolean {
  if (!str || str.trim().length === 0) return false;
  const s = str.trim();

  // 1. Starts with unusual punctuation-letter combo like ":-lbu" or ";-lbu" or "=-lbu"
  if (/^[:;=][\-_][a-zA-Z]/.test(s)) return true;

  // 2. Contains unprintable ASCII control characters (0x01-0x08, 0x0B-0x0C, 0x0E-0x1F)
  // e.g. \u0006 in "m\u0006fKH es", \u0007 in "sAK\u0007mHEfl", \u0015, \u0013
  if (/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) return true;

  // 3. Contains exotic/corrupted unicode characters from missing CMap fallbacks
  // e.g. Latin Extended-B (\u0180-\u024F), Lao (\u0E80-\u0EFF), Cyrillic (\u0400-\u04FF), Arabic math (\u08A0-\u08FF)
  const exoticMatches = s.match(/[\u0180-\u024F\u0E80-\u0EFF\u0400-\u04FF\u0102-\u017F\u0250-\u02AF\u08A0-\u08FF\u2000-\u206F]/g);
  if (exoticMatches && exoticMatches.length >= 1) {
    if (s.length < 35 || exoticMatches.length >= 2) return true;
  }

  // 4. Punctuation or brackets inside lowercase words: e.g. "Š]lub" or "wb_uu" or "v|†tib" or "H;d_moѴo]‹"
  if (/[a-zA-Z][\]\[_\|†;=][a-zA-Z]/.test(s)) return true;

  // 5. Repeated consonants/unpronounceable clusters (e.g. "mmv-ub", "cb‰um")
  if (/\b[a-z]*[bcdfghjklmnpqrstvwxyz]{5,}[a-z]*\b/i.test(s)) return true;

  return false;
}

// Crop text bounding box from rendered visual canvas for AI OCR recovery
export function cropCanvasForOcr(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 8
): string {
  const dpr = canvas.width / (parseFloat(canvas.style.width) || canvas.width || 1);
  const realX = x * dpr;
  const realY = y * dpr;
  const realW = width * dpr;
  const realH = height * dpr;
  const realPadding = padding * dpr;

  const cw = canvas.width;
  const ch = canvas.height;

  const cropX = Math.max(0, realX - realPadding);
  const cropY = Math.max(0, realY - realPadding);
  const cropW = Math.min(cw - cropX, realW + realPadding * 2);
  const cropH = Math.min(ch - cropY, realH + realPadding * 2);

  const tempCanvas = document.createElement("canvas");
  const scale = cropH < 35 * dpr ? 2.5 : cropH < 60 * dpr ? 2 : 1.5;
  tempCanvas.width = Math.round(cropW * scale);
  tempCanvas.height = Math.round(cropH * scale);

  const ctx = tempCanvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, tempCanvas.width, tempCanvas.height);

  return tempCanvas.toDataURL("image/png");
}

// Sample canvas background pixel color using robust Perimeter & Statistical Mode Clustering
// Works on ANY background: white, dark blue, black, red, yellow, gradients, banners, etc.!
function sampleCanvasBackgroundColor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): { r: number; g: number; b: number; hex: string } {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;

  // 1. Perimeter sampling: Just outside and at the very edges of the text box.
  // Perimeter pixels are pure background because glyph strokes stay inside text bounds.
  const samplePoints: { x: number; y: number }[] = [];

  const xSteps = 12;
  for (let i = 0; i <= xSteps; i++) {
    const px = x + (width * i) / xSteps;
    // 1px and 2px above the text box
    samplePoints.push({ x: Math.max(0, Math.min(cw - 1, px)), y: Math.max(0, y - 1) });
    samplePoints.push({ x: Math.max(0, Math.min(cw - 1, px)), y: Math.max(0, y - 2) });
    // 1px and 2px below the text box
    samplePoints.push({ x: Math.max(0, Math.min(cw - 1, px)), y: Math.min(ch - 1, y + height + 1) });
    samplePoints.push({ x: Math.max(0, Math.min(cw - 1, px)), y: Math.min(ch - 1, y + height + 2) });
  }

  const ySteps = 6;
  for (let j = 0; j <= ySteps; j++) {
    const py = y + (height * j) / ySteps;
    // 1px and 2px to the left and right of the text box
    samplePoints.push({ x: Math.max(0, x - 1), y: Math.max(0, Math.min(ch - 1, py)) });
    samplePoints.push({ x: Math.max(0, x - 2), y: Math.max(0, Math.min(ch - 1, py)) });
    samplePoints.push({ x: Math.min(cw - 1, x + width + 1), y: Math.max(0, Math.min(ch - 1, py)) });
    samplePoints.push({ x: Math.min(cw - 1, x + width + 2), y: Math.max(0, Math.min(ch - 1, py)) });
  }

  // Corners of the box
  samplePoints.push({ x: Math.max(0, x), y: Math.max(0, y) });
  samplePoints.push({ x: Math.min(cw - 1, x + width), y: Math.max(0, y) });
  samplePoints.push({ x: Math.max(0, x), y: Math.min(ch - 1, y + height) });
  samplePoints.push({ x: Math.min(cw - 1, x + width), y: Math.min(ch - 1, y + height) });

  // Interior grid points (background is the majority inside the box as well)
  for (const yf of [0.2, 0.5, 0.8]) {
    for (const xf of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      samplePoints.push({
        x: Math.max(0, Math.min(cw - 1, x + width * xf)),
        y: Math.max(0, Math.min(ch - 1, y + height * yf)),
      });
    }
  }

  interface ColorSample {
    r: number;
    g: number;
    b: number;
  }

  const samples: ColorSample[] = [];

  for (const pt of samplePoints) {
    try {
      const data = ctx.getImageData(Math.round(pt.x), Math.round(pt.y), 1, 1).data;
      if (data[3] < 30) continue; // transparent pixel
      samples.push({ r: data[0], g: data[1], b: data[2] });
    } catch {
      // ignore
    }
  }

  if (samples.length === 0) {
    return { r: 255, g: 255, b: 255, hex: "#ffffff" };
  }

  // 2. Statistical Mode Clustering (bucket size 12 in RGB) to find the TRUE background color
  // Background pixels always form the dominant cluster, regardless of whether background is dark or light.
  const buckets: { [key: string]: ColorSample[] } = {};
  for (const s of samples) {
    const br = Math.floor(s.r / 12) * 12;
    const bg = Math.floor(s.g / 12) * 12;
    const bb = Math.floor(s.b / 12) * 12;
    const key = `${br},${bg},${bb}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(s);
  }

  let bestKey = "";
  let maxCount = -1;
  for (const k in buckets) {
    if (buckets[k].length > maxCount) {
      maxCount = buckets[k].length;
      bestKey = k;
    }
  }

  const bestSamples = buckets[bestKey] || samples;
  const avgR = Math.round(bestSamples.reduce((acc, s) => acc + s.r, 0) / bestSamples.length);
  const avgG = Math.round(bestSamples.reduce((acc, s) => acc + s.g, 0) / bestSamples.length);
  const avgB = Math.round(bestSamples.reduce((acc, s) => acc + s.b, 0) / bestSamples.length);

  // 3. White snapping: ONLY snap to #ffffff if the color is actually pure near-white
  if (avgR >= 244 && avgG >= 244 && avgB >= 244 && Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB) <= 8) {
    return { r: 255, g: 255, b: 255, hex: "#ffffff" };
  }

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  const hex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;
  return { r: avgR, g: avgG, b: avgB, hex };
}

// Sample canvas text color by finding the contrasting glyph stroke pixels against the background
function sampleCanvasTextColor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  bgR: number,
  bgG: number,
  bgB: number
): string {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

  const xSteps = Math.min(Math.max(10, Math.round(width / 5)), 40);
  const ySteps = Math.min(Math.max(4, Math.round(height / 3)), 10);
  const glyphSamples: { r: number; g: number; b: number }[] = [];

  for (let j = 1; j < ySteps; j++) {
    const py = y + (height * j) / ySteps;
    for (let i = 1; i < xSteps; i++) {
      const px = x + (width * i) / xSteps;
      try {
        const data = ctx.getImageData(Math.round(px), Math.round(py), 1, 1).data;
        if (data[3] < 50) continue;
        const r = data[0], g = data[1], b = data[2];
        const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        // If color distance from background is significant (> 65), this is a text stroke!
        if (dist > 65) {
          glyphSamples.push({ r, g, b });
        }
      } catch {
        // ignore
      }
    }
  }

  if (glyphSamples.length === 0) {
    // Fallback: dark background -> white text, light background -> black text
    return bgLum < 128 ? "#ffffff" : "#000000";
  }

  const buckets: { [key: string]: { r: number; g: number; b: number }[] } = {};
  for (const s of glyphSamples) {
    const br = Math.floor(s.r / 16) * 16;
    const bg = Math.floor(s.g / 16) * 16;
    const bb = Math.floor(s.b / 16) * 16;
    const key = `${br},${bg},${bb}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(s);
  }

  let bestKey = "";
  let maxCount = -1;
  for (const k in buckets) {
    if (buckets[k].length > maxCount) {
      maxCount = buckets[k].length;
      bestKey = k;
    }
  }

  const bestGlyphs = buckets[bestKey] || glyphSamples;
  const avgR = Math.round(bestGlyphs.reduce((acc, s) => acc + s.r, 0) / bestGlyphs.length);
  const avgG = Math.round(bestGlyphs.reduce((acc, s) => acc + s.g, 0) / bestGlyphs.length);
  const avgB = Math.round(bestGlyphs.reduce((acc, s) => acc + s.b, 0) / bestGlyphs.length);

  const colorDiff = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);
  const maxVal = Math.max(avgR, avgG, avgB);
  const isNeutral = colorDiff < 40 || (maxVal > 0 && colorDiff / maxVal < 0.22);

  // On light backgrounds (white / light-grey page):
  // Any neutral text is ALWAYS 100% pure BLACK (#000000) (subpixel antialiasing must not turn text into faint grey)
  if (bgLum >= 130 && isNeutral) {
    return "#000000";
  }

  // On dark backgrounds (navy / dark blue / black slide):
  // Any neutral text is ALWAYS 100% pure WHITE (#ffffff)
  if (bgLum < 130 && isNeutral) {
    return "#ffffff";
  }

  if (avgR < 40 && avgG < 40 && avgB < 40) return "#000000";
  if (avgR > 215 && avgG > 215 && avgB > 215) return "#ffffff";

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;
}

// Intelligent Multi-line Text Wrapping with exact font width measurement
export function wrapTextIntoLines(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number
): string[] {
  if (!text) return [];
  const paragraphs = text.split("\n");
  const result: string[] = [];

  for (const para of paragraphs) {
    if (para.trim() === "") {
      result.push("");
      continue;
    }
    const words = para.split(/\s+/).filter(Boolean);
    let curLine = "";

    for (const w of words) {
      const test = curLine ? `${curLine} ${w}` : w;
      let wPx = 0;
      if (font && typeof font.widthOfTextAtSize === "function") {
        try {
          wPx = font.widthOfTextAtSize(test, fontSize);
        } catch {
          wPx = test.length * fontSize * 0.52;
        }
      } else {
        wPx = test.length * fontSize * 0.52;
      }

      if (wPx <= maxWidth || !curLine) {
        curLine = test;
      } else {
        result.push(curLine);
        curLine = w;
      }
    }
    if (curLine) {
      result.push(curLine);
    }
  }

  return result.length > 0 ? result : [text];
}

// Estimate line count for paragraph container sizing and reflow
export function estimateParagraphLineCount(
  text: string,
  width: number,
  fontSize: number
): number {
  if (!text) return 1;
  const paragraphs = text.split("\n");
  let totalLines = 0;
  const approxCharW = fontSize * 0.50;
  const charsPerLine = Math.max(8, Math.floor(width / approxCharW));

  for (const p of paragraphs) {
    if (!p) {
      totalLines += 1;
      continue;
    }
    const words = p.split(/\s+/).filter(Boolean);
    let curChars = 0;
    let pLines = 1;
    for (const w of words) {
      const wLen = w.length + 1;
      if (curChars + wLen <= charsPerLine || curChars === 0) {
        curChars += wLen;
      } else {
        pLines += 1;
        curChars = wLen;
      }
    }
    totalLines += pLines;
  }
  return Math.max(1, totalLines);
}

export function calculateExtraLines(item: EditableText): number {
  if (!item.currentText || !item.originalText) return 0;
  
  const origLines = item.originalLineCount || (item.lines ? item.lines.length : 1);
  const explicitCurrLines = item.currentText.split("\n").length;
  const explicitOrigLines = item.originalText.split("\n").length;
  const explicitExtra = Math.max(0, explicitCurrLines - explicitOrigLines);
  
  // Calculate character length difference
  const origLen = Math.max(item.originalText.length, 1);
  const currLen = item.currentText.length;
  const charDiff = currLen - origLen;
  
  // Average characters per line in this paragraph
  const charsPerLine = Math.max(15, Math.round(origLen / origLines));
  
  // Check width resize factor
  const widthRatio = (item.origWidth && item.origWidth > 20) ? (item.origWidth / item.width) : 1;
  
  let wrappedExtra = 0;
  if (widthRatio > 1.15) {
    // Box was resized to be noticeably narrower
    const newCapacityPerLine = Math.max(10, Math.floor(charsPerLine / widthRatio));
    const newTotalLines = Math.ceil(currLen / newCapacityPerLine);
    wrappedExtra = Math.max(0, newTotalLines - origLines);
  } else if (charDiff > charsPerLine * 0.75) {
    // User actually typed enough characters to warrant a new line
    wrappedExtra = Math.floor(charDiff / (charsPerLine * 0.85));
  }
  
  return Math.max(explicitExtra, wrappedExtra);
}

// In PDF editing, unedited canvas text should remain fixed in its original coordinates
// to prevent overlapping headings or duplicating text across the page.
export function calculatePageYShifts(_pageTexts?: EditableText[]): Map<string, number> {
  return new Map<string, number>();
}

// =========================================================================
// ROBUST DOCUMENT TEXT EXTRACTION & ADAPTIVE LINE/SEGMENT CLUSTERING
// =========================================================================
export function extractAndClusterPageText(
  textContent: any,
  viewport: any,
  pageNum: number,
  zoom: number,
  ctx?: CanvasRenderingContext2D | null
): EditableText[] {
  if (!textContent || !textContent.items || textContent.items.length === 0) {
    return [];
  }

  interface RawItemObj {
    str: string;
    vx: number;
    vy: number;
    topY: number;
    width: number;
    height: number;
    origPdfX: number;
    origPdfY: number;
    origWidth: number;
    origHeight: number;
    fontSizePt: number;
    fontNameCombined: string;
    hasEOL: boolean;
  }

  // 1. Ingest all raw text items from PDF.js content stream
  const rawList: RawItemObj[] = [];
  for (const item of textContent.items) {
    if (!item.str || item.str.length === 0) continue;

    const [vx, vy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    
    // In PDF specification, font size is defined by the transformation matrix:
    // Math.hypot(transform[2], transform[3]) is the true font size (vertical scale).
    // item.height in PDF.js is only glyph bounding box (~70% of font size), so prioritize transform!
    const transformFontSize = Math.max(
      Math.hypot(item.transform[2], item.transform[3]),
      Math.hypot(item.transform[0], item.transform[1])
    );
    const exactPt = transformFontSize > 0 ? transformFontSize : (item.height && item.height > 0 ? item.height : 12);
    const fontHeightPt = exactPt;
    const fontWidthPt = Math.hypot(item.transform[0], item.transform[1]) || exactPt;

    const itemHeight = fontHeightPt * zoom;
    const itemWidth = item.width && item.width > 0 ? item.width * zoom : item.str.length * fontWidthPt * 0.55 * zoom;

    const fontStyleObj = textContent.styles?.[item.fontName];
    const fontNameCombined = `${item.fontName || ""} ${fontStyleObj?.fontFamily || ""}`.toLowerCase();

    // vy is baseline in viewport coordinates
    const topY = vy - (itemHeight * 0.82);
    const boxH = itemHeight * 1.05;

    rawList.push({
      str: item.str,
      vx,
      vy,
      topY,
      width: itemWidth,
      height: boxH,
      origPdfX: item.transform[4],
      origPdfY: item.transform[5],
      origWidth: item.width || (item.str.length * fontWidthPt * 0.55),
      origHeight: fontHeightPt,
      fontSizePt: Math.round(exactPt * 10) / 10,
      fontNameCombined,
      hasEOL: Boolean(item.hasEOL),
    });
  }

  if (rawList.length === 0) return [];

  // Detect if this page contains corrupted ToUnicode CMap / font encoding
  // If ANY item contains control characters or scrambled glyphs, the whole font/page is corrupted!
  const pageHasCorruptedFonts = rawList.some(item =>
    isScrambledText(item.str) || /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(item.str)
  );

  const pageHasSerif = rawList.some(item =>
    /times|roman|georgia|cambria|garamond|palatino|baskerville|minion|nimbusrom|ptmr|cmr|\bserif\b/i.test(item.fontNameCombined) &&
    !/sans[\s-]*serif/i.test(item.fontNameCombined)
  );

  // 2. Sort items: Line-by-line using text BASELINE (vy) threshold, then left-to-right (vx)
  // This completely eliminates cross-column / mismatched font-size line scramble!
  rawList.sort((a, b) => {
    const baselineDiff = a.vy - b.vy;
    const lineThreshold = Math.min(a.fontSizePt, b.fontSizePt) * zoom * 0.70;
    if (Math.abs(baselineDiff) > lineThreshold) {
      return baselineDiff;
    }
    return a.vx - b.vx;
  });

  // 3. Cluster items into coherent, editable lines and headings
  interface ClusterGroup {
    strParts: string[];
    rawBoxes: RawBox[];
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    lastVx: number;
    lastWidth: number;
    lastVy: number;
    fontSize: number;
    fontNameCombined: string;
    origPdfX: number;
    origPdfY: number;
    origWidth: number;
    origHeight: number;
  }

  const clusters: ClusterGroup[] = [];
  let current: ClusterGroup | null = null;

  for (const item of rawList) {
    if (current) {
      const baselineDiff = Math.abs(item.vy - current.lastVy);
      const isSameLine = baselineDiff <= Math.max(current.fontSize * zoom * 0.70, 7);
      const prevRight = Math.max(current.maxX, current.lastVx + current.lastWidth);
      const gap = item.vx - prevRight;

      // Allow negative kerning (down to -40% font size) and generous word spacing for justified text (up to 5x font size or 80px)
      const minGap = -(current.fontSize * zoom * 0.40);
      const maxGap = Math.max(current.fontSize * zoom * 5.0, 80);
      const isAdjacent = gap >= minGap && gap <= maxGap;

      if (isSameLine && isAdjacent) {
        const lastStr = current.strParts[current.strParts.length - 1] || "";
        const needsSpace = gap > Math.max(current.fontSize * zoom * 0.12, 1.5) &&
          !lastStr.endsWith(" ") &&
          !item.str.startsWith(" ");

        if (needsSpace) {
          current.strParts.push(" ");
        }
        current.strParts.push(item.str);

        current.minX = Math.min(current.minX, item.vx);
        current.minY = Math.min(current.minY, item.topY);
        current.maxX = Math.max(current.maxX, item.vx + item.width);
        current.maxY = Math.max(current.maxY, item.topY + item.height);
        current.fontSize = Math.max(current.fontSize, item.fontSizePt);

        current.lastVx = item.vx;
        current.lastWidth = item.width;
        current.lastVy = item.vy;

        current.rawBoxes.push({
          x: item.vx,
          y: item.topY,
          width: item.width,
          height: item.height,
          origPdfX: item.origPdfX,
          origPdfY: item.origPdfY,
          origWidth: item.origWidth,
          origHeight: item.origHeight,
        });

        continue;
      } else {
        clusters.push(current);
        current = null;
      }
    }

    current = {
      strParts: [item.str],
      rawBoxes: [{
        x: item.vx,
        y: item.topY,
        width: item.width,
        height: item.height,
        origPdfX: item.origPdfX,
        origPdfY: item.origPdfY,
        origWidth: item.origWidth,
        origHeight: item.origHeight,
      }],
      minX: item.vx,
      minY: item.topY,
      maxX: item.vx + item.width,
      maxY: item.topY + item.height,
      lastVx: item.vx,
      lastWidth: item.width,
      lastVy: item.vy,
      fontSize: item.fontSizePt,
      fontNameCombined: item.fontNameCombined,
      origPdfX: item.origPdfX,
      origPdfY: item.origPdfY,
      origWidth: item.origWidth,
      origHeight: item.origHeight,
    };
  }

  if (current) {
    clusters.push(current);
  }

  // Filter out any purely empty whitespace clusters
  const validClusters = clusters.filter(c => c.strParts.join("").trim().length > 0);

  // 4. Convert single-line clusters into high-fidelity ExtractedLine objects
  interface ExtractedLine {
    text: string;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    vy: number;
    fontSize: number;
    fontFamily: "Helvetica" | "TimesRoman" | "Courier";
    fontNameRaw: string;
    isBold: boolean;
    isItalic: boolean;
    color: string;
    bgColor: string;
    bgRgb: [number, number, number];
    rawBoxes: RawBox[];
    origPdfX: number;
    origPdfY: number;
    origWidth: number;
    origHeight: number;
    isScrambled: boolean;
  }

  const extractedLines: ExtractedLine[] = validClusters.map((grp) => {
    const combinedText = grp.strParts.join("");
    const w = Math.max(grp.maxX - grp.minX, 20);
    const h = Math.max(grp.maxY - grp.minY, grp.fontSize * 1.05);

    const isFontBold = grp.fontNameCombined.includes("bold") ||
      grp.fontNameCombined.includes("black") ||
      grp.fontNameCombined.includes("heavy") ||
      grp.fontNameCombined.includes("semi") ||
      grp.fontSize >= 18;
    const isFontItalic = grp.fontNameCombined.includes("italic") || grp.fontNameCombined.includes("oblique");
    const fontLower = grp.fontNameCombined.toLowerCase();
    const isFontMono = /courier|mono|consolas|menlo|monaco/i.test(fontLower);
    const isFontSerif = !isFontMono && (
      /times|roman|georgia|cambria|garamond|palatino|baskerville|minion|nimbusrom|ptmr|cmr/i.test(fontLower) ||
      (/\bserif\b/i.test(fontLower) && !/sans[\s-]*serif/i.test(fontLower))
    );
    const isFontSans = !isFontMono && !isFontSerif && (
      /sans|arial|helvetica|roboto|calibri|open\s*sans|segoe|verdana|tahoma|system/i.test(fontLower)
    );

    const detectedFont: "Helvetica" | "TimesRoman" | "Courier" = isFontMono
      ? "Courier"
      : (isFontSerif || (!isFontSans && pageHasSerif))
      ? "TimesRoman"
      : "Helvetica";

    let bgHex = "#ffffff";
    let bgRgbVal: [number, number, number] = [255, 255, 255];
    let detectedColor = "#000000";
    if (ctx) {
      try {
        const dprScale = viewport.width > 0 ? (ctx.canvas.width / viewport.width) : 1;
        const bgSample = sampleCanvasBackgroundColor(ctx, grp.minX * dprScale, grp.minY * dprScale, w * dprScale, h * dprScale);
        bgHex = bgSample.hex;
        bgRgbVal = [bgSample.r, bgSample.g, bgSample.b];
        detectedColor = sampleCanvasTextColor(ctx, grp.minX * dprScale, grp.minY * dprScale, w * dprScale, h * dprScale, bgSample.r, bgSample.g, bgSample.b);

        const bgLum = 0.299 * bgSample.r + 0.587 * bgSample.g + 0.114 * bgSample.b;
        const [tr, tg, tb] = parseColorToRgb(detectedColor);
        const trByte = Math.round(tr * 255);
        const tgByte = Math.round(tg * 255);
        const tbByte = Math.round(tb * 255);
        const colorDiff = Math.max(trByte, tgByte, tbByte) - Math.min(trByte, tgByte, tbByte);
        const maxByte = Math.max(trByte, tgByte, tbByte);
        const isNeutral = colorDiff < 40 || (maxByte > 0 && colorDiff / maxByte < 0.22);

        if (bgLum >= 130) {
          if (isNeutral) detectedColor = "#000000";
        } else if (bgLum < 130) {
          if (isNeutral) detectedColor = "#ffffff";
        }
      } catch {}
    }

    const isScrambled = pageHasCorruptedFonts || isScrambledText(combinedText);

    return {
      text: combinedText,
      minX: grp.minX,
      minY: grp.minY,
      maxX: grp.maxX,
      maxY: grp.maxY,
      width: w,
      height: h,
      vy: grp.lastVy,
      fontSize: grp.fontSize,
      fontFamily: detectedFont,
      fontNameRaw: grp.fontNameCombined,
      isBold: isFontBold,
      isItalic: isFontItalic,
      color: detectedColor,
      bgColor: bgHex,
      bgRgb: bgRgbVal,
      rawBoxes: grp.rawBoxes,
      origPdfX: grp.origPdfX,
      origPdfY: grp.origPdfY,
      origWidth: grp.rawBoxes.reduce((acc, b) => acc + b.origWidth, 0),
      origHeight: grp.origHeight,
      isScrambled,
    };
  });

  // Sort extracted lines vertically (top to bottom), then left to right
  extractedLines.sort((a, b) => {
    const diffY = a.minY - b.minY;
    if (Math.abs(diffY) > 5) return diffY;
    return a.minX - b.minX;
  });

  // 5. Cluster lines into coherent Paragraph Blocks while strictly protecting headings, titles, and labels
  interface ParagraphCluster {
    lines: ExtractedLine[];
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontFamily: "Helvetica" | "TimesRoman" | "Courier";
    fontNameRaw: string;
    isBold: boolean;
    isItalic: boolean;
    color: string;
    bgColor: string;
    bgRgb: [number, number, number];
    align: "left" | "center" | "right" | "justify";
    lineHeight: number;
    isScrambled: boolean;
  }

  // Pre-calculate page-wide column right edges
  const colRightEdges = extractedLines.map(line => {
    const colLines = extractedLines.filter(l => Math.abs(l.minX - line.minX) <= 25);
    return colLines.length > 0 ? Math.max(...colLines.map(l => l.maxX)) : line.maxX;
  });

  const paragraphClusters: ParagraphCluster[] = [];
  let curPara: ParagraphCluster | null = null;

  for (let li = 0; li < extractedLines.length; li++) {
    const line = extractedLines[li];
    const colRight = colRightEdges[li];
    const lineTrimmed = line.text.trim();
    const nextLine = extractedLines[li + 1];

    // Standalone headings (e.g. "ABSTRACT", "INTRODUCTION", "REFERENCES")
    // These should stay as their own 1-line block and not merge with body paragraphs.
    const isAllCapsTitle = /^[A-Z0-9\s:_-]{3,35}$/.test(lineTrimmed) &&
      lineTrimmed === lineTrimmed.toUpperCase() &&
      !/[.,;]/.test(lineTrimmed) &&
      (/[A-Z]/.test(lineTrimmed));

    const isNumberedHeading = /^[0-9]+(\.[0-9]+)*\s+[A-Z][A-Za-z0-9\s_-]{2,35}$/.test(lineTrimmed) &&
      !/[.,;]$/.test(lineTrimmed);

    const isBoldTitle = line.isBold && nextLine && !nextLine.isBold &&
      lineTrimmed.length < 40 &&
      !/[.,;]$/.test(lineTrimmed);

    const isStandaloneHeading = isAllCapsTitle || isNumberedHeading || isBoldTitle;

    // Does this line start a distinct document section / label (like "Keywords:", "Figure 1:", "Table 1:")?
    // If so, it must start a new paragraph block rather than merging into the preceding text.
    const startsNewSectionLabel = /^([0-9]+(\.[0-9]+)*\s+[A-Z]|Keywords:|Index Terms:|Abstract:|References:|Note:|Figure\s+[0-9]+:|Table\s+[0-9]+:)/i.test(lineTrimmed);

    if (curPara) {
      const lastLine = curPara.lines[curPara.lines.length - 1];
      const baselineDiff = line.vy - lastLine.vy;

      // Same font styling and size
      const sameFont = line.fontFamily === curPara.fontFamily &&
                       line.isBold === curPara.isBold &&
                       line.isItalic === curPara.isItalic;
      const sameSize = Math.abs(line.fontSize - curPara.fontSize) <= 1.2;

      // Normal paragraph line spacing (between 0.80x and 1.80x of font size)
      const isNormalLineSpacing = baselineDiff >= curPara.fontSize * 0.80 && baselineDiff <= curPara.fontSize * 1.80;

      // Same column alignment (allowing indentation) OR horizontally centered lines (e.g. multi-line centered titles)
      const sameColumn = Math.abs(line.minX - curPara.x) <= Math.max(curPara.fontSize * 2.5, 30);
      const lastLineMid = (lastLine.minX + lastLine.maxX) / 2;
      const lineMid = (line.minX + line.maxX) / 2;
      const isCenteredTogether = Math.abs(lastLineMid - lineMid) <= Math.max(curPara.fontSize * 2.5, 45);
      const isSameAlignment = sameColumn || isCenteredTogether;

      // Paragraph termination detection: last line ended with punctuation and ended well before the column right margin
      const lastLineEndsPara = /[.!?]\s*$/.test(lastLine.text.trim()) &&
                               (colRight - lastLine.maxX > Math.max(curPara.fontSize * 3.5, 45));

      // curPara itself was a standalone heading or title
      const curParaIsHeading = curPara.lines.length === 1 && (
        (/^[A-Z0-9\s:_-]{3,35}$/.test(curPara.lines[0].text.trim()) &&
         curPara.lines[0].text.trim() === curPara.lines[0].text.trim().toUpperCase() &&
         !/[.,;]/.test(curPara.lines[0].text.trim())) ||
        (curPara.lines[0].isBold && !line.isBold && curPara.lines[0].text.trim().length < 40)
      );

      // If curPara has bold/large text and this line also has the SAME bold/large text, they belong together in the title
      const isTitleContinuation = curPara.isBold && line.isBold && sameSize && isSameAlignment;
      const shouldBlockMerge = !isTitleContinuation && (isStandaloneHeading || curParaIsHeading);

      if (
        sameFont &&
        sameSize &&
        isNormalLineSpacing &&
        isSameAlignment &&
        !lastLineEndsPara &&
        !shouldBlockMerge &&
        !startsNewSectionLabel
      ) {
        curPara.lines.push(line);
        curPara.x = Math.min(curPara.x, line.minX);
        const newMaxX = Math.max(curPara.x + curPara.width, line.maxX);
        curPara.width = newMaxX - curPara.x;
        curPara.height = (line.maxY - curPara.y);
        curPara.lineHeight = (line.vy - curPara.lines[0].vy) / (curPara.lines.length - 1);
        if (line.isScrambled) curPara.isScrambled = true;
        continue;
      } else {
        paragraphClusters.push(curPara);
        curPara = null;
      }
    }

    curPara = {
      lines: [line],
      x: line.minX,
      y: line.minY,
      width: line.width,
      height: line.height,
      fontSize: line.fontSize,
      fontFamily: line.fontFamily,
      fontNameRaw: line.fontNameRaw,
      isBold: line.isBold,
      isItalic: line.isItalic,
      color: line.color,
      bgColor: line.bgColor,
      bgRgb: line.bgRgb,
      align: "left",
      lineHeight: line.fontSize * 1.25,
      isScrambled: line.isScrambled,
    };
  }

  if (curPara) {
    paragraphClusters.push(curPara);
  }

  // 6. Detect Justification / Text Alignment & finalize column widths for multi-line paragraphs
  for (const para of paragraphClusters) {
    if (para.lines.length >= 2) {
      const minX = Math.min(...para.lines.map(l => l.minX));
      const maxX = Math.max(...para.lines.map(l => l.maxX));
      para.x = minX;
      para.width = Math.max(maxX - minX + 6, 30);
      para.height = Math.max(para.height, para.lines.length * para.lineHeight + (para.fontSize * 0.45));

      const nonTerminalLines = para.lines.slice(0, para.lines.length - 1);
      const rightEdges = nonTerminalLines.map(l => l.maxX);
      const rightEdgeSpread = rightEdges.length > 0 ? (Math.max(...rightEdges) - Math.min(...rightEdges)) : 0;
      const allNonTerminalNearMargin = nonTerminalLines.length > 0 && nonTerminalLines.every(l => (maxX - l.maxX) <= 24);

      // In justified text, non-terminal lines are flush to the right margin
      if (rightEdgeSpread <= 22 || allNonTerminalNearMargin) {
        para.align = "justify";
      } else {
        const centers = para.lines.map(l => (l.minX + l.maxX) / 2);
        const centerSpread = Math.max(...centers) - Math.min(...centers);
        if (centerSpread <= 8) {
          para.align = "center";
        } else {
          const allRights = para.lines.map(l => l.maxX);
          if (Math.max(...allRights) - Math.min(...allRights) <= 8) {
            para.align = "right";
          } else {
            para.align = "left";
          }
        }
      }
    } else {
      const line = para.lines[0];
      const pageMid = viewport.width / 2;
      const lineMid = (line.minX + line.maxX) / 2;
      if (Math.abs(lineMid - pageMid) < 15 && line.width < viewport.width * 0.7) {
        para.align = "center";
      } else {
        para.align = "left";
      }
    }
  }

  // 7. Generate clean, high-fidelity EditableText objects
  return paragraphClusters.map((para, idx) => {
    let fullText = "";
    for (let li = 0; li < para.lines.length; li++) {
      const lText = para.lines[li].text.trim();
      if (li === 0) {
        fullText = lText;
      } else {
        if (fullText.endsWith("-") && /^[a-zA-Z]/.test(lText)) {
          fullText = fullText.slice(0, -1) + lText;
        } else {
          fullText += " " + lText;
        }
      }
    }

    const words = fullText.split(/\s+/);
    const maxWordLen = words.reduce((max, w) => Math.max(max, w.length), 0);
    const minWordWidth = Math.max(maxWordLen * para.fontSize * 0.65, 30);
    const finalWidth = Math.max(para.width + 4, minWordWidth);
    const finalHeight = Math.max(para.height, para.fontSize * 1.05);

    return {
      id: `p${pageNum}-txt-${idx}`,
      page: pageNum,
      originalText: fullText,
      currentText: fullText,
      x: para.x,
      y: para.y,
      origX: para.x,
      origY: para.y,
      width: finalWidth,
      height: finalHeight,
      fontSize: para.fontSize,
      fontFamily: para.fontFamily,
      fontNameRaw: para.fontNameRaw,
      isBold: para.isBold,
      isItalic: para.isItalic,
      color: para.color,
      bgColor: para.bgColor,
      bgRgb: para.bgRgb,
      align: para.align,
      lineHeight: Math.max(para.lineHeight, para.fontSize * 1.15),
      isOriginal: true,
      whiteoutOriginal: false,
      origPdfX: para.lines[0]?.origPdfX,
      origPdfY: para.lines[0]?.origPdfY,
      origWidth: finalWidth,
      origHeight: finalHeight,
      rawBoxes: para.lines.flatMap(l => l.rawBoxes || []),
      lines: para.lines.map(l => ({
        text: l.text,
        x: l.minX,
        y: l.minY,
        width: l.width,
        height: l.height,
        vy: l.vy,
        origPdfX: l.origPdfX,
        origPdfY: l.origPdfY,
        origWidth: l.origWidth,
        origHeight: l.origHeight,
        rawBoxes: l.rawBoxes,
      })),
      originalLineCount: para.lines.length,
      isScrambled: para.isScrambled,
    };
  });
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export function EditConfig({ files, onProcess, slug }: EditConfigProps) {
  const isSignTool = slug === "sign-pdf";
  const [isPdfJsLoaded, setIsPdfJsLoaded] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1.0); // 100% default zoom for crisp, sharp 1:1 document rendering
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const [pageRotations, setPageRotations] = useState<{ [page: number]: number }>({});
  const [pageDimensions, setPageDimensions] = useState<{ [page: number]: { width: number; height: number } }>({});
  const [sidebarTab, setSidebarTab] = useState<"thumbnails" | "outline" | "bookmarks" | "more">("thumbnails");
  const pageCanvasRefs = useRef<{ [page: number]: HTMLCanvasElement | null }>({});
  const drawCanvasRefs = useRef<{ [page: number]: HTMLCanvasElement | null }>({});

  // Active Tool
  type ToolType = "select" | "edit-text" | "add-text" | "whiteout" | "signature" | "shape" | "draw" | "highlight" | "image";
  const [activeTool, setActiveTool] = useState<ToolType>(isSignTool ? "signature" : "edit-text");

  // Style attributes
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState<"Helvetica" | "TimesRoman" | "Courier">("Helvetica");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [selectedShapeType, setSelectedShapeType] = useState<"rectangle" | "circle" | "line" | "arrow">("rectangle");
  const [shapeFillColor, setShapeFillColor] = useState("transparent");

  // Annotations
  const [textList, setTextList] = useState<EditableText[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [images, setImages] = useState<ImageAnnotation[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [shapes, setShapes] = useState<ShapeAnnotation[]>([]);
  const [activeShapeId, setActiveShapeId] = useState<string | null>(null);
  const [whiteouts, setWhiteouts] = useState<WhiteoutAnnotation[]>([]);
  const [activeWhiteoutId, setActiveWhiteoutId] = useState<string | null>(null);

  // PDF Embedded Images (Photos, Logos, Stamps extracted from PDF)
  const [embeddedImages, setEmbeddedImages] = useState<EmbeddedPdfImage[]>([]);
  const [activeEmbeddedImgId, setActiveEmbeddedImgId] = useState<string | null>(null);
  const replaceImgInputRef = useRef<HTMLInputElement>(null);
  const [replacingImgId, setReplacingImgId] = useState<string | null>(null);

  // Multi-Page Thumbnails & Deep Scanner
  const [pageThumbnails, setPageThumbnails] = useState<{ [page: number]: string }>({});
  const [pageStats, setPageStats] = useState<{ [page: number]: { texts: number; images: number } }>({});
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; texts: number; images: number } | null>(null);
  const [showThumbnailsSidebar, setShowThumbnailsSidebar] = useState(true);
  const [showInspectorSidebar, setShowInspectorSidebar] = useState(true);

  // History Stack for Undo / Redo
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  // Dragging & Resizing States
  const [draggingItemId, setDraggingItemId] = useState<{ type: "text" | "image" | "shape" | "whiteout" | "embedded-image"; id: string } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingItemId, setResizingItemId] = useState<{ type: "text" | "image" | "shape" | "whiteout" | "embedded-image"; id: string } | null>(null);
  const [resizeInitial, setResizeInitial] = useState<{ startX: number; startY: number; initialW: number; initialH: number }>({ startX: 0, startY: 0, initialW: 0, initialH: 0 });

  // Freehand Drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawActions, setDrawActions] = useState<{ [page: number]: ImageData[] }>({});

  // Interactive Shape/Whiteout creation via drag
  const [isCreatingBox, setIsCreatingBox] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDragRect, setCurrentDragRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Modals
  const [showSignatureModal, setShowSignatureModal] = useState(isSignTool);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [replaceMessage, setReplaceMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [ocrLoadingId, setOcrLoadingId] = useState<string | null>(null);

  // Auto-Fix Scrambled Text: Crops visual text from canvas and runs AI OCR to restore original characters
  const handleAutoFixText = async (item: EditableText) => {
    if (!pdfCanvasRef.current) return;
    setOcrLoadingId(item.id);
    try {
      const cropDataUrl = cropCanvasForOcr(
        pdfCanvasRef.current,
        item.x,
        item.y,
        item.width,
        item.height
      );
      if (!cropDataUrl) return;

      // Note: OCR text reconstruction is scheduled for the upcoming V1 AI module (/api/v1/jobs)
      console.info("OCR text reconstruction will be available via /api/v1/jobs in the upcoming AI release.");
    } catch (err) {
      console.warn("Auto-fix OCR warning:", err);
    } finally {
      setOcrLoadingId(null);
    }
  };
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(1000);
  const [canvasHeight, setCanvasHeight] = useState<number>(1400);

  // Save snapshot to Undo Stack
  const takeSnapshot = useCallback(() => {
    setUndoStack(prev => [
      ...prev.slice(-30),
      {
        textList: JSON.parse(JSON.stringify(textList)),
        whiteouts: JSON.parse(JSON.stringify(whiteouts)),
        images: JSON.parse(JSON.stringify(images)),
        shapes: JSON.parse(JSON.stringify(shapes)),
        embeddedImages: JSON.parse(JSON.stringify(embeddedImages)),
      }
    ]);
    setRedoStack([]);
  }, [textList, whiteouts, images, shapes, embeddedImages]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [
      ...prev,
      {
        textList: JSON.parse(JSON.stringify(textList)),
        whiteouts: JSON.parse(JSON.stringify(whiteouts)),
        images: JSON.parse(JSON.stringify(images)),
        shapes: JSON.parse(JSON.stringify(shapes)),
        embeddedImages: JSON.parse(JSON.stringify(embeddedImages)),
      }
    ]);
    setTextList(previous.textList);
    setWhiteouts(previous.whiteouts);
    setImages(previous.images);
    setShapes(previous.shapes);
    if (previous.embeddedImages) setEmbeddedImages(previous.embeddedImages);
    setUndoStack(prev => prev.slice(0, prev.length - 1));
  }, [undoStack, textList, whiteouts, images, shapes, embeddedImages]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [
      ...prev,
      {
        textList: JSON.parse(JSON.stringify(textList)),
        whiteouts: JSON.parse(JSON.stringify(whiteouts)),
        images: JSON.parse(JSON.stringify(images)),
        shapes: JSON.parse(JSON.stringify(shapes)),
        embeddedImages: JSON.parse(JSON.stringify(embeddedImages)),
      }
    ]);
    setTextList(next.textList);
    setWhiteouts(next.whiteouts);
    setImages(next.images);
    setShapes(next.shapes);
    if (next.embeddedImages) setEmbeddedImages(next.embeddedImages);
    setRedoStack(prev => prev.slice(0, prev.length - 1));
  }, [redoStack, textList, whiteouts, images, shapes, embeddedImages]);

  // Keyboard shortcut listener for Cmd/Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Load PDF.js dynamically
  useEffect(() => {
    if ((window as any).pdfjsLib) {
      setIsPdfJsLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        setIsPdfJsLoaded(true);
      }
    };
    document.head.appendChild(script);
  }, []);

  // Load PDF file document
  useEffect(() => {
    if (!isPdfJsLoaded || !files || files.length === 0) return;
    let isCancelled = false;

    const loadPdfFile = async () => {
      try {
        const arrayBuffer = await files[0].arrayBuffer();
        const loadedPdf = await (window as any).pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/",
        }).promise;
        if (isCancelled) return;
        setPdfDoc(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setCurrentPage(1);

        const baseDims: { [page: number]: { width: number; height: number } } = {};
        for (let p = 1; p <= loadedPdf.numPages; p++) {
          const pg = await loadedPdf.getPage(p);
          const vp = pg.getViewport({ scale: 1.0 });
          baseDims[p] = { width: Math.round(vp.width), height: Math.round(vp.height) };
        }
        if (!isCancelled) {
          setPageDimensions(baseDims);
        }
      } catch (err) {
        console.error("Failed to load PDF in editor:", err);
      }
    };

    loadPdfFile();
    return () => { isCancelled = true; };
  }, [isPdfJsLoaded, files]);

  // Multi-page Continuous Rendering and Text Extraction is handled by renderAllPages below

  // Helper: Extract embedded images (photos, logos, signatures) from PDF page operator stream
  const extractEmbeddedImagesFromPage = async (
    page: any,
    viewport: any,
    pdfCanvas: HTMLCanvasElement,
    currentPageNum: number
  ): Promise<EmbeddedPdfImage[]> => {
    try {
      const opList = await page.getOperatorList();
      const OPS = (window as any).pdfjsLib?.OPS;
      if (!OPS || !opList || !opList.fnArray) return [];

      let currentMatrix = [1, 0, 0, 1, 0, 0];
      const matrixStack: number[][] = [];
      const detected: EmbeddedPdfImage[] = [];

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];

        if (fn === OPS.save) {
          matrixStack.push([...currentMatrix]);
        } else if (fn === OPS.restore) {
          currentMatrix = matrixStack.pop() || [1, 0, 0, 1, 0, 0];
        } else if (fn === OPS.transform && args && args.length >= 6) {
          currentMatrix = [
            currentMatrix[0] * args[0] + currentMatrix[2] * args[1],
            currentMatrix[1] * args[0] + currentMatrix[3] * args[1],
            currentMatrix[0] * args[2] + currentMatrix[2] * args[3],
            currentMatrix[1] * args[2] + currentMatrix[3] * args[3],
            currentMatrix[0] * args[4] + currentMatrix[2] * args[5] + currentMatrix[4],
            currentMatrix[1] * args[4] + currentMatrix[3] * args[5] + currentMatrix[5],
          ];
        } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
          const p0 = [currentMatrix[4], currentMatrix[5]];
          const p1 = [currentMatrix[0] + currentMatrix[4], currentMatrix[1] + currentMatrix[5]];
          const p2 = [currentMatrix[0] + currentMatrix[2] + currentMatrix[4], currentMatrix[1] + currentMatrix[3] + currentMatrix[5]];
          const p3 = [currentMatrix[2] + currentMatrix[4], currentMatrix[3] + currentMatrix[5]];

          const cp0 = viewport.convertToViewportPoint(p0[0], p0[1]);
          const cp1 = viewport.convertToViewportPoint(p1[0], p1[1]);
          const cp2 = viewport.convertToViewportPoint(p2[0], p2[1]);
          const cp3 = viewport.convertToViewportPoint(p3[0], p3[1]);

          const minX = Math.round(Math.min(cp0[0], cp1[0], cp2[0], cp3[0]));
          const minY = Math.round(Math.min(cp0[1], cp1[1], cp2[1], cp3[1]));
          const maxX = Math.round(Math.max(cp0[0], cp1[0], cp2[0], cp3[0]));
          const maxY = Math.round(Math.max(cp0[1], cp1[1], cp2[1], cp3[1]));
          const w = maxX - minX;
          const h = maxY - minY;

          const origW = Math.abs(currentMatrix[0]) || Math.hypot(currentMatrix[0], currentMatrix[1]);
          const origH = Math.abs(currentMatrix[3]) || Math.hypot(currentMatrix[2], currentMatrix[3]);

          // Filter out decorative background fills, horizontal divider lines, table borders, and full-page backgrounds:
          // 1. Minimum dimensions: Real user images/photos/logos are not thin 15pt strips or 5pt lines.
          if (origW < 28 || origH < 28) continue;
          if (w < 35 || h < 35) continue;

          // 2. Aspect ratio check: Background shading strips / divider rules have extreme aspect ratios (e.g. 10:1, 35:1).
          const aspectRatio = origW / origH;
          if (aspectRatio > 4.5 || aspectRatio < 0.22) {
            // Extreme aspect ratio is a decorative bar/divider, not a photo or logo
            continue;
          }

          // 3. Ignore full-bleed or near full-page background sheets
          if (w >= viewport.width * 0.92 && h >= viewport.height * 0.92) continue;

          let snapshotDataUrl = "";
          try {
            const snapCanvas = document.createElement("canvas");
            snapCanvas.width = Math.max(1, w);
            snapCanvas.height = Math.max(1, h);
            const sCtx = snapCanvas.getContext("2d");
            if (sCtx) {
              sCtx.drawImage(pdfCanvas, minX, minY, w, h, 0, 0, w, h);
              snapshotDataUrl = snapCanvas.toDataURL("image/png");
            }
          } catch {}

          detected.push({
            id: `p${currentPageNum}-embimg-${detected.length}`,
            page: currentPageNum,
            x: minX,
            y: minY,
            width: w,
            height: h,
            origPdfX: Math.min(p0[0], p1[0], p2[0], p3[0]),
            origPdfY: Math.min(p0[1], p1[1], p2[1], p3[1]),
            origWidth: Math.abs(currentMatrix[0]) || Math.hypot(currentMatrix[0], currentMatrix[1]),
            origHeight: Math.abs(currentMatrix[3]) || Math.hypot(currentMatrix[2], currentMatrix[3]),
            dataUrl: snapshotDataUrl,
          });
        }
      }
      return detected;
    } catch (err) {
      console.warn("Could not extract embedded images:", err);
      return [];
    }
  };

  // Scroll center desk smoothly to specific page
  const scrollToPage = useCallback((pageNum: number) => {
    setCurrentPage(pageNum);
    const el = document.getElementById(`pdf-page-${pageNum}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Update active page based on continuous scroll probe
  const handleDeskScroll = useCallback(() => {
    if (!containerRef.current) return;
    const deskRect = containerRef.current.getBoundingClientRect();
    const probeY = deskRect.top + 160;

    for (let p = 1; p <= totalPages; p++) {
      const el = document.getElementById(`pdf-page-${p}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom >= probeY) {
          if (currentPage !== p) {
            setCurrentPage(p);
          }
          break;
        }
      }
    }
  }, [totalPages, currentPage]);

  // Multi-Page Continuous Renderer & Deep Scanner (Runs on PDF load or page rotation)
  useEffect(() => {
    if (!pdfDoc) return;
    let isCancelled = false;

    const renderAllPages = async () => {
      setIsScanning(true);
      const total = pdfDoc.numPages;
      let totalTexts = 0;
      let totalImages = 0;

      const dpr = typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 2) : 2;

      for (let p = 1; p <= total; p++) {
        if (isCancelled) break;
        try {
          setScanProgress({ current: p, total, texts: totalTexts, images: totalImages });
          const pg = await pdfDoc.getPage(p);
          if (isCancelled) break;

          const rot = (pageRotations[p] || 0) % 360;
          const baseViewport = pg.getViewport({ scale: 1.0, rotation: rot });
          // Render internal canvas bitmap at ultra-crisp resolution (scale 3.0 / 2x DPR)
          const renderScale = Math.max(2.5, dpr * 1.5);
          const renderViewport = pg.getViewport({ scale: renderScale, rotation: rot });

          const baseW = Math.round(baseViewport.width);
          const baseH = Math.round(baseViewport.height);

          setPageDimensions(prev => ({
            ...prev,
            [p]: { width: baseW, height: baseH }
          }));

          // 1. Render Base Canvas for Page p
          let canvas = pageCanvasRefs.current[p];
          if (!canvas) {
            for (let retry = 0; retry < 6 && !canvas && !isCancelled; retry++) {
              await new Promise(r => setTimeout(r, 50));
              canvas = pageCanvasRefs.current[p];
            }
          }
          let ctx: CanvasRenderingContext2D | null = null;
          if (canvas) {
            canvas.width = Math.floor(renderViewport.width);
            canvas.height = Math.floor(renderViewport.height);
            ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              try {
                await pg.render({ canvasContext: ctx, viewport: renderViewport, intent: "display" }).promise;
              } catch (rErr: any) {
                if (rErr?.name !== "RenderingCancelledException") console.warn(`Page ${p} render warning:`, rErr);
              }
            }
          }

          // 2. Restore Drawing Canvas for Page p if any
          const dCanvas = drawCanvasRefs.current[p];
          if (dCanvas) {
            dCanvas.width = Math.floor(renderViewport.width);
            dCanvas.height = Math.floor(renderViewport.height);
            const drawCtx = dCanvas.getContext("2d");
            const pageHistory = drawActions[p];
            if (drawCtx && pageHistory && pageHistory.length > 0) {
              drawCtx.putImageData(pageHistory[pageHistory.length - 1], 0, 0);
            }
          }

          // 3. Extract & Cluster Text for Page p at scale 1.0 (PDF points)
          const textContent = await pg.getTextContent();
          if (isCancelled) break;
          const pageTexts = extractAndClusterPageText(textContent, baseViewport, p, 1.0, ctx);
          totalTexts += pageTexts.length;

          setTextList(prev => {
            const otherPages = prev.filter(item => item.page !== p);
            const existingPage = prev.filter(item => item.page === p);
            if (existingPage.length === 0) {
              return [...otherPages, ...pageTexts];
            }
            const merged = pageTexts.map(fresh => {
              const userEdited = existingPage.find(ex => ex.id === fresh.id || (Math.abs(ex.x - fresh.x) < 8 && Math.abs(ex.y - fresh.y) < 8));
              if (userEdited && (userEdited.whiteoutOriginal || userEdited.currentText !== userEdited.originalText || !userEdited.isOriginal)) {
                return { ...userEdited, bgColor: fresh.bgColor, color: userEdited.color || fresh.color };
              }
              return fresh;
            });
            const userAdded = existingPage.filter(it => !it.isOriginal);
            return [...otherPages, ...merged, ...userAdded];
          });

          // 4. Generate Thumbnail for Page p
          const thumbViewport = pg.getViewport({ scale: 0.22, rotation: rot });
          const tCanvas = document.createElement("canvas");
          tCanvas.width = thumbViewport.width;
          tCanvas.height = thumbViewport.height;
          const tCtx = tCanvas.getContext("2d");
          if (tCtx) {
            try {
              await pg.render({ canvasContext: tCtx, viewport: thumbViewport }).promise;
              if (isCancelled) break;
              const dataUrl = tCanvas.toDataURL("image/jpeg", 0.85);
              setPageThumbnails(prev => ({ ...prev, [p]: dataUrl }));
            } catch {}
          }

          // 5. Embedded Images for Page p at scale 1.0 (PDF points)
          if (canvas) {
            const pageEmbedded = await extractEmbeddedImagesFromPage(pg, baseViewport, canvas, p);
            if (pageEmbedded.length > 0) {
              setEmbeddedImages(prev => {
                const otherPages = prev.filter(img => img.page !== p);
                const currentExisting = prev.filter(img => img.page === p);
                if (currentExisting.length > 0) {
                  return [
                    ...otherPages,
                    ...currentExisting.map((ex, idx) => {
                      const fresh = pageEmbedded[idx];
                      return fresh ? { ...ex, x: fresh.x, y: fresh.y, width: fresh.width, height: fresh.height } : ex;
                    })
                  ];
                }
                return [...otherPages, ...pageEmbedded];
              });
            }
          }

        } catch (e) {
          console.warn(`Render error on page ${p}:`, e);
        }
      }

      if (!isCancelled) {
        setIsScanning(false);
        setTimeout(() => { if (!isCancelled) setScanProgress(null); }, 3000);
      }
    };

    renderAllPages();
    return () => { isCancelled = true; };
  }, [pdfDoc, pageRotations]);

  // Freehand Drawing Handlers
  // Freehand Drawing Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, pNum?: number) => {
    const targetPage = pNum || currentPage;
    const canvas = drawCanvasRefs.current[targetPage] || drawCanvasRef.current;
    if (!canvas) return;
    if (currentPage !== targetPage) setCurrentPage(targetPage);
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const baseX = cssX / zoom;
    const baseY = cssY / zoom;

    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    const drawX = cssX * scaleX;
    const drawY = cssY * scaleY;

    if (activeTool === "draw" || activeTool === "highlight") {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(drawX, drawY);
      ctx.strokeStyle = activeTool === "highlight" ? `${selectedColor}44` : selectedColor;
      ctx.lineWidth = (activeTool === "highlight" ? strokeWidth * 4 : strokeWidth) * scaleX;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      setIsDrawing(true);
    } else if (activeTool === "whiteout" || activeTool === "shape") {
      setIsCreatingBox(true);
      setBoxStart({ x: baseX, y: baseY });
      setCurrentDragRect({ x: baseX, y: baseY, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, pNum?: number) => {
    const targetPage = pNum || currentPage;
    const canvas = drawCanvasRefs.current[targetPage] || drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    const baseX = cssX / zoom;
    const baseY = cssY / zoom;

    if (isDrawing) {
      const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
      const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
      const drawX = cssX * scaleX;
      const drawY = cssY * scaleY;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.lineTo(drawX, drawY);
      ctx.stroke();
    } else if (isCreatingBox && boxStart) {
      const left = Math.min(baseX, boxStart.x);
      const top = Math.min(baseY, boxStart.y);
      const width = Math.abs(baseX - boxStart.x);
      const height = Math.abs(baseY - boxStart.y);
      setCurrentDragRect({ x: left, y: top, width, height });
    }
  };

  const handleMouseUp = (pNum?: number) => {
    const targetPage = pNum || currentPage;
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = drawCanvasRefs.current[targetPage] || drawCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setDrawActions(prev => ({
            ...prev,
            [targetPage]: [...(prev[targetPage] || []), data]
          }));
        }
      }
    } else if (isCreatingBox && currentDragRect) {
      setIsCreatingBox(false);
      if (currentDragRect.width > 6 && currentDragRect.height > 6) {
        takeSnapshot();
        if (activeTool === "whiteout") {
          const newWhiteout: WhiteoutAnnotation = {
            id: `wo-${Date.now()}`,
            page: targetPage,
            ...currentDragRect,
            color: "#ffffff",
          };
          setWhiteouts(prev => [...prev, newWhiteout]);
          setActiveWhiteoutId(newWhiteout.id);
        } else if (activeTool === "shape") {
          const newShape: ShapeAnnotation = {
            id: `shape-${Date.now()}`,
            page: targetPage,
            type: selectedShapeType,
            ...currentDragRect,
            strokeColor: selectedColor,
            strokeWidth,
            fillColor: shapeFillColor,
            opacity: 1,
          };
          setShapes(prev => [...prev, newShape]);
          setActiveShapeId(newShape.id);
        }
      }
      setBoxStart(null);
      setCurrentDragRect(null);
      setActiveTool("select");
    }
  };

  // Canvas Click: Add new text box or deselect
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>, pNum?: number) => {
    const targetPage = pNum || currentPage;
    if (activeTool === "add-text") {
      const canvas = pageCanvasRefs.current[targetPage] || pdfCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(10, (e.clientX - rect.left) / zoom);
      const y = Math.max(10, (e.clientY - rect.top) / zoom);

      takeSnapshot();
      const newId = `new-txt-${Date.now()}`;
      const newText: EditableText = {
        id: newId,
        page: targetPage,
        originalText: "",
        currentText: "New text",
        x,
        y,
        width: 160,
        height: fontSize * 1.2,
        fontSize,
        fontFamily,
        isBold,
        isItalic,
        color: selectedColor,
        bgColor: "#ffffff",
        bgRgb: [255, 255, 255],
        align: "left",
        lineHeight: fontSize * 1.25,
        isOriginal: false,
        whiteoutOriginal: false,
      };

      setTextList(prev => [...prev, newText]);
      setActiveTextId(newId);
      setActiveTool("select");
    } else {
      setActiveTextId(null);
      setActiveImageId(null);
      setActiveEmbeddedImgId(null);
      setActiveShapeId(null);
      setActiveWhiteoutId(null);
    }
  };

  // Global Drag & Resize Listener for Objects
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggingItemId) {
        const targetPage = (
          draggingItemId.type === "image" ? images.find(i => i.id === draggingItemId.id)?.page :
          draggingItemId.type === "text" ? textList.find(t => t.id === draggingItemId.id)?.page :
          draggingItemId.type === "shape" ? shapes.find(s => s.id === draggingItemId.id)?.page :
          draggingItemId.type === "whiteout" ? whiteouts.find(w => w.id === draggingItemId.id)?.page :
          draggingItemId.type === "embedded-image" ? embeddedImages.find(emb => emb.id === draggingItemId.id)?.page :
          currentPage
        ) || currentPage;

        const canvas = pageCanvasRefs.current[targetPage] || pdfCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / zoom;
        const mouseY = (e.clientY - rect.top) / zoom;
        const newX = Math.max(0, mouseX - dragOffset.x);
        const newY = Math.max(0, mouseY - dragOffset.y);

        if (draggingItemId.type === "image") {
          setImages(prev => prev.map(img => img.id === draggingItemId.id ? { ...img, x: newX, y: newY } : img));
        } else if (draggingItemId.type === "text") {
          setTextList(prev => prev.map(txt => txt.id === draggingItemId.id ? { ...txt, x: newX, y: newY, whiteoutOriginal: txt.isOriginal ? true : txt.whiteoutOriginal } : txt));
        } else if (draggingItemId.type === "shape") {
          setShapes(prev => prev.map(shp => shp.id === draggingItemId.id ? { ...shp, x: newX, y: newY } : shp));
        } else if (draggingItemId.type === "whiteout") {
          setWhiteouts(prev => prev.map(wo => wo.id === draggingItemId.id ? { ...wo, x: newX, y: newY } : wo));
        } else if (draggingItemId.type === "embedded-image") {
          setEmbeddedImages(prev => prev.map(emb => emb.id === draggingItemId.id ? { ...emb, x: newX, y: newY } : emb));
        }
      } else if (resizingItemId) {
        const deltaX = (e.clientX - resizeInitial.startX) / zoom;
        const deltaY = (e.clientY - resizeInitial.startY) / zoom;
        const newW = Math.max(24, resizeInitial.initialW + deltaX);
        const newH = Math.max(16, resizeInitial.initialH + deltaY);

        if (resizingItemId.type === "image") {
          setImages(prev => prev.map(img => img.id === resizingItemId.id ? { ...img, width: newW, height: newH } : img));
        } else if (resizingItemId.type === "shape") {
          setShapes(prev => prev.map(shp => shp.id === resizingItemId.id ? { ...shp, width: newW, height: newH } : shp));
        } else if (resizingItemId.type === "whiteout") {
          setWhiteouts(prev => prev.map(wo => wo.id === resizingItemId.id ? { ...wo, width: newW, height: newH } : wo));
        } else if (resizingItemId.type === "embedded-image") {
          setEmbeddedImages(prev => prev.map(emb => emb.id === resizingItemId.id ? { ...emb, width: newW, height: newH } : emb));
        } else if (resizingItemId.type === "text") {
          setTextList(prev => prev.map(t => {
            if (t.id !== resizingItemId.id) return t;
            return { ...t, width: newW, height: newH, whiteoutOriginal: true };
          }));
        }
      }
    };

    const handleGlobalMouseUp = () => {
      if (draggingItemId || resizingItemId) {
        takeSnapshot();
      }
      setDraggingItemId(null);
      setResizingItemId(null);
    };

    if (draggingItemId || resizingItemId) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [draggingItemId, resizingItemId, dragOffset, resizeInitial, takeSnapshot, currentPage, images, textList, shapes, whiteouts, embeddedImages, zoom]);

  // Native Pinch-To-Zoom (Punch In & Out), Trackpad Pinch & Ctrl/Cmd+Wheel Zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isGesturing = false;
    let gestureStartZoom = 0.75;
    let initialTouchDist = 0;
    let touchStartZoom = 0.75;

    const handleWheel = (e: WheelEvent) => {
      if (isGesturing) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        let delta = 0;
        if (Math.abs(e.deltaY) >= 50) {
          // Physical mouse wheel notch with Ctrl / Command key
          delta = -Math.sign(e.deltaY) * 0.1;
        } else {
          // Smooth trackpad pinch gesture (punch in / punch out)
          delta = -e.deltaY * 0.008;
        }
        setZoom(prev => {
          const next = Math.min(3.0, Math.max(0.25, Number((prev + delta).toFixed(2))));
          return next;
        });
      }
    };

    const handleGestureStart = (e: any) => {
      e.preventDefault();
      isGesturing = true;
      gestureStartZoom = zoomRef.current;
    };

    const handleGestureChange = (e: any) => {
      e.preventDefault();
      if (typeof e.scale === "number") {
        const next = Math.min(3.0, Math.max(0.25, Number((gestureStartZoom * e.scale).toFixed(2))));
        setZoom(next);
      }
    };

    const handleGestureEnd = (e: any) => {
      e.preventDefault();
      setTimeout(() => {
        isGesturing = false;
      }, 50);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartZoom = zoomRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialTouchDist > 0) {
        e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = currentDist / initialTouchDist;
        const next = Math.min(3.0, Math.max(0.25, Number((touchStartZoom * scale).toFixed(2))));
        setZoom(next);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialTouchDist = 0;
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("gesturestart", handleGestureStart as any, { passive: false });
    container.addEventListener("gesturechange", handleGestureChange as any, { passive: false });
    container.addEventListener("gestureend", handleGestureEnd as any, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("gesturestart", handleGestureStart as any);
      container.removeEventListener("gesturechange", handleGestureChange as any);
      container.removeEventListener("gestureend", handleGestureEnd as any);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // Drag & Drop external images directly onto canvas
  const handleImageDropOnCanvas = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverCanvas(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = Array.from(e.dataTransfer.files).find(f =>
        f.type.startsWith("image/") || /\.(png|jpe?g|webp|svg|gif)$/i.test(f.name)
      );
      if (!file) return;

      const canvas = pdfCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const maxW = parseFloat(canvas.style.width) || canvas.width;
      const maxH = parseFloat(canvas.style.height) || canvas.height;
      const dropX = Math.max(10, Math.min(maxW - 120, e.clientX - rect.left - 80));
      const dropY = Math.max(10, Math.min(maxH - 80, e.clientY - rect.top - 50));

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          takeSnapshot();
          const offCanvas = document.createElement("canvas");
          offCanvas.width = img.width || 200;
          offCanvas.height = img.height || 200;
          const offCtx = offCanvas.getContext("2d");
          if (offCtx) offCtx.drawImage(img, 0, 0);
          const normalizedPng = offCtx ? offCanvas.toDataURL("image/png") : dataUrl;

          const aspect = img.height / (img.width || 1);
          const w = Math.min(220, img.width || 180);
          const h = Math.round(w * aspect) || 100;

          const newImg: ImageAnnotation = {
            id: `img-${Date.now()}`,
            page: currentPage,
            x: dropX,
            y: dropY,
            width: w,
            height: h,
            dataUrl: normalizedPng,
            file,
          };
          setImages(prev => [...prev, newImg]);
          setActiveImageId(newImg.id);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  // Image Upload via button
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          takeSnapshot();
          const offCanvas = document.createElement("canvas");
          offCanvas.width = img.width || 200;
          offCanvas.height = img.height || 200;
          const offCtx = offCanvas.getContext("2d");
          if (offCtx) offCtx.drawImage(img, 0, 0);
          const normalizedPng = offCtx ? offCanvas.toDataURL("image/png") : dataUrl;

          const aspect = img.height / (img.width || 1);
          const w = Math.min(200, img.width || 160);
          const h = Math.round(w * aspect) || 90;

          const newImg: ImageAnnotation = {
            id: `img-${Date.now()}`,
            page: currentPage,
            x: 80,
            y: 80,
            width: w,
            height: h,
            dataUrl: normalizedPng,
            file,
          };
          setImages(prev => [...prev, newImg]);
          setActiveImageId(newImg.id);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    }
  };

  // Rotate Page 90° Clockwise
  const handleRotatePage = () => {
    takeSnapshot();
    setPageRotations(prev => ({
      ...prev,
      [currentPage]: ((prev[currentPage] || 0) + 90) % 360,
    }));
  };

  // Find & Replace
  const handleFindReplace = () => {
    if (!findQuery.trim()) return;
    takeSnapshot();
    let count = 0;
    setTextList(prev =>
      prev.map(item => {
        if (item.currentText.toLowerCase().includes(findQuery.toLowerCase())) {
          count++;
          const replaced = item.currentText.replace(new RegExp(findQuery, "gi"), replaceQuery);
          return {
            ...item,
            currentText: replaced,
            whiteoutOriginal: true,
            color: selectedColor,
          };
        }
        return item;
      })
    );
    setReplaceMessage(count > 0 ? `Replaced ${count} occurrence(s)!` : "No matches found.");
    setTimeout(() => setReplaceMessage(null), 3000);
  };

  // ==========================================
  // SAVE & EXPORT PDF WITH HIGH FIDELITY
  // ==========================================
  const handleSaveAndProcess = async () => {
    setIsSaving(true);
    try {
      const originalBytes = await files[0].arrayBuffer();
      const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });

      const helvetica = await doc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
      const helveticaOblique = await doc.embedFont(StandardFonts.HelveticaOblique);
      const helveticaBoldOblique = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

      const timesRoman = await doc.embedFont(StandardFonts.TimesRoman);
      const timesRomanBold = await doc.embedFont(StandardFonts.TimesRomanBold);
      const timesRomanItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
      const timesRomanBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);

      const courier = await doc.embedFont(StandardFonts.Courier);
      const courierBold = await doc.embedFont(StandardFonts.CourierBold);
      const courierOblique = await doc.embedFont(StandardFonts.CourierOblique);
      const courierBoldOblique = await doc.embedFont(StandardFonts.CourierBoldOblique);

      const getFont = (family: string, bold: boolean, italic: boolean) => {
        if (family === "TimesRoman") {
          if (bold && italic) return timesRomanBoldItalic;
          if (bold) return timesRomanBold;
          if (italic) return timesRomanItalic;
          return timesRoman;
        }
        if (family === "Courier") {
          if (bold && italic) return courierBoldOblique;
          if (bold) return courierBold;
          if (italic) return courierOblique;
          return courier;
        }
        if (bold && italic) return helveticaBoldOblique;
        if (bold) return helveticaBold;
        if (italic) return helveticaOblique;
        return helvetica;
      };

      const pages = doc.getPages();

      for (let pNum = 1; pNum <= pages.length; pNum++) {
        const page = pages[pNum - 1];
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const baseDim = pageDimensions[pNum];
        const scaleX = baseDim?.width ? pageWidth / baseDim.width : 1;
        const scaleY = baseDim?.height ? pageHeight / baseDim.height : 1;

        const extraRotation = pageRotations[pNum] || 0;
        if (extraRotation !== 0) {
          const currentAngle = page.getRotation().angle;
          page.setRotation(degrees((currentAngle + extraRotation) % 360));
        }

        // 1. Apply Whiteout Annotations
        const pageWhiteouts = whiteouts.filter(w => w.page === pNum);
        for (const wo of pageWhiteouts) {
          const pdfX = wo.x * scaleX;
          const pdfY = pageHeight - ((wo.y + wo.height) * scaleY);
          const woColor = wo.color === "#000000" ? rgb(0, 0, 0) : rgb(1, 1, 1);
          page.drawRectangle({
            x: Math.max(0, pdfX),
            y: Math.max(0, pdfY),
            width: wo.width * scaleX,
            height: wo.height * scaleY,
            color: woColor,
          });
        }

        // 2. Apply Shapes
        const pageShapes = shapes.filter(s => s.page === pNum);
        for (const shp of pageShapes) {
          const pdfX = shp.x * scaleX;
          const pdfY = pageHeight - ((shp.y + shp.height) * scaleY);
          const pdfW = shp.width * scaleX;
          const pdfH = shp.height * scaleY;

          const [sr, sg, sb] = parseColorToRgb(shp.strokeColor);
          const strokeRgb = rgb(sr, sg, sb);

          let fillRgb: any = undefined;
          if (shp.fillColor && shp.fillColor !== "transparent") {
            const [fr, fg, fb] = parseColorToRgb(shp.fillColor);
            fillRgb = rgb(fr, fg, fb);
          }

          if (shp.type === "rectangle") {
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: pdfW,
              height: pdfH,
              borderColor: strokeRgb,
              borderWidth: shp.strokeWidth * scaleX,
              color: fillRgb,
              opacity: shp.opacity,
            });
          } else if (shp.type === "circle") {
            page.drawEllipse({
              x: pdfX + pdfW / 2,
              y: pdfY + pdfH / 2,
              xScale: pdfW / 2,
              yScale: pdfH / 2,
              borderColor: strokeRgb,
              borderWidth: shp.strokeWidth * scaleX,
              color: fillRgb,
              opacity: shp.opacity,
            });
          } else if (shp.type === "line" || shp.type === "arrow") {
            page.drawLine({
              start: { x: pdfX, y: pdfY + pdfH },
              end: { x: pdfX + pdfW, y: pdfY },
              color: strokeRgb,
              thickness: shp.strokeWidth * scaleX,
              opacity: shp.opacity,
            });
          }
        }

        // 3. Apply Text Edits & Whiteouts with Multi-line Wrapping & Justification
        const pageTexts = textList.filter(t => t.page === pNum);
        const pageYShifts = calculatePageYShifts(pageTexts);

        for (const item of pageTexts) {
          const yShift = pageYShifts.get(item.id) || 0;
          const isTextChanged = item.isOriginal && item.currentText.trim() !== item.originalText.trim();
          const isDimensionChanged = item.isOriginal && (
            (item.origWidth !== undefined && Math.abs(item.width - item.origWidth) > 3) ||
            (item.origHeight !== undefined && Math.abs(item.height - item.origHeight) > 3) ||
            (item.origX !== undefined && Math.abs(item.x - item.origX) > 3) ||
            (item.origY !== undefined && Math.abs(item.y - item.origY) > 3)
          );
          const isModified = isTextChanged || isDimensionChanged;
          const isNew = !item.isOriginal;
          const isShiftedOriginal = item.isOriginal && !isModified && yShift > 0;

          if (isModified || isShiftedOriginal) {
            const isTransparent = item.bgColor === "transparent" || item.bgColor === "none";
            let bgR = 1, bgG = 1, bgB = 1;
            if (!isTransparent) {
              if (item.bgRgb && item.bgRgb.length === 3) {
                bgR = item.bgRgb[0] / 255;
                bgG = item.bgRgb[1] / 255;
                bgB = item.bgRgb[2] / 255;
              } else if (item.bgColor && item.bgColor.startsWith("#") && item.bgColor.length === 7) {
                bgR = parseInt(item.bgColor.slice(1, 3), 16) / 255;
                bgG = parseInt(item.bgColor.slice(3, 5), 16) / 255;
                bgB = parseInt(item.bgColor.slice(5, 7), 16) / 255;
              }

              // Cleanly erase original content with matching background color
              if (item.rawBoxes && item.rawBoxes.length > 0) {
                for (const box of item.rawBoxes) {
                  const bPdfX = box.origPdfX;
                  const bPdfY = box.origPdfY;
                  const bWidth = box.origWidth;
                  const bHeight = box.origHeight;
                  const desc = bHeight * 0.32;

                  page.drawRectangle({
                    x: Math.max(0, bPdfX - 2.5),
                    y: Math.max(0, bPdfY - desc),
                    width: bWidth + 5,
                    height: bHeight * 1.38,
                    color: rgb(bgR, bgG, bgB),
                  });
                }
              } else {
                const origX = item.origPdfX !== undefined ? item.origPdfX : item.x * scaleX;
                const origY = item.origPdfY !== undefined ? item.origPdfY : (pageHeight - (item.y + item.height) * scaleY);
                const origW = item.origWidth !== undefined ? item.origWidth : item.width * scaleX;
                const origH = item.origHeight !== undefined ? item.origHeight : item.fontSize;

                page.drawRectangle({
                  x: Math.max(0, origX - 2.5),
                  y: Math.max(0, origY - (origH * 0.32)),
                  width: origW + 5,
                  height: origH * 1.38,
                  color: rgb(bgR, bgG, bgB),
                });
              }
            }

            const sanitizedText = cleanTextForPdf(item.currentText);
            if (sanitizedText.trim() !== "") {
              const chosenFont = getFont(item.fontFamily, item.isBold, item.isItalic);
              const [r, g, b] = parseColorToRgb(item.color);

              const startPdfX = item.origPdfX !== undefined ? item.origPdfX : item.x * scaleX;
              const startPdfBaselineY = (item.lines && item.lines[0]?.origPdfY !== undefined)
                ? (item.lines[0].origPdfY - (yShift * scaleY))
                : (pageHeight - ((item.y + yShift + (item.fontSize * 0.82)) * scaleY));

              const targetWidthPt = item.width * scaleX;
              const lineHeightPt = (item.lines && item.lines.length >= 2 && item.lines[0].origPdfY !== undefined && item.lines[1].origPdfY !== undefined)
                ? Math.abs(item.lines[0].origPdfY - item.lines[1].origPdfY)
                : ((item.lineHeight || (item.fontSize * 1.25)) * scaleY);

              // Wrap text cleanly into lines respecting targetWidthPt without shrinking font
              const wrappedLines = wrapTextIntoLines(sanitizedText, chosenFont, item.fontSize, targetWidthPt);

              for (let li = 0; li < wrappedLines.length; li++) {
                const lineStr = wrappedLines[li];
                if (!lineStr || lineStr.trim() === "") continue;

                let lineBaselineY = startPdfBaselineY - (li * lineHeightPt);
                const isUnchanged = item.currentText === item.originalText && Math.abs(item.width - (item.origWidth || item.width)) < 4;
                if (isUnchanged && item.lines && item.lines[li]?.origPdfY !== undefined) {
                  lineBaselineY = (item.lines[li]?.origPdfY ?? startPdfBaselineY) - (yShift * scaleY);
                }

                let lineWidth = 0;
                try {
                  lineWidth = chosenFont.widthOfTextAtSize(lineStr, item.fontSize);
                } catch {
                  lineWidth = lineStr.length * item.fontSize * 0.52;
                }

                const isLastLine = li === wrappedLines.length - 1;
                const shouldJustify = item.align === "justify" && !isLastLine;

                if (shouldJustify) {
                  const words = lineStr.split(/\s+/).filter(Boolean);
                  if (words.length > 1) {
                    let totalWordWidth = 0;
                    const wordWidths = words.map(w => {
                      try {
                        const ww = chosenFont.widthOfTextAtSize(w, item.fontSize);
                        totalWordWidth += ww;
                        return ww;
                      } catch {
                        const ww = w.length * item.fontSize * 0.52;
                        totalWordWidth += ww;
                        return ww;
                      }
                    });

                    const availableSpace = targetWidthPt - totalWordWidth;
                    const gapCount = words.length - 1;
                    const spacePerGap = gapCount > 0 ? (availableSpace / gapCount) : 0;
                    let normalSpaceW = 0;
                    try {
                      normalSpaceW = chosenFont.widthOfTextAtSize(" ", item.fontSize);
                    } catch {
                      normalSpaceW = item.fontSize * 0.25;
                    }

                    if (spacePerGap >= normalSpaceW * 0.5 && spacePerGap <= normalSpaceW * 4.0) {
                      let curWordX = startPdfX;
                      for (let wi = 0; wi < words.length; wi++) {
                        page.drawText(words[wi], {
                          x: Math.max(0, curWordX),
                          y: Math.max(0, lineBaselineY),
                          size: item.fontSize,
                          font: chosenFont,
                          color: rgb(r, g, b),
                        });
                        curWordX += wordWidths[wi] + spacePerGap;
                      }
                      continue;
                    }
                  }
                }

                // Left, Center, Right, or Justify fallback alignment
                let lineX = startPdfX;
                if (item.align === "center") {
                  lineX = startPdfX + Math.max(0, (targetWidthPt - lineWidth) / 2);
                } else if (item.align === "right") {
                  lineX = startPdfX + Math.max(0, targetWidthPt - lineWidth);
                }

                page.drawText(lineStr, {
                  x: Math.max(0, lineX),
                  y: Math.max(0, lineBaselineY),
                  size: item.fontSize,
                  font: chosenFont,
                  color: rgb(r, g, b),
                });
              }
            }
          } else if (isNew) {
            const sanitizedText = cleanTextForPdf(item.currentText);
            if (sanitizedText.trim() !== "") {
              const chosenFont = getFont(item.fontFamily, item.isBold, item.isItalic);
              const [r, g, b] = parseColorToRgb(item.color);

              const pdfX = item.x * scaleX;
              const pdfBaselineY = pageHeight - ((item.y + (item.fontSize * 0.82)) * scaleY);
              const targetWidthPt = (item.width || 200) * scaleX;
              const lineHeightPt = (item.lineHeight || (item.fontSize * 1.25)) * scaleY;

              const wrappedLines = wrapTextIntoLines(sanitizedText, chosenFont, item.fontSize, targetWidthPt);

              for (let li = 0; li < wrappedLines.length; li++) {
                const lineStr = wrappedLines[li];
                if (!lineStr || lineStr.trim() === "") continue;

                const lineBaselineY = pdfBaselineY - (li * lineHeightPt);
                let lineWidth = 0;
                try {
                  lineWidth = chosenFont.widthOfTextAtSize(lineStr, item.fontSize);
                } catch {
                  lineWidth = lineStr.length * item.fontSize * 0.52;
                }

                let lineX = pdfX;
                if (item.align === "center") {
                  lineX = pdfX + Math.max(0, (targetWidthPt - lineWidth) / 2);
                } else if (item.align === "right") {
                  lineX = pdfX + Math.max(0, targetWidthPt - lineWidth);
                }

                page.drawText(lineStr, {
                  x: Math.max(0, lineX),
                  y: Math.max(0, lineBaselineY),
                  size: item.fontSize,
                  font: chosenFont,
                  color: rgb(r, g, b),
                });
              }
            }
          }
        }

        // 4. Apply Images & Signatures
        const pageImages = images.filter(img => img.page === pNum);
        for (const imgItem of pageImages) {
          try {
            let embedded: any;
            if (imgItem.dataUrl && imgItem.dataUrl.includes(";base64,")) {
              const base64Data = imgItem.dataUrl.split(",")[1];
              const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              try {
                embedded = await doc.embedPng(imgBytes);
              } catch {
                try {
                  embedded = await doc.embedJpg(imgBytes);
                } catch (err) {
                  console.warn("Could not embed base64 image:", err);
                }
              }
            } else if (imgItem.file) {
              const imgBuffer = await imgItem.file.arrayBuffer();
              try {
                embedded = imgItem.file.type.includes("png")
                  ? await doc.embedPng(imgBuffer)
                  : await doc.embedJpg(imgBuffer);
              } catch {
                try {
                  embedded = await doc.embedPng(imgBuffer);
                } catch {
                  embedded = await doc.embedJpg(imgBuffer);
                }
              }
            }

            if (embedded) {
              const pdfX = imgItem.x * scaleX;
              const pdfY = pageHeight - ((imgItem.y + imgItem.height) * scaleY);
              page.drawImage(embedded, {
                x: Math.max(0, pdfX),
                y: Math.max(0, pdfY),
                width: imgItem.width * scaleX,
                height: imgItem.height * scaleY,
              });
            }
          } catch (imgErr) {
            console.warn("Could not embed image:", imgErr);
          }
        }

        // 4b. Apply Embedded PDF Image Modifications (Replace or Delete)
        const pageEmbedded = embeddedImages.filter(img => img.page === pNum);
        for (const emb of pageEmbedded) {
          if (emb.isDeleted || emb.replacementDataUrl) {
            const origX = emb.origPdfX !== undefined ? emb.origPdfX : emb.x * scaleX;
            const origY = emb.origPdfY !== undefined ? emb.origPdfY : (pageHeight - (emb.y + emb.height) * scaleY);
            const origW = emb.origWidth !== undefined ? emb.origWidth : emb.width * scaleX;
            const origH = emb.origHeight !== undefined ? emb.origHeight : emb.height * scaleY;

            // Whiteout original image on PDF
            page.drawRectangle({
              x: Math.max(0, origX),
              y: Math.max(0, origY),
              width: origW,
              height: origH,
              color: rgb(1, 1, 1),
            });

            // If replacement image provided, draw it
            if (emb.replacementDataUrl && emb.replacementDataUrl.includes(";base64,")) {
              try {
                const base64Data = emb.replacementDataUrl.split(",")[1];
                const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                let embeddedReplacement: any;
                try {
                  embeddedReplacement = await doc.embedPng(imgBytes);
                } catch {
                  embeddedReplacement = await doc.embedJpg(imgBytes);
                }

                if (embeddedReplacement) {
                  page.drawImage(embeddedReplacement, {
                    x: Math.max(0, emb.x * scaleX),
                    y: Math.max(0, pageHeight - ((emb.y + emb.height) * scaleY)),
                    width: emb.width * scaleX,
                    height: emb.height * scaleY,
                  });
                }
              } catch (repErr) {
                console.warn("Could not embed replacement image:", repErr);
              }
            }
          }
        }

        // 5. Apply Freehand Drawing Layer
        if (pNum === currentPage && drawCanvasRef.current) {
          const drawCanvas = drawCanvasRef.current;
          const ctx = drawCanvas.getContext("2d");
          if (ctx) {
            const imgData = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height);
            const hasDrawing = imgData.data.some((ch, idx) => idx % 4 === 3 && ch > 0);
            if (hasDrawing) {
              const dataUrl = drawCanvas.toDataURL("image/png");
              const base64Data = dataUrl.split(",")[1];
              const drawBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const embeddedDraw = await doc.embedPng(drawBytes);
              page.drawImage(embeddedDraw, {
                x: 0,
                y: 0,
                width: pageWidth,
                height: pageHeight,
              });
            }
          }
        }
      }

      const modifiedPdfBytes = await doc.save();
      const prefix = isSignTool ? "signed" : "edited";
      const editedFile = new File([modifiedPdfBytes.buffer as ArrayBuffer], `${prefix}-${files[0].name}`, {
        type: "application/pdf"
      });
      onProcess({ action: slug || "edit-pdf" }, editedFile);
    } catch (err) {
      console.error("Save edited PDF error:", err);
      alert("Failed to compile edited PDF. Please check your changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReplaceEmbeddedImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingImgId) return;

    const targetId = replacingImgId;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        takeSnapshot();
        const offCanvas = document.createElement("canvas");
        offCanvas.width = img.width || 200;
        offCanvas.height = img.height || 200;
        const offCtx = offCanvas.getContext("2d");
        if (offCtx) offCtx.drawImage(img, 0, 0);
        const normalizedPng = offCtx ? offCanvas.toDataURL("image/png") : dataUrl;

        setEmbeddedImages(prev => prev.map(item => {
          if (item.id === targetId) {
            return {
              ...item,
              replacementDataUrl: normalizedPng,
              replacementFile: file,
              isDeleted: false,
            };
          }
          return item;
        }));
        setReplacingImgId(null);
        if (replaceImgInputRef.current) replaceImgInputRef.current.value = "";
      };
      img.onerror = () => {
        takeSnapshot();
        setEmbeddedImages(prev => prev.map(item => {
          if (item.id === targetId) {
            return {
              ...item,
              replacementDataUrl: dataUrl,
              replacementFile: file,
              isDeleted: false,
            };
          }
          return item;
        }));
        setReplacingImgId(null);
        if (replaceImgInputRef.current) replaceImgInputRef.current.value = "";
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full h-full flex-1 flex flex-col min-h-0 mx-auto">
      {/* Hidden File Input for Adding Images */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Hidden File Input for Replacing Embedded Images */}
      <input
        ref={replaceImgInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleReplaceEmbeddedImage}
      />

      {/* Modern Scan Progress Notification */}
      {scanProgress && (
        <div className="w-full max-w-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl px-5 py-2.5 mb-2 shadow-lg flex items-center justify-between text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-300 shrink-0">
          <div className="flex items-center gap-2.5">
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
            ) : (
              <Check className="w-4 h-4 text-emerald-300" />
            )}
            <span>
              {isScanning
                ? `Scanning PDF: Page ${scanProgress.current} of ${scanProgress.total} (${scanProgress.texts} texts, ${scanProgress.images} images detected)...`
                : `Scan complete: ${scanProgress.total} Pages, ${scanProgress.texts} Text blocks, ${scanProgress.images} Images detected!`}
            </span>
          </div>
          <span className="text-[11px] text-blue-100 bg-black/20 px-2.5 py-0.5 rounded-full font-bold">
            {Math.round((scanProgress.current / scanProgress.total) * 100)}%
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN TOP TOOLBAR                                                          */}
      {/* ========================================================================= */}
      <div className="w-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] rounded-2xl p-2 mb-2 flex items-center justify-between gap-3 shrink-0 z-40 overflow-hidden">
        
        {/* Left: Tools Group */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-0.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTool("select");
                setActiveTextId(null);
              }}
              className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "select" ? "bg-[#E5322D] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
              }`}
              title="Select tool"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Select</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool("edit-text");
                setActiveEmbeddedImgId(null);
                setActiveImageId(null);
              }}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "edit-text" ? "bg-[#E5322D] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
              }`}
              title="Click any text on the page to edit in place"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Edit Text</span>
              {textList.filter(t => t.page === currentPage).length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  activeTool === "edit-text" ? "bg-white/30 text-white" : "bg-blue-100 text-blue-700"
                }`}>
                  {textList.filter(t => t.page === currentPage).length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("add-text")}
              className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "add-text" ? "bg-[#E5322D] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
              }`}
              title="Click anywhere to add a new text box"
            >
              <Type className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Text</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSignatureModal(true)}
              className="px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 text-blue-600 hover:bg-blue-50/80 transition-all cursor-pointer"
              title="Draw or type signature"
            >
              <FileSignature className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Sign</span>
            </button>

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 text-slate-700 hover:bg-white/80 transition-all cursor-pointer"
              title="Add image"
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden lg:inline">Image</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("whiteout")}
              className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "whiteout" ? "bg-[#E5322D] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
              }`}
              title="Drag to erase/whiteout content"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Whiteout</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("shape")}
              className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "shape" ? "bg-[#E5322D] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
              }`}
              title="Draw shapes"
            >
              <Square className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Shapes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("draw")}
              className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "draw" ? "bg-[#E5322D] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
              }`}
              title="Pen"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Pen</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool("highlight")}
              className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === "highlight" ? "bg-[#E5322D] text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
              }`}
              title="Highlighter"
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden 2xl:inline">Highlight</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFindReplace(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                showFindReplace ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
              }`}
              title="Find & Replace text"
            >
              <Search className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden 2xl:inline">Find</span>
            </button>
          </div>

          {/* Shape Sub-selector */}
          {activeTool === "shape" && (
            <div className="flex items-center gap-1 bg-amber-50/90 px-2 py-1 rounded-xl border border-amber-200 text-xs shrink-0">
              <span className="text-amber-800 font-bold text-[11px]">Shape:</span>
              <button
                type="button"
                onClick={() => setSelectedShapeType("rectangle")}
                className={`p-1 rounded-lg cursor-pointer transition-colors ${selectedShapeType === "rectangle" ? "bg-amber-600 text-white shadow-xs" : "text-slate-700 hover:bg-amber-100"}`}
                title="Rectangle"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedShapeType("circle")}
                className={`p-1 rounded-lg cursor-pointer transition-colors ${selectedShapeType === "circle" ? "bg-amber-600 text-white shadow-xs" : "text-slate-700 hover:bg-amber-100"}`}
                title="Circle"
              >
                <Circle className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedShapeType("line")}
                className={`p-1 rounded-lg cursor-pointer transition-colors ${selectedShapeType === "line" ? "bg-amber-600 text-white shadow-xs" : "text-slate-700 hover:bg-amber-100"}`}
                title="Line"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedShapeType("arrow")}
                className={`p-1 rounded-lg cursor-pointer transition-colors ${selectedShapeType === "arrow" ? "bg-amber-600 text-white shadow-xs" : "text-slate-700 hover:bg-amber-100"}`}
                title="Arrow"
              >
                <MoveUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Navigation, Styles & Save */}
        <div className="flex items-center gap-2 shrink-0 ml-auto pl-2">
          {/* Toggle Sidebar Buttons */}
          <button
            type="button"
            onClick={() => setShowThumbnailsSidebar(s => !s)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              showThumbnailsSidebar ? "bg-blue-50 border-blue-200 text-blue-700 shadow-2xs" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            title="Toggle Pages Sidebar"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Pages ({totalPages})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowInspectorSidebar(s => !s)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              showInspectorSidebar ? "bg-blue-50 border-blue-200 text-blue-700 shadow-2xs" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            title="Toggle Styles Inspector"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span>Styles</span>
          </button>

          {/* Primary Save Action */}
          <button
            type="button"
            onClick={handleSaveAndProcess}
            disabled={isSaving}
            className="cursor-pointer bg-[#E5322D] hover:bg-[#CC2A26] text-white px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:shadow-md flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-75 shrink-0 whitespace-nowrap"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{isSignTool ? "Sign & Download" : "Save & Download"}</span>
              </>
            )}
          </button>
        </div>
      </div>



      {/* ========================================================================= */}
      {/* FIND & REPLACE FLOATING MODAL                                             */}
      {/* ========================================================================= */}
      {showFindReplace && (
        <div className="w-full max-w-xl bg-white border border-purple-200 rounded-2xl p-4 shadow-xl mb-4 flex flex-col gap-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-purple-600" /> Find & Replace Text in Document
            </span>
            <button
              type="button"
              onClick={() => setShowFindReplace(false)}
              className="p-1 text-gray-400 hover:text-black cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Find Text:</label>
              <input
                type="text"
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Replace With:</label>
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="e.g. Samir Ansari"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:border-purple-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-green-600">{replaceMessage}</span>
            <button
              type="button"
              onClick={handleFindReplace}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-sm cursor-pointer"
            >
              Replace All Matches
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ELECTRONIC SIGNATURE MODAL                                               */}
      {/* ========================================================================= */}
      {showSignatureModal && (
        <SignatureModal
          onClose={() => setShowSignatureModal(false)}
          onAddSignature={(dataUrl) => {
            takeSnapshot();
            const newImg: ImageAnnotation = {
              id: `sig-${Date.now()}`,
              page: currentPage,
              x: 120,
              y: 150,
              width: 180,
              height: 70,
              dataUrl,
              isSignature: true,
            };
            setImages(prev => [...prev, newImg]);
            setActiveImageId(newImg.id);
            setShowSignatureModal(false);
          }}
        />
      )}
      {/* UNIFIED 3-COLUMN STUDIO WORKSPACE (Modern Professional PDF Editor Layout) */}
      {/* ========================================================================= */}
      <div className="w-full flex-1 min-h-0 bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* 3-COLUMN WORKSPACE BODY */}
        <div className="w-full flex-1 min-h-0 flex items-stretch overflow-hidden">
          {/* COLUMN 1: LEFT THUMBNAILS PANEL */}
          {showThumbnailsSidebar && totalPages > 0 && (
            <div className="w-48 sm:w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden select-none">
              {/* Top 4 Navigation Tabs (Reference style) */}
              <div className="p-2 border-b border-slate-200 flex items-center justify-between gap-1 bg-white">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSidebarTab("thumbnails")}
                    className={`p-1.5 rounded transition-colors ${
                      sidebarTab === "thumbnails"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    title="Pages"
                  >
                    <Layers className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab("outline")}
                    className={`p-1.5 rounded transition-colors ${
                      sidebarTab === "outline"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    title="Outline"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab("bookmarks")}
                    className={`p-1.5 rounded transition-colors ${
                      sidebarTab === "bookmarks"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    title="Bookmarks"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab("more")}
                    className={`p-1.5 rounded transition-colors ${
                      sidebarTab === "more"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    title="More Options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowThumbnailsSidebar(false)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Close sidebar"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Zoom Slider Bar below tabs */}
              <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.3, Number((prev - 0.05).toFixed(2))))}
                  className="text-slate-500 hover:text-slate-800 text-xs font-bold px-1"
                  title="Zoom Out"
                >
                  —
                </button>
                <input
                  type="range"
                  min="0.35"
                  max="1.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-slate-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(2.0, Number((prev + 0.05).toFixed(2))))}
                  className="text-slate-500 hover:text-slate-800 text-xs font-bold px-1"
                  title="Zoom In"
                >
                  +
                </button>
              </div>

              {/* Thumbnails list with smooth scrollToPage */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pNum => {
                  const isActive = currentPage === pNum;
                  const thumbUrl = pageThumbnails[pNum];

                  return (
                    <div
                      key={pNum}
                      onClick={() => scrollToPage(pNum)}
                      className="group flex flex-col items-center cursor-pointer gap-1.5"
                    >
                      <div
                        className={`w-full aspect-[1/1.3] bg-white rounded-md overflow-hidden flex items-center justify-center transition-all ${
                          isActive
                            ? "border-2 border-blue-600 ring-2 ring-blue-500/20 shadow-md"
                            : "border border-slate-200 hover:border-slate-300 hover:shadow-xs"
                        }`}
                      >
                        {thumbUrl ? (
                          <img src={thumbUrl} alt={`Page ${pNum}`} className="w-full h-full object-contain pointer-events-none" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 gap-1 text-[10px]">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-semibold ${isActive ? "text-blue-600 font-bold" : "text-slate-500"}`}>
                        {pNum}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* COLUMN 2: CENTER DOCUMENT CANVAS DESK (Continuous Multi-Page Flow) */}
          <div
            ref={containerRef}
            onScroll={handleDeskScroll}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "copy";
              setIsDragOverCanvas(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOverCanvas(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = containerRef.current?.getBoundingClientRect();
              if (rect) {
                if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
                  setIsDragOverCanvas(false);
                }
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOverCanvas(false);
              handleImageDropOnCanvas(e);
            }}
            className={`flex-1 min-w-0 w-full h-full overflow-y-auto overflow-x-auto flex flex-col items-center justify-start py-8 px-4 sm:px-8 relative bg-slate-100/70 transition-colors ${
              isDragOverCanvas ? "bg-blue-50/50" : ""
            }`}
          >
            {!isPdfJsLoaded || !pdfDoc ? (
              <div className="flex flex-col items-center justify-center p-20 text-gray-500 gap-3 my-auto">
                <Loader2 className="w-8 h-8 text-[#E5322D] animate-spin" />
                <p className="font-semibold text-sm">Loading PDF into editor...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center w-full">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pNum => {
                  const baseDim = pageDimensions[pNum] || { width: 595, height: 842 };
                  const pWidth = Math.round(baseDim.width * zoom);
                  const pHeight = Math.round(baseDim.height * zoom);
                  const isPageActive = currentPage === pNum;

                  return (
                    <div
                      key={pNum}
                      id={`pdf-page-${pNum}`}
                      data-page={pNum}
                      onClick={(e) => {
                        if (currentPage !== pNum) setCurrentPage(pNum);
                        handleCanvasClick(e, pNum);
                      }}
                      style={{
                        width: `${pWidth}px`,
                        height: `${pHeight}px`,
                      }}
                      className={`relative bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] border rounded-[2px] overflow-hidden select-none mb-8 shrink-0 transition-shadow ${
                        isPageActive ? "border-slate-300 ring-1 ring-blue-500/20" : "border-slate-200/80"
                      }`}
                    >
                      {/* 1. Base PDF Rendered Canvas */}
                      <canvas
                        ref={el => {
                          pageCanvasRefs.current[pNum] = el;
                          if (pNum === 1) (pdfCanvasRef as any).current = el;
                        }}
                        style={{
                          width: `${pWidth}px`,
                          height: `${pHeight}px`,
                          imageRendering: "-webkit-optimize-contrast",
                        }}
                        className="block shrink-0 pointer-events-none"
                      />

                      {/* 2. Whiteout Overlays */}
                      {whiteouts
                        .filter(wo => wo.page === pNum)
                        .map(wo => {
                          const isActive = activeWhiteoutId === wo.id;
                          return (
                            <div
                              key={wo.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveWhiteoutId(wo.id);
                              }}
                              onMouseDown={(e) => {
                                if (activeTool === "select") {
                                  e.stopPropagation();
                                  setDraggingItemId({ type: "whiteout", id: wo.id });
                                  const canvas = pageCanvasRefs.current[pNum];
                                  if (canvas) {
                                    const rect = canvas.getBoundingClientRect();
                                    setDragOffset({
                                      x: ((e.clientX - rect.left) / zoom) - wo.x,
                                      y: ((e.clientY - rect.top) / zoom) - wo.y,
                                    });
                                  }
                                }
                              }}
                              style={{
                                left: `${wo.x * zoom}px`,
                                top: `${wo.y * zoom}px`,
                                width: `${wo.width * zoom}px`,
                                height: `${wo.height * zoom}px`,
                                backgroundColor: wo.color || "#ffffff",
                              }}
                              className={`absolute z-15 group transition-shadow ${
                                isActive ? "ring-2 ring-blue-500 shadow-md cursor-move" : "cursor-pointer"
                              }`}
                            >
                              {isActive && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      takeSnapshot();
                                      setWhiteouts(prev => prev.filter(w => w.id !== wo.id));
                                      setActiveWhiteoutId(null);
                                    }}
                                    className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 text-white rounded-full text-xs flex items-center justify-center cursor-pointer shadow z-20"
                                  >
                                    ×
                                  </button>
                                  <div
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setResizingItemId({ type: "whiteout", id: wo.id });
                                      setResizeInitial({ startX: e.clientX, startY: e.clientY, initialW: wo.width, initialH: wo.height });
                                    }}
                                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white cursor-nwse-resize z-20 shadow"
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}

                      {/* Current Dragging Box (Shape or Whiteout in progress) */}
                      {currentPage === pNum && currentDragRect && (
                        <div
                          style={{
                            left: `${currentDragRect.x * zoom}px`,
                            top: `${currentDragRect.y * zoom}px`,
                            width: `${currentDragRect.width * zoom}px`,
                            height: `${currentDragRect.height * zoom}px`,
                          }}
                          className={`absolute pointer-events-none z-30 ${
                            activeTool === "whiteout"
                              ? "bg-white/90 border-2 border-dashed border-red-500"
                              : "border-2 border-dashed border-blue-500 bg-blue-500/20"
                          }`}
                        />
                      )}

                      {/* 3. Shape Annotations */}
                      {shapes
                        .filter(s => s.page === pNum)
                        .map(shp => {
                          const isActive = activeShapeId === shp.id;
                          return (
                            <div
                              key={shp.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveShapeId(shp.id);
                              }}
                              onMouseDown={(e) => {
                                if (activeTool === "select") {
                                  e.stopPropagation();
                                  setDraggingItemId({ type: "shape", id: shp.id });
                                  const canvas = pageCanvasRefs.current[pNum];
                                  if (canvas) {
                                    const rect = canvas.getBoundingClientRect();
                                    setDragOffset({
                                      x: ((e.clientX - rect.left) / zoom) - shp.x,
                                      y: ((e.clientY - rect.top) / zoom) - shp.y,
                                    });
                                  }
                                }
                              }}
                              style={{
                                left: `${shp.x * zoom}px`,
                                top: `${shp.y * zoom}px`,
                                width: `${shp.width * zoom}px`,
                                height: `${shp.height * zoom}px`,
                              }}
                              className={`absolute z-20 group transition-shadow ${
                                isActive ? "ring-2 ring-blue-500 shadow-md cursor-move" : "cursor-pointer"
                              }`}
                            >
                              {shp.type === "rectangle" && (
                                <div
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    borderColor: shp.strokeColor,
                                    borderWidth: `${Math.max(1, shp.strokeWidth * zoom)}px`,
                                    backgroundColor: shp.fillColor === "transparent" ? "transparent" : shp.fillColor,
                                    opacity: shp.opacity,
                                  }}
                                  className="border rounded-sm"
                                />
                              )}
                              {shp.type === "circle" && (
                                <div
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    borderColor: shp.strokeColor,
                                    borderWidth: `${Math.max(1, shp.strokeWidth * zoom)}px`,
                                    backgroundColor: shp.fillColor === "transparent" ? "transparent" : shp.fillColor,
                                    opacity: shp.opacity,
                                  }}
                                  className="border rounded-full"
                                />
                              )}
                              {(shp.type === "line" || shp.type === "arrow") && (
                                <svg className="w-full h-full overflow-visible">
                                  <line
                                    x1="0"
                                    y1={shp.height * zoom}
                                    x2={shp.width * zoom}
                                    y2="0"
                                    stroke={shp.strokeColor}
                                    strokeWidth={Math.max(1, shp.strokeWidth * zoom)}
                                  />
                                </svg>
                              )}

                              {isActive && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      takeSnapshot();
                                      setShapes(prev => prev.filter(s => s.id !== shp.id));
                                      setActiveShapeId(null);
                                    }}
                                    className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 text-white rounded-full text-xs flex items-center justify-center cursor-pointer shadow z-30"
                                  >
                                    ×
                                  </button>
                                  <div
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setResizingItemId({ type: "shape", id: shp.id });
                                      setResizeInitial({ startX: e.clientX, startY: e.clientY, initialW: shp.width, initialH: shp.height });
                                    }}
                                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white cursor-nwse-resize z-30 shadow"
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}

                      {/* 4. Freehand Drawing Canvas Overlay */}
                      <canvas
                        ref={el => {
                          drawCanvasRefs.current[pNum] = el;
                          if (pNum === 1) (drawCanvasRef as any).current = el;
                        }}
                        style={{
                          width: `${pWidth}px`,
                          height: `${pHeight}px`,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, pNum)}
                        onMouseMove={(e) => handleMouseMove(e, pNum)}
                        onMouseUp={() => handleMouseUp(pNum)}
                        onMouseLeave={() => handleMouseUp(pNum)}
                        className={`absolute inset-0 ${
                          activeTool === "draw" || activeTool === "highlight" || activeTool === "whiteout" || activeTool === "shape"
                            ? "cursor-crosshair z-25 pointer-events-auto"
                            : "pointer-events-none z-10"
                        }`}
                      />

                      {/* 5. Image & Signature Annotations */}
                      {images
                        .filter(img => img.page === pNum)
                        .map(img => {
                          const isActive = activeImageId === img.id;
                          return (
                            <div
                              key={img.id}
                              style={{
                                left: `${img.x * zoom}px`,
                                top: `${img.y * zoom}px`,
                                width: `${img.width * zoom}px`,
                                height: `${img.height * zoom}px`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveImageId(img.id);
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActiveImageId(img.id);
                                setDraggingItemId({ type: "image", id: img.id });
                                const canvas = pageCanvasRefs.current[pNum];
                                if (canvas) {
                                  const rect = canvas.getBoundingClientRect();
                                  setDragOffset({
                                    x: ((e.clientX - rect.left) / zoom) - img.x,
                                    y: ((e.clientY - rect.top) / zoom) - img.y,
                                  });
                                }
                              }}
                              className={`absolute z-30 select-none group transition-shadow ${
                                isActive ? "ring-2 ring-blue-500 shadow-xl cursor-grab" : "hover:ring-2 hover:ring-blue-300 cursor-pointer"
                              }`}
                            >
                              <img
                                src={img.dataUrl}
                                alt="Annotation"
                                draggable={false}
                                className="w-full h-full object-contain pointer-events-none"
                              />

                              {isActive && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      takeSnapshot();
                                      setImages(prev => prev.filter(i => i.id !== img.id));
                                      setActiveImageId(null);
                                    }}
                                    className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs flex items-center justify-center cursor-pointer shadow z-40"
                                    title="Delete"
                                  >
                                    ×
                                  </button>
                                  <div
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setResizingItemId({ type: "image", id: img.id });
                                      setResizeInitial({ startX: e.clientX, startY: e.clientY, initialW: img.width, initialH: img.height });
                                    }}
                                    className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-blue-600 rounded-full border-2 border-white cursor-nwse-resize shadow z-40"
                                    title="Drag to resize"
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}

                      {/* 5b. PDF Embedded Images */}
                      {embeddedImages
                        .filter(emb => emb.page === pNum)
                        .map(emb => {
                          const isActive = activeEmbeddedImgId === emb.id;

                          if (emb.isDeleted) {
                            return (
                              <div
                                key={emb.id}
                                style={{
                                  left: `${emb.x * zoom}px`,
                                  top: `${emb.y * zoom}px`,
                                  width: `${emb.width * zoom}px`,
                                  height: `${emb.height * zoom}px`,
                                  backgroundColor: "#ffffff",
                                }}
                                className="absolute z-22 border border-dashed border-gray-300 pointer-events-none"
                              />
                            );
                          }

                          return (
                            <div
                              key={emb.id}
                              style={{
                                left: `${emb.x * zoom}px`,
                                top: `${emb.y * zoom}px`,
                                width: `${emb.width * zoom}px`,
                                height: `${emb.height * zoom}px`,
                                zIndex: isActive ? 40 : 12,
                              }}
                              onClick={(e) => {
                                if (activeTool !== "select") return;
                                e.stopPropagation();
                                setActiveEmbeddedImgId(emb.id);
                                setActiveTextId(null);
                                setActiveImageId(null);
                              }}
                              onMouseDown={(e) => {
                                if (activeTool === "select") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setActiveEmbeddedImgId(emb.id);
                                  setDraggingItemId({ type: "embedded-image", id: emb.id });
                                  const canvas = pageCanvasRefs.current[pNum];
                                  if (canvas) {
                                    const rect = canvas.getBoundingClientRect();
                                    setDragOffset({
                                      x: ((e.clientX - rect.left) / zoom) - emb.x,
                                      y: ((e.clientY - rect.top) / zoom) - emb.y,
                                    });
                                  }
                                }
                              }}
                              className={`absolute select-none group transition-all ${
                                isActive
                                  ? "ring-2 ring-blue-600 shadow-xl cursor-grab bg-white/10"
                                  : activeTool === "select"
                                  ? "hover:ring-2 hover:ring-blue-400 hover:bg-blue-400/15 cursor-pointer rounded-sm"
                                  : "pointer-events-none"
                              }`}
                            >
                              {emb.replacementDataUrl && (
                                <img
                                  src={emb.replacementDataUrl}
                                  alt="Replaced PDF Image"
                                  draggable={false}
                                  className="w-full h-full object-contain pointer-events-none bg-white"
                                />
                              )}

                              {activeTool === "select" && (
                                <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  {emb.replacementDataUrl ? "Replaced Image" : "PDF Image"}
                                </span>
                              )}

                              {isActive && (
                                <div
                                  style={{
                                    position: "absolute",
                                    bottom: "calc(100% + 6px)",
                                    left: 0,
                                    zIndex: 100,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-white border border-gray-300 shadow-xl rounded-xl px-2 py-1 flex items-center gap-1.5 text-xs text-gray-800 whitespace-nowrap animate-in fade-in duration-100"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplacingImgId(emb.id);
                                      replaceImgInputRef.current?.click();
                                    }}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Replace this image with a new photo/logo"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Replace</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      takeSnapshot();
                                      setEmbeddedImages(prev => prev.map(i => i.id === emb.id ? { ...i, isDeleted: true } : i));
                                      setActiveEmbeddedImgId(null);
                                    }}
                                    className="px-2 py-1 hover:bg-red-50 text-red-600 font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Delete / Erase this image"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setActiveEmbeddedImgId(null)}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-500 cursor-pointer"
                                    title="Deselect"
                                  >
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                  </button>
                                </div>
                              )}

                              {isActive && (
                                <div
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setResizingItemId({ type: "embedded-image", id: emb.id });
                                    setResizeInitial({ startX: e.clientX, startY: e.clientY, initialW: emb.width, initialH: emb.height });
                                  }}
                                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white cursor-nwse-resize z-30 shadow"
                                  title="Drag to resize"
                                />
                              )}
                            </div>
                          );
                        })}

                      {/* 6. Inline Text Items for this page */}
                      {(() => {
                        const pageTexts = textList.filter(t => t.page === pNum);
                        const pageYShifts = calculatePageYShifts(pageTexts);

                        return pageTexts.map(item => {
                          const isSelected = activeTextId === item.id;
                          const isTextChanged = item.isOriginal && item.currentText.trim() !== item.originalText.trim();
                          const isDimensionChanged = item.isOriginal && (
                            (item.origWidth !== undefined && Math.abs(item.width - item.origWidth) > 3) ||
                            (item.origHeight !== undefined && Math.abs(item.height - item.origHeight) > 3) ||
                            (item.origX !== undefined && Math.abs(item.x - item.origX) > 3) ||
                            (item.origY !== undefined && Math.abs(item.y - item.origY) > 3)
                          );
                          const isModified = isTextChanged || isDimensionChanged;
                          const yShift = pageYShifts.get(item.id) || 0;
                          const isShiftedOriginal = item.isOriginal && !isModified && yShift > 0;

                          // Lock height strictly to item.height until an extra line is genuinely created
                          const extraLines = calculateExtraLines(item);
                          const lineH = item.lineHeight || item.fontSize * 1.25;
                          const effectiveHeight = extraLines > 0 ? item.height + (extraLines * lineH) : item.height;

                          // 4px horizontal bleed and 3px vertical bleed to completely engulf canvas anti-aliasing edges (ticks and dashes)
                          const bleedX = (isSelected || isModified || isShiftedOriginal) ? 4 * zoom : 0;
                          const bleedY = (isSelected || isModified || isShiftedOriginal) ? 3 * zoom : 0;

                          const scaledX = item.x * zoom;
                          const scaledY = (item.y + yShift) * zoom;
                          const scaledWidth = item.width * zoom;
                          const scaledHeight = effectiveHeight * zoom;
                          const scaledFontSize = Math.max(6, item.fontSize * zoom);
                          const scaledLineHeight = (item.lineHeight || item.fontSize * 1.25) * zoom;

                          const fontFamilyCss = item.fontFamily === "TimesRoman"
                            ? '"Times New Roman", Times, Georgia, "Nimbus Roman No9 L", serif'
                            : item.fontFamily === "Courier"
                            ? '"Courier New", Courier, monospace'
                            : 'Arial, "Helvetica Neue", Helvetica, sans-serif';

                          return (
                            <div key={item.id} className="contents">
                              {/* 1. Complete Whiteout of the entire original text footprint from the PDF canvas ONLY when selected, modified, or shifted */}
                              {item.isOriginal && (isSelected || isModified || isShiftedOriginal) && (() => {
                                const origFx = item.origX !== undefined ? item.origX : item.x;
                                const origFy = item.origY !== undefined ? item.origY : item.y;
                                const origFw = item.origWidth !== undefined ? item.origWidth : item.width;
                                const origFh = item.origHeight !== undefined ? item.origHeight : item.height;

                                return (
                                  <div
                                    style={{
                                      left: `${(origFx * zoom) - (4 * zoom)}px`,
                                      top: `${(origFy * zoom) - (3 * zoom)}px`,
                                      width: `${(origFw * zoom) + (8 * zoom)}px`,
                                      height: `${(origFh * zoom) + (6 * zoom)}px`,
                                      backgroundColor: item.bgColor || "#ffffff",
                                    }}
                                    className="absolute pointer-events-none z-24"
                                  />
                                );
                              })()}

                              <div
                                style={{
                                  left: `${scaledX - bleedX}px`,
                                  top: `${scaledY - bleedY}px`,
                                  width: `${scaledWidth + (bleedX * 2)}px`,
                                  height: `${scaledHeight + (bleedY * 2)}px`,
                                  zIndex: isSelected ? 50 : (isModified || isShiftedOriginal) ? 35 : 25,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTextId(item.id);
                                  if (item.isScrambled || isScrambledText(item.currentText) || isScrambledText(item.originalText)) {
                                    handleAutoFixText(item);
                                  }
                                }}
                                className={`absolute transition-all ${
                                  isSelected
                                    ? "z-50 border-[1.5px] border-blue-600 rounded-[2px] shadow-sm bg-white"
                                    : activeTool === "edit-text"
                                    ? "border border-transparent hover:border-dashed hover:border-blue-500/80 hover:bg-blue-500/[0.06] cursor-text rounded-[1px]"
                                    : "cursor-pointer rounded-[1px]"
                                }`}
                              >
                                {isSelected ? (
                                  <div className="relative w-full h-full">
                                    {/* Corner decorative handles */}
                                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-white border-[1.5px] border-blue-600 rounded-[1px] pointer-events-none z-60" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-white border-[1.5px] border-blue-600 rounded-[1px] pointer-events-none z-60" />
                                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border-[1.5px] border-blue-600 rounded-[1px] pointer-events-none z-60" />

                                    {/* Sleek Right-Edge Resize Handle (Width resize) */}
                                    <div
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setResizingItemId({ type: "text", id: item.id });
                                        setResizeInitial({ startX: e.clientX, startY: e.clientY, initialW: item.width, initialH: item.height });
                                      }}
                                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2 h-7 bg-white hover:bg-blue-50 border-[1.5px] border-blue-600 rounded-full cursor-ew-resize shadow-md flex items-center justify-center z-70 pointer-events-auto transition-all hover:scale-110 active:scale-95"
                                      title="Drag to resize width (chhota ya bada karein)"
                                    >
                                      <div className="w-0.5 h-3 bg-blue-600/80 rounded-full" />
                                    </div>

                                    {/* Sleek Bottom-Right Corner Handle (Width & Height resize) */}
                                    <div
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setResizingItemId({ type: "text", id: item.id });
                                        setResizeInitial({ startX: e.clientX, startY: e.clientY, initialW: item.width, initialH: item.height });
                                      }}
                                      className="absolute -bottom-1.5 -right-1.5 w-2.5 h-2.5 bg-blue-600 hover:bg-blue-700 rounded-[2px] border border-white cursor-nwse-resize shadow-sm z-70 pointer-events-auto transition-transform hover:scale-125"
                                      title="Drag to resize box size"
                                    />

                                    <textarea
                                      value={ocrLoadingId === item.id && (item.isScrambled || isScrambledText(item.currentText)) ? "" : item.currentText}
                                      placeholder={ocrLoadingId === item.id ? "✨ Reading real text from PDF..." : "Type text..."}
                                      autoFocus
                                      onFocus={(e) => {
                                        const len = e.currentTarget.value.length;
                                        e.currentTarget.setSelectionRange(len, len);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                          setActiveTextId(null);
                                        }
                                      }}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTextList(prev =>
                                          prev.map(t => (t.id === item.id ? { ...t, currentText: val, whiteoutOriginal: val.trim() !== t.originalText.trim(), isScrambled: false } : t))
                                        );
                                      }}
                                      style={{
                                        color: item.color || "#000000",
                                        fontSize: `${scaledFontSize}px`,
                                        lineHeight: `${scaledLineHeight}px`,
                                        fontFamily: fontFamilyCss,
                                        fontWeight: item.isBold ? 700 : 400,
                                        fontStyle: item.isItalic ? "italic" : "normal",
                                        textAlign: item.align || "left",
                                        letterSpacing: "-0.15px",
                                        backgroundColor: item.bgColor || "#ffffff",
                                        height: "100%",
                                        width: "100%",
                                        padding: `${bleedY}px ${bleedX}px`,
                                        boxSizing: "border-box",
                                        margin: 0,
                                        resize: "none",
                                        overflow: "hidden",
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                      }}
                                      className="outline-none border-0 rounded-[1px] m-0 box-border block select-text"
                                    />
                                  </div>
                                ) : (isModified || isShiftedOriginal) ? (
                                  <div
                                    style={{
                                      color: item.color || "#000000",
                                      fontSize: `${scaledFontSize}px`,
                                      lineHeight: `${scaledLineHeight}px`,
                                      fontFamily: fontFamilyCss,
                                      fontWeight: item.isBold ? 700 : 400,
                                      fontStyle: item.isItalic ? "italic" : "normal",
                                      textAlign: item.align || "left",
                                      textJustify: item.align === "justify" ? "inter-word" : undefined,
                                      textAlignLast: item.align === "justify" ? "left" : undefined,
                                      letterSpacing: "-0.15px",
                                      backgroundColor: item.bgColor || "#ffffff",
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                      padding: `${bleedY}px ${bleedX}px`,
                                      boxSizing: "border-box",
                                      width: "100%",
                                      height: "100%",
                                      margin: 0,
                                    }}
                                    className="w-full h-full cursor-text select-none block rounded-[1px]"
                                    title="Click to edit"
                                  >
                                    {item.currentText || <span className="text-gray-300 italic">(empty)</span>}
                                  </div>
                                ) : !item.isOriginal ? (
                                  <div
                                    style={{
                                      color: item.color || selectedColor || "#000000",
                                      fontSize: `${scaledFontSize}px`,
                                      lineHeight: `${scaledLineHeight}px`,
                                      fontFamily: fontFamilyCss,
                                      fontWeight: item.isBold ? 700 : 400,
                                      fontStyle: item.isItalic ? "italic" : "normal",
                                      textAlign: item.align || "left",
                                      textJustify: item.align === "justify" ? "inter-word" : undefined,
                                      backgroundColor: item.bgColor || "transparent",
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                      padding: 0,
                                      margin: 0,
                                    }}
                                    className="px-0.5 rounded-[1px] border border-dashed border-blue-400 select-none cursor-text"
                                    title="Click to edit"
                                  >
                                    {item.currentText}
                                  </div>
                                ) : (
                                  <div
                                    className="w-full h-full cursor-text rounded-[1px]"
                                    title="Click to edit"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Floating Dark Pill Dock for Page Navigation & Zoom (Image 1 & 2 reference style) */}
            {totalPages > 0 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="sticky bottom-4 z-40 flex items-center gap-1.5 bg-[#2E3440]/95 backdrop-blur-md text-white px-3.5 py-1.5 rounded-lg shadow-2xl text-xs select-none shrink-0 border border-white/10"
              >
                <button
                  type="button"
                  onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 hover:bg-white/15 disabled:opacity-30 rounded cursor-pointer transition-colors"
                  title="Previous Page"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 hover:bg-white/15 disabled:opacity-30 rounded cursor-pointer transition-colors"
                  title="Next Page"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 font-medium text-xs px-1">
                  <span className="bg-[#4C566A] px-2 py-0.5 rounded text-white font-mono min-w-[28px] text-center font-bold">
                    {currentPage}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-300 font-mono">{totalPages}</span>
                </div>

                <div className="w-px h-4 bg-white/20 mx-1" />

                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.3, Number((prev - 0.1).toFixed(2))))}
                  className="p-1 hover:bg-white/15 rounded cursor-pointer text-slate-200 hover:text-white transition-colors"
                  title="Zoom Out"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(2.5, Number((prev + 0.1).toFixed(2))))}
                  className="p-1 hover:bg-white/15 rounded cursor-pointer text-slate-200 hover:text-white transition-colors"
                  title="Zoom In"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <span className="text-[12px] font-mono font-medium text-slate-100 min-w-[44px] text-center px-1">
                  {Math.round(zoom * 100)}%
                </span>

                <div className="w-px h-4 bg-white/20 mx-1" />

                <button
                  type="button"
                  onClick={() => {
                    if (containerRef.current) {
                      const deskW = containerRef.current.clientWidth - 80;
                      const baseW = pageDimensions[currentPage]?.width || 595;
                      if (baseW > 0) {
                        const fitZoom = Math.min(1.5, Math.max(0.35, Number((deskW / baseW).toFixed(2))));
                        setZoom(fitZoom);
                      }
                    }
                  }}
                  className="p-1 hover:bg-white/15 rounded cursor-pointer text-slate-200 hover:text-white transition-colors"
                  title="Fit to Width"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPageRotations(prev => ({
                      ...prev,
                      [currentPage]: ((prev[currentPage] || 0) + 90) % 360
                    }));
                  }}
                  className="p-1 hover:bg-white/15 rounded cursor-pointer text-slate-200 hover:text-white transition-colors"
                  title="Rotate Page"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowFindReplace(prev => !prev)}
                  className="p-1 hover:bg-white/15 rounded cursor-pointer text-slate-200 hover:text-white transition-colors"
                  title="Find & Replace"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* COLUMN 3: RIGHT INSPECTOR / TEXT STYLES & SAVE PANEL (Image 2 style) */}
          {showInspectorSidebar && (() => {
            const selectedTextItem = textList.find(t => t.id === activeTextId);

            return (
              <div className="w-64 sm:w-72 shrink-0 bg-white border-l border-slate-200 flex flex-col justify-between p-4 overflow-y-auto select-none">
                <div className="flex flex-col gap-4">
                  {/* Panel Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                      {selectedTextItem ? "Text Styles" : "Inspector"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowInspectorSidebar(false)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Hide Inspector"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5 rotate-180" />
                    </button>
                  </div>

                  {/* Inspector Body */}
                  <div className="flex flex-col gap-3.5">
                    {/* Font Family */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Font Family</label>
                      <select
                        value={selectedTextItem ? selectedTextItem.fontFamily : fontFamily}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setFontFamily(val);
                          if (selectedTextItem) {
                            takeSnapshot();
                            setTextList(prev => prev.map(t => t.id === selectedTextItem.id ? { ...t, fontFamily: val } : t));
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-medium rounded-lg px-2.5 py-1.5 outline-none cursor-pointer text-slate-800 hover:bg-slate-100 transition-colors"
                      >
                        <option value="Helvetica">Helvetica (Sans-Serif)</option>
                        <option value="TimesRoman">Times New Roman (Serif)</option>
                        <option value="Courier">Courier New (Monospace)</option>
                      </select>
                    </div>

                    {/* Font Size */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Font Size</label>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedTextItem ? Math.round(selectedTextItem.fontSize) : fontSize}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setFontSize(val);
                            if (selectedTextItem) {
                              takeSnapshot();
                              setTextList(prev => prev.map(t => t.id === selectedTextItem.id ? { ...t, fontSize: val } : t));
                            }
                          }}
                          className="flex-1 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 outline-none cursor-pointer text-slate-800"
                        >
                          {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64].map(s => (
                            <option key={s} value={s}>{s} pt</option>
                          ))}
                        </select>
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <button
                            type="button"
                            onClick={() => {
                              const cur = selectedTextItem ? selectedTextItem.fontSize : fontSize;
                              const next = Math.max(6, Math.round(cur) - 1);
                              setFontSize(next);
                              if (selectedTextItem) {
                                takeSnapshot();
                                setTextList(prev => prev.map(t => t.id === selectedTextItem.id ? { ...t, fontSize: next } : t));
                              }
                            }}
                            className="px-2 py-1.5 hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer transition-colors"
                            title="Decrease font size"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const cur = selectedTextItem ? selectedTextItem.fontSize : fontSize;
                              const next = Math.min(96, Math.round(cur) + 1);
                              setFontSize(next);
                              if (selectedTextItem) {
                                takeSnapshot();
                                setTextList(prev => prev.map(t => t.id === selectedTextItem.id ? { ...t, fontSize: next } : t));
                              }
                            }}
                            className="px-2 py-1.5 hover:bg-slate-200 text-slate-600 font-bold text-xs cursor-pointer transition-colors border-l border-slate-200"
                            title="Increase font size"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bold & Italic */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Text Style</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = selectedTextItem ? !selectedTextItem.isBold : !isBold;
                            setIsBold(nextVal);
                            if (selectedTextItem) {
                              takeSnapshot();
                              setTextList(prev => prev.map(t => t.id === selectedTextItem.id ? { ...t, isBold: nextVal } : t));
                            }
                          }}
                          className={`py-1.5 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                            (selectedTextItem ? selectedTextItem.isBold : isBold)
                              ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                          title="Bold"
                        >
                          <Bold className="w-3.5 h-3.5" />
                          <span>Bold</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = selectedTextItem ? !selectedTextItem.isItalic : !isItalic;
                            setIsItalic(nextVal);
                            if (selectedTextItem) {
                              takeSnapshot();
                              setTextList(prev => prev.map(t => t.id === selectedTextItem.id ? { ...t, isItalic: nextVal } : t));
                            }
                          }}
                          className={`py-1.5 px-3 rounded-lg border font-bold text-xs italic flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                            (selectedTextItem ? selectedTextItem.isItalic : isItalic)
                              ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                          title="Italic"
                        >
                          <Italic className="w-3.5 h-3.5" />
                          <span>Italic</span>
                        </button>
                      </div>
                    </div>

                    {/* Alignment */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Alignment</label>
                      <div className="grid grid-cols-4 gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                        {(["left", "center", "right", "justify"] as const).map(align => {
                          const currentAlign = selectedTextItem ? (selectedTextItem.align || "left") : "left";
                          const isActive = currentAlign === align;
                          const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : align === "right" ? AlignRight : AlignJustify;

                          return (
                            <button
                              key={align}
                              type="button"
                              onClick={() => {
                                if (selectedTextItem) {
                                  takeSnapshot();
                                  setTextList(prev => prev.map(t => t.id === selectedTextItem.id ? { ...t, align } : t));
                                }
                              }}
                              className={`py-1 rounded flex items-center justify-center cursor-pointer transition-all ${
                                isActive ? "bg-white text-blue-600 shadow-xs font-bold" : "text-slate-500 hover:text-slate-800"
                              }`}
                              title={`Align ${align}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Current Color & Palette */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1.5">Current Color</label>
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-7 h-7 rounded-full border border-slate-300 shadow-xs shrink-0 cursor-pointer relative overflow-hidden"
                          style={{ backgroundColor: selectedTextItem ? selectedTextItem.color : selectedColor }}
                        >
                          <input
                            type="color"
                            value={selectedTextItem ? selectedTextItem.color : selectedColor}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedColor(val);
                              if (selectedTextItem) {
                                takeSnapshot();
                                setTextList(prev => prev.map(t => t.id === selectedTextItem.id ? { ...t, color: val } : t));
                              }
                            }}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          />
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-700 uppercase">
                          {selectedTextItem ? selectedTextItem.color : selectedColor}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {COLORS.map(c => {
                          const curColor = selectedTextItem ? selectedTextItem.color : selectedColor;
                          const isMatch = curColor.toLowerCase() === c.value.toLowerCase();

                          return (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => {
                                setSelectedColor(c.value);
                                if (selectedTextItem) {
                                  takeSnapshot();
                                  setTextList(prev => prev.map(t => t.id === selectedTextItem.id ? { ...t, color: c.value } : t));
                                }
                              }}
                              className={`w-5 h-5 rounded-full border cursor-pointer transition-transform ${
                                isMatch ? "ring-2 ring-blue-500 scale-110 shadow-xs" : "hover:scale-110 border-slate-300"
                              }`}
                              style={{ backgroundColor: c.value }}
                              title={c.name}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* AI OCR Recovery Button */}
                    {selectedTextItem && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleAutoFixText(selectedTextItem)}
                          disabled={ocrLoadingId === selectedTextItem.id}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                            ocrLoadingId === selectedTextItem.id
                              ? "bg-purple-100 border-purple-300 text-purple-700 animate-pulse"
                              : (selectedTextItem.isScrambled || isScrambledText(selectedTextItem.currentText))
                              ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-700 shadow-xs"
                              : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                          }`}
                          title="Recover exact glyphs from canvas"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>{ocrLoadingId === selectedTextItem.id ? "Reading text from PDF..." : "Fix Text with AI OCR"}</span>
                        </button>
                      </div>
                    )}

                    {/* Delete Selected Text */}
                    {selectedTextItem && (
                      <button
                        type="button"
                        onClick={() => {
                          takeSnapshot();
                          if (selectedTextItem.isOriginal) {
                            setTextList(prev => prev.map(t => t.id === selectedTextItem.id ? { ...t, currentText: "", whiteoutOriginal: true } : t));
                          } else {
                            setTextList(prev => prev.filter(t => t.id !== selectedTextItem.id));
                          }
                          setActiveTextId(null);
                        }}
                        className="w-full py-1.5 px-3 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Selected Text</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Actions of Inspector */}
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      className="flex-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-30 cursor-pointer flex items-center justify-center gap-1 transition-colors"
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Undo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={redoStack.length === 0}
                      className="flex-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-30 cursor-pointer flex items-center justify-center gap-1 transition-colors"
                      title="Redo (Ctrl+Shift+Z)"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                      <span>Redo</span>
                    </button>
                  </div>

                  {/* Big Red Button: Save changes ➔ */}
                  <button
                    type="button"
                    onClick={handleSaveAndProcess}
                    disabled={isSaving}
                    className="w-full bg-[#E5322D] hover:bg-[#CC2A26] text-white py-3.5 px-4 rounded-xl font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-75 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving changes...</span>
                      </>
                    ) : (
                      <>
                        <span>{isSignTool ? "Sign & Download" : "Save changes"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ELECTRONIC SIGNATURE MODAL SUBCOMPONENT
// ==========================================

interface SignatureModalProps {
  onClose: () => void;
  onAddSignature: (dataUrl: string) => void;
}

function SignatureModal({ onClose, onAddSignature }: SignatureModalProps) {
  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw");
  const [typedName, setTypedName] = useState("");
  const [typedFont, setTypedFont] = useState<"caveat" | "dancing" | "serif">("caveat");
  const [penColor, setPenColor] = useState("#000000");

  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);

  const clearCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setIsDrawingSig(true);
  };

  const drawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    setIsDrawingSig(false);
  };

  const handleApply = () => {
    if (tab === "draw") {
      const canvas = sigCanvasRef.current;
      if (!canvas) return;
      onAddSignature(canvas.toDataURL("image/png"));
    } else if (tab === "type") {
      if (!typedName.trim()) return;
      const offscreen = document.createElement("canvas");
      offscreen.width = 500;
      offscreen.height = 180;
      const ctx = offscreen.getContext("2d");
      if (ctx) {
        ctx.fillStyle = penColor;
        ctx.font = typedFont === "caveat"
          ? 'italic 64px "Brush Script MT", "Caveat", cursive'
          : typedFont === "dancing"
          ? 'italic 60px "Segoe Script", "Dancing Script", cursive'
          : 'italic 56px "Times New Roman", serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(typedName, 250, 90);
        onAddSignature(offscreen.toDataURL("image/png"));
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        onAddSignature(dataUrl);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl p-6 shadow-2xl border border-gray-200 max-w-lg w-full flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-gray-900">Add Electronic Signature</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-black rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setTab("draw")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === "draw" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black"
            }`}
          >
            Draw Signature
          </button>
          <button
            type="button"
            onClick={() => setTab("type")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === "type" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black"
            }`}
          >
            Type Signature
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === "upload" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-black"
            }`}
          >
            Upload Image
          </button>
        </div>

        {/* Tab Content */}
        {tab === "draw" && (
          <div className="flex flex-col gap-2">
            <div className="relative border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 overflow-hidden">
              <canvas
                ref={sigCanvasRef}
                width={460}
                height={170}
                onMouseDown={startDraw}
                onMouseMove={drawMove}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={drawMove}
                onTouchEnd={endDraw}
                className="w-full h-[170px] cursor-crosshair block"
              />
              <span className="absolute bottom-2 left-3 text-[11px] text-gray-400 pointer-events-none select-none">
                Sign above the line
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-semibold">Ink:</span>
                {["#000000", "#1E3A8A", "#E5322D"].map(col => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setPenColor(col)}
                    className={`w-5 h-5 rounded-full border cursor-pointer ${penColor === col ? "ring-2 ring-offset-1 ring-blue-500" : ""}`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-xs font-semibold text-gray-500 hover:text-red-600 cursor-pointer"
              >
                Clear Pad
              </button>
            </div>
          </div>
        )}

        {tab === "type" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Your Name / Initials:</label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="e.g. Samir Ansari"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-600">Choose Script Style:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTypedFont("caveat")}
                  style={{ fontFamily: '"Brush Script MT", cursive' }}
                  className={`p-3 rounded-xl border text-xl text-center cursor-pointer ${
                    typedFont === "caveat" ? "border-blue-500 bg-blue-50/50 text-blue-900" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {typedName || "Signature"}
                </button>
                <button
                  type="button"
                  onClick={() => setTypedFont("dancing")}
                  style={{ fontFamily: '"Segoe Script", cursive' }}
                  className={`p-3 rounded-xl border text-lg text-center cursor-pointer ${
                    typedFont === "dancing" ? "border-blue-500 bg-blue-50/50 text-blue-900" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {typedName || "Signature"}
                </button>
                <button
                  type="button"
                  onClick={() => setTypedFont("serif")}
                  style={{ fontFamily: '"Times New Roman", serif', fontStyle: "italic" }}
                  className={`p-3 rounded-xl border text-lg text-center cursor-pointer ${
                    typedFont === "serif" ? "border-blue-500 bg-blue-50/50 text-blue-900" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {typedName || "Signature"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "upload" && (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 gap-2">
            <ImageIcon className="w-8 h-8 text-gray-400" />
            <p className="text-xs font-semibold text-gray-600">Upload signature image (PNG or JPG)</p>
            <label className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer mt-2 shadow-sm">
              Choose File
              <input type="file" accept="image/png,image/jpeg" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          {tab !== "upload" && (
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm cursor-pointer active:scale-95 transition-all"
            >
              Insert Signature
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
