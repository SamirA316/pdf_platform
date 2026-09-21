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
  Plus
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
  isBold: boolean;
  isItalic: boolean;
  color: string;
  bgColor: string; // sampled background color
  bgRgb: [number, number, number];
  align: "left" | "center" | "right";
  isOriginal: boolean;
  whiteoutOriginal: boolean;
  origPdfX?: number;
  origPdfY?: number;
  origWidth?: number;
  origHeight?: number;
  rawBoxes?: RawBox[];
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
    const exactPt = (item.height && item.height > 0)
      ? item.height
      : (Math.hypot(item.transform[2], item.transform[3]) || Math.abs(item.transform[3]) || Math.hypot(item.transform[0], item.transform[1]) || 12);
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

  // 2. Sort items: Line-by-line using text BASELINE (vy) threshold, then left-to-right (vx)
  // This completely eliminates cross-column / mismatched font-size line scramble!
  rawList.sort((a, b) => {
    const baselineDiff = a.vy - b.vy;
    const lineThreshold = Math.min(a.fontSizePt, b.fontSizePt) * zoom * 0.45;
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
      const isSameLine = baselineDiff <= Math.max(current.fontSize * zoom * 0.45, 5);
      const prevRight = current.lastVx + current.lastWidth;
      const gap = item.vx - prevRight;

      // Allow negative kerning (down to -35% font size) and standard word spacing (up to 1.6x font size or 22px)
      const minGap = -(current.fontSize * zoom * 0.35);
      const maxGap = Math.min(Math.max(current.fontSize * zoom * 1.6, 12), 22);
      const isAdjacent = gap >= minGap && gap <= maxGap;

      if (isSameLine && isAdjacent) {
        const lastStr = current.strParts[current.strParts.length - 1] || "";
        const needsSpace = gap > Math.max(current.fontSize * zoom * 0.15, 2.0) &&
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

        if (item.hasEOL) {
          clusters.push(current);
          current = null;
        }

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

    if (item.hasEOL) {
      clusters.push(current);
      current = null;
    }
  }

  if (current) {
    clusters.push(current);
  }

  // Filter out any purely empty whitespace clusters
  const validClusters = clusters.filter(c => c.strParts.join("").trim().length > 0);

  // 4. Generate clean, high-fidelity EditableText objects
  return validClusters.map((grp, idx) => {
    const combinedText = grp.strParts.join("");
    const w = Math.max(grp.maxX - grp.minX, 20);
    const h = Math.max(grp.maxY - grp.minY, 13);

    const isFontBold = grp.fontNameCombined.includes("bold") ||
      grp.fontNameCombined.includes("black") ||
      grp.fontNameCombined.includes("heavy") ||
      grp.fontNameCombined.includes("semi") ||
      grp.fontSize >= 18;
    const isFontItalic = grp.fontNameCombined.includes("italic") || grp.fontNameCombined.includes("oblique");
    const fontLower = grp.fontNameCombined.toLowerCase();
    const isFontMono = /courier|mono|consolas|menlo|monaco/i.test(fontLower);
    const isFontSans = /sans|arial|helvetica|roboto|calibri|open\s*sans|segoe|verdana|tahoma|system/i.test(fontLower);
    // Explicitly exclude sans-serif from serif match so "sans-serif" never matches "serif"
    const isFontSerif = !isFontSans && (/times|roman|georgia|cambria|garamond|palatino|baskerville/i.test(fontLower) || /\bserif\b/i.test(fontLower));

    const detectedFont: "Helvetica" | "TimesRoman" | "Courier" = isFontMono ? "Courier" : isFontSerif ? "TimesRoman" : "Helvetica";

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

        // Contrast & sanity safeguard
        const bgLum = 0.299 * bgSample.r + 0.587 * bgSample.g + 0.114 * bgSample.b;
        const [tr, tg, tb] = parseColorToRgb(detectedColor);
        const trByte = Math.round(tr * 255);
        const tgByte = Math.round(tg * 255);
        const tbByte = Math.round(tb * 255);
        const colorDiff = Math.max(trByte, tgByte, tbByte) - Math.min(trByte, tgByte, tbByte);
        const maxByte = Math.max(trByte, tgByte, tbByte);
        const isNeutral = colorDiff < 40 || (maxByte > 0 && colorDiff / maxByte < 0.22);

        if (bgLum >= 130) {
          // Light background: Neutral text must always be pure black #000000
          if (isNeutral) {
            detectedColor = "#000000";
          }
        } else if (bgLum < 130) {
          // Dark background: Neutral text must always be pure white #ffffff
          if (isNeutral) {
            detectedColor = "#ffffff";
          }
        }
      } catch {}
    }

    const isScrambled = pageHasCorruptedFonts || isScrambledText(combinedText);

    return {
      id: `p${pageNum}-txt-${idx}`,
      page: pageNum,
      originalText: combinedText,
      currentText: combinedText,
      x: grp.minX,
      y: grp.minY,
      width: w,
      height: h,
      fontSize: grp.fontSize,
      fontFamily: detectedFont,
      isBold: isFontBold,
      isItalic: isFontItalic,
      color: detectedColor,
      bgColor: bgHex,
      bgRgb: bgRgbVal,
      align: "left",
      isOriginal: true,
      whiteoutOriginal: false,
      origPdfX: grp.origPdfX,
      origPdfY: grp.origPdfY,
      origWidth: grp.rawBoxes.reduce((acc, b) => acc + b.origWidth, 0),
      origHeight: grp.origHeight,
      rawBoxes: grp.rawBoxes,
      isScrambled,
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
  const [zoom, setZoom] = useState(1.25);
  const [pageRotations, setPageRotations] = useState<{ [page: number]: number }>({});

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

  // History Stack for Undo / Redo
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  // Dragging & Resizing States
  const [draggingItemId, setDraggingItemId] = useState<{ type: "text" | "image" | "shape" | "whiteout" | "embedded-image"; id: string } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingItemId, setResizingItemId] = useState<{ type: "image" | "shape" | "whiteout" | "embedded-image"; id: string } | null>(null);
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

      const res = await apiClient("/api/pdf/ocr-crop", {
        data: { image: cropDataUrl },
      });

      if (res && typeof res.text === "string" && res.text.trim().length > 0) {
        const fixedText = sanitizeOcrText(res.text.trim());
        takeSnapshot();
        setTextList(prev =>
          prev.map(t =>
            t.id === item.id
              ? {
                  ...t,
                  originalText: fixedText,
                  currentText: fixedText,
                  whiteoutOriginal: false,
                  isScrambled: false,
                }
              : t
          )
        );
      }
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
        const loadedPdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (isCancelled) return;
        setPdfDoc(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error("Failed to load PDF in editor:", err);
      }
    };

    loadPdfFile();
    return () => { isCancelled = true; };
  }, [isPdfJsLoaded, files]);

  // Background Multi-Page Deep Scanner & Thumbnail Generator
  useEffect(() => {
    if (!pdfDoc) return;
    let isCancelled = false;

    const scanAllPages = async () => {
      setIsScanning(true);
      let totalTexts = 0;
      let totalImages = 0;
      const total = pdfDoc.numPages;

      // Give main canvas a small tick to start rendering first page without worker conflict
      await new Promise(r => setTimeout(r, 120));
      if (isCancelled) return;

      for (let p = 1; p <= total; p++) {
        if (isCancelled) break;
        try {
          setScanProgress({ current: p, total, texts: totalTexts, images: totalImages });
          const pg = await pdfDoc.getPage(p);
          if (isCancelled) break;

          const rot = (pageRotations[p] || 0) % 360;
          const fullViewport = pg.getViewport({ scale: zoom, rotation: rot });

          // 1. Deep Extract & Cluster Text for this page
          const txt = await pg.getTextContent();
          const pageTexts = extractAndClusterPageText(txt, fullViewport, p, zoom, null);
          totalTexts += pageTexts.length;

          // Only populate textList for background pages.
          // currentPage is rendered and extracted with high-fidelity live canvas sampling by renderAndExtract!
          if (p !== currentPage) {
            setTextList(prev => {
              const hasExisting = prev.some(it => it.page === p && it.isOriginal);
              if (hasExisting) return prev;
              return [...prev, ...pageTexts];
            });
          }

          // 2. Count Images
          let imgCount = 0;
          try {
            const opList = await pg.getOperatorList();
            const OPS = (window as any).pdfjsLib?.OPS;
            if (OPS && opList?.fnArray) {
              for (let i = 0; i < opList.fnArray.length; i++) {
                const fn = opList.fnArray[i];
                if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
                  imgCount++;
                }
              }
            }
          } catch {}
          totalImages += imgCount;

          setPageStats(prev => ({ ...prev, [p]: { texts: pageTexts.length, images: imgCount } }));

          // 3. Render visual thumbnail preview
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
            } catch (thumbErr) {
              console.warn("Thumbnail render warning:", thumbErr);
            }
          }
        } catch (e) {
          console.warn(`Scan error on page ${p}:`, e);
        }
      }

      if (!isCancelled) {
        setScanProgress({ current: total, total, texts: totalTexts, images: totalImages });
        setIsScanning(false);
        setTimeout(() => {
          if (!isCancelled) setScanProgress(null);
        }, 4000);
      }
    };

    scanAllPages();
    return () => { isCancelled = true; };
  }, [pdfDoc, zoom, pageRotations]);

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

  // Render Visual Page and Extract Text
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    let isCancelled = false;

    const renderAndExtract = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const currentRotation = (pageRotations[currentPage] || 0) % 360;
        const viewport = page.getViewport({ scale: zoom, rotation: currentRotation });

        const pdfCanvas = pdfCanvasRef.current;
        const drawCanvas = drawCanvasRef.current;
        if (!pdfCanvas || !drawCanvas) return;

        // High-DPI / Retina rendering: render canvas at 2x+ physical pixels for razor-sharp, crystal clear clarity
        const dpr = typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 2) : 2;
        const renderViewport = page.getViewport({ scale: zoom * dpr, rotation: currentRotation });

        pdfCanvas.width = Math.floor(renderViewport.width);
        pdfCanvas.height = Math.floor(renderViewport.height);
        pdfCanvas.style.width = `${Math.floor(viewport.width)}px`;
        pdfCanvas.style.height = `${Math.floor(viewport.height)}px`;

        drawCanvas.width = Math.floor(renderViewport.width);
        drawCanvas.height = Math.floor(renderViewport.height);
        drawCanvas.style.width = `${Math.floor(viewport.width)}px`;
        drawCanvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = pdfCanvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch {}
        }

        try {
          const renderTask = page.render({
            canvasContext: ctx,
            viewport: renderViewport,
            intent: "display",
          });
          renderTaskRef.current = renderTask;
          await renderTask.promise;
        } catch (rErr: any) {
          if (rErr?.name !== "RenderingCancelledException") {
            console.warn("Main canvas render warning:", rErr);
          }
        }

        if (isCancelled) return;

        // Restore freehand drawings for this page if any
        const drawCtx = drawCanvas.getContext("2d");
        const pageHistory = drawActions[currentPage];
        if (drawCtx && pageHistory && pageHistory.length > 0) {
          drawCtx.putImageData(pageHistory[pageHistory.length - 1], 0, 0);
        }

        // =========================================================================
        // ACCURATE TEXT EXTRACTION & LIVE BACKGROUND COLOR SAMPLING
        // =========================================================================
        const textContent = await page.getTextContent();
        if (isCancelled) return;

        const pageTexts = extractAndClusterPageText(textContent, viewport, currentPage, zoom, ctx);

        setTextList(prev => {
          const otherPages = prev.filter(item => item.page !== currentPage);
          const existingCurrent = prev.filter(item => item.page === currentPage);

          if (existingCurrent.length === 0) {
            return [...otherPages, ...pageTexts];
          }

          // Merge fresh detected text with any existing user modifications
          const merged = pageTexts.map(fresh => {
            const userEdited = existingCurrent.find(
              ex => ex.id === fresh.id || (
                Math.abs(ex.x - fresh.x) < 8 && Math.abs(ex.y - fresh.y) < 8
              )
            );
            if (userEdited && (userEdited.whiteoutOriginal || userEdited.currentText !== userEdited.originalText || !userEdited.isOriginal)) {
              // Auto-heal stale black text or serif font if user started editing before live context sampled
              const bgLum = fresh.bgRgb ? (0.299 * fresh.bgRgb[0] + 0.587 * fresh.bgRgb[1] + 0.114 * fresh.bgRgb[2]) : 255;
              let correctedColor = userEdited.color;
              if (bgLum < 128 && (correctedColor === "#000000" || correctedColor === "#374151")) {
                correctedColor = fresh.color;
              }
              let correctedFont = userEdited.fontFamily;
              if (userEdited.fontFamily === "TimesRoman" && fresh.fontFamily === "Helvetica") {
                correctedFont = "Helvetica";
              }
              return {
                ...userEdited,
                bgColor: userEdited.bgColor === "#ffffff" ? fresh.bgColor : userEdited.bgColor,
                bgRgb: userEdited.bgRgb && userEdited.bgRgb[0] === 255 && userEdited.bgRgb[1] === 255 ? fresh.bgRgb : userEdited.bgRgb,
                color: correctedColor,
                fontFamily: correctedFont,
              };
            }
            return fresh;
          });

          // Include any newly user-added text
          const userAddedTexts = existingCurrent.filter(item => !item.isOriginal);

          return [...otherPages, ...merged, ...userAddedTexts];
        });

        // Extract embedded images from this page
        const pageEmbedded = await extractEmbeddedImagesFromPage(page, viewport, pdfCanvas, currentPage);
        if (pageEmbedded.length > 0) {
          setEmbeddedImages(prev => {
            const otherPages = prev.filter(img => img.page !== currentPage);
            const currentExisting = prev.filter(img => img.page === currentPage);
            if (currentExisting.length > 0) {
              return [
                ...otherPages,
                ...currentExisting.map((ex, idx) => {
                  const fresh = pageEmbedded[idx];
                  return fresh
                    ? { ...ex, x: fresh.x, y: fresh.y, width: fresh.width, height: fresh.height }
                    : ex;
                })
              ];
            }
            return [...otherPages, ...pageEmbedded];
          });
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Render/Clustering error:", err);
        }
      }
    };

    renderAndExtract();
    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
      }
    };
  }, [pdfDoc, currentPage, zoom, pageRotations]);

  // Freehand Drawing Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
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
      setBoxStart({ x: cssX, y: cssY });
      setCurrentDragRect({ x: cssX, y: cssY, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

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
      const left = Math.min(cssX, boxStart.x);
      const top = Math.min(cssY, boxStart.y);
      const width = Math.abs(cssX - boxStart.x);
      const height = Math.abs(cssY - boxStart.y);
      setCurrentDragRect({ x: left, y: top, width, height });
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = drawCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setDrawActions(prev => ({
            ...prev,
            [currentPage]: [...(prev[currentPage] || []), data]
          }));
        }
      }
    } else if (isCreatingBox && currentDragRect) {
      setIsCreatingBox(false);
      if (currentDragRect.width > 8 && currentDragRect.height > 8) {
        takeSnapshot();
        if (activeTool === "whiteout") {
          const newWhiteout: WhiteoutAnnotation = {
            id: `wo-${Date.now()}`,
            page: currentPage,
            ...currentDragRect,
            color: "#ffffff",
          };
          setWhiteouts(prev => [...prev, newWhiteout]);
          setActiveWhiteoutId(newWhiteout.id);
        } else if (activeTool === "shape") {
          const newShape: ShapeAnnotation = {
            id: `shape-${Date.now()}`,
            page: currentPage,
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
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === "add-text") {
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(10, e.clientX - rect.left);
      const y = Math.max(10, e.clientY - rect.top);

      takeSnapshot();
      const newId = `new-txt-${Date.now()}`;
      const newText: EditableText = {
        id: newId,
        page: currentPage,
        originalText: "",
        currentText: "New text",
        x,
        y,
        width: 160,
        height: fontSize * zoom * 1.2,
        fontSize,
        fontFamily,
        isBold,
        isItalic,
        color: selectedColor,
        bgColor: "#ffffff",
        bgRgb: [255, 255, 255],
        align: "left",
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
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
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
        }
      } else if (resizingItemId) {
        const deltaX = e.clientX - resizeInitial.startX;
        const deltaY = e.clientY - resizeInitial.startY;
        const newW = Math.max(24, resizeInitial.initialW + deltaX);
        const newH = Math.max(16, resizeInitial.initialH + deltaY);

        if (resizingItemId.type === "image") {
          setImages(prev => prev.map(img => img.id === resizingItemId.id ? { ...img, width: newW, height: newH } : img));
        } else if (resizingItemId.type === "shape") {
          setShapes(prev => prev.map(shp => shp.id === resizingItemId.id ? { ...shp, width: newW, height: newH } : shp));
        } else if (resizingItemId.type === "whiteout") {
          setWhiteouts(prev => prev.map(wo => wo.id === resizingItemId.id ? { ...wo, width: newW, height: newH } : wo));
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
  }, [draggingItemId, resizingItemId, dragOffset, resizeInitial, takeSnapshot]);

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

      const courier = await doc.embedFont(StandardFonts.Courier);
      const courierBold = await doc.embedFont(StandardFonts.CourierBold);

      const getFont = (family: string, bold: boolean, italic: boolean) => {
        if (family === "TimesRoman") {
          return bold ? timesRomanBold : italic ? timesRomanItalic : timesRoman;
        }
        if (family === "Courier") {
          return bold ? courierBold : courier;
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

        const canvasWidth = pdfCanvasRef.current ? (parseFloat(pdfCanvasRef.current.style.width) || pdfCanvasRef.current.width) : pageWidth;
        const canvasHeight = pdfCanvasRef.current ? (parseFloat(pdfCanvasRef.current.style.height) || pdfCanvasRef.current.height) : pageHeight;
        const scaleX = pageWidth / canvasWidth;
        const scaleY = pageHeight / canvasHeight;

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

        // 3. Apply Text Edits & Whiteouts
        const pageTexts = textList.filter(t => t.page === pNum);
        for (const item of pageTexts) {
          const isModified = item.isOriginal && (
            item.whiteoutOriginal ||
            item.currentText !== item.originalText
          );
          const isNew = !item.isOriginal;

          if (isModified) {
            const isTransparent = item.bgColor === "transparent" || item.bgColor === "none";
            if (!isTransparent) {
              let bgR = 1, bgG = 1, bgB = 1;
              if (item.bgRgb && item.bgRgb.length === 3) {
                bgR = item.bgRgb[0] / 255;
                bgG = item.bgRgb[1] / 255;
                bgB = item.bgRgb[2] / 255;
              } else if (item.bgColor && item.bgColor.startsWith("#") && item.bgColor.length === 7) {
                bgR = parseInt(item.bgColor.slice(1, 3), 16) / 255;
                bgG = parseInt(item.bgColor.slice(3, 5), 16) / 255;
                bgB = parseInt(item.bgColor.slice(5, 7), 16) / 255;
              }

              if (item.rawBoxes && item.rawBoxes.length > 0) {
                for (const box of item.rawBoxes) {
                  const bPdfX = box.origPdfX;
                  const bPdfY = box.origPdfY;
                  const bWidth = box.origWidth;
                  const bHeight = box.origHeight;
                  const desc = bHeight * 0.28;

                  page.drawRectangle({
                    x: Math.max(0, bPdfX - 0.5),
                    y: Math.max(0, bPdfY - desc),
                    width: bWidth + 1,
                    height: bHeight * 1.25,
                    color: rgb(bgR, bgG, bgB),
                  });
                }
              } else {
                const origX = item.origPdfX !== undefined ? item.origPdfX : item.x * scaleX;
                const origY = item.origPdfY !== undefined ? item.origPdfY : (pageHeight - (item.y + item.height) * scaleY);
                const origW = item.origWidth !== undefined ? item.origWidth : item.width * scaleX;
                const origH = item.origHeight !== undefined ? item.origHeight : item.fontSize;

                page.drawRectangle({
                  x: Math.max(0, origX - 0.5),
                  y: Math.max(0, origY - (origH * 0.28)),
                  width: origW + 1,
                  height: origH * 1.25,
                  color: rgb(bgR, bgG, bgB),
                });
              }
            }

            const sanitizedText = cleanTextForPdf(item.currentText);
            if (sanitizedText.trim() !== "") {
              const chosenFont = getFont(item.fontFamily, item.isBold, item.isItalic);
              const [r, g, b] = parseColorToRgb(item.color);

              let textWidth = 0;
              try {
                textWidth = chosenFont.widthOfTextAtSize(sanitizedText, item.fontSize);
              } catch {
                textWidth = sanitizedText.length * item.fontSize * 0.55;
              }

              const pdfX = item.origPdfX !== undefined ? item.origPdfX : item.x * scaleX;
              const pdfBaselineY = item.origPdfY !== undefined
                ? item.origPdfY
                : (pageHeight - ((item.y + (item.fontSize * zoom * 0.82)) * scaleY));

              let targetX = pdfX;
              if (item.align === "center") {
                targetX = pdfX + ((item.width * scaleX - textWidth) / 2);
              } else if (item.align === "right") {
                targetX = pdfX + (item.width * scaleX - textWidth);
              }

              page.drawText(sanitizedText, {
                x: Math.max(0, targetX),
                y: Math.max(0, pdfBaselineY),
                size: item.fontSize,
                font: chosenFont,
                color: rgb(r, g, b),
              });
            }
          } else if (isNew) {
            const sanitizedText = cleanTextForPdf(item.currentText);
            if (sanitizedText.trim() !== "") {
              const chosenFont = getFont(item.fontFamily, item.isBold, item.isItalic);
              const [r, g, b] = parseColorToRgb(item.color);

              let textWidth = 0;
              try {
                textWidth = chosenFont.widthOfTextAtSize(sanitizedText, item.fontSize);
              } catch {
                textWidth = sanitizedText.length * item.fontSize * 0.55;
              }

              const pdfX = item.x * scaleX;
              const pdfBaselineY = pageHeight - ((item.y + (item.fontSize * zoom * 0.82)) * scaleY);

              let targetX = pdfX;
              if (item.align === "center") {
                targetX = pdfX - (textWidth / 2);
              } else if (item.align === "right") {
                targetX = pdfX - textWidth;
              }

              page.drawText(sanitizedText, {
                x: Math.max(0, targetX),
                y: Math.max(0, pdfBaselineY),
                size: item.fontSize,
                font: chosenFont,
                color: rgb(r, g, b),
              });
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
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
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
        <div className="w-full max-w-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl px-5 py-2.5 mb-3 shadow-lg flex items-center justify-between text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
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
      <div className="w-full bg-white border border-gray-200 shadow-md rounded-2xl p-2.5 mb-3 flex flex-wrap items-center justify-between gap-2.5 sticky top-3 z-40">
        
        {/* Tools Group */}
        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => {
              setActiveTool("select");
              setActiveTextId(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "select" ? "bg-[#E5322D] text-white shadow-sm" : "text-gray-600 hover:text-black hover:bg-gray-200"
            }`}
            title="Select tool"
          >
            <MousePointer className="w-4 h-4" />
            <span>Select</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTool("edit-text");
              setActiveEmbeddedImgId(null);
              setActiveImageId(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "edit-text" ? "bg-[#E5322D] text-white shadow-sm" : "text-gray-600 hover:text-black hover:bg-gray-200"
            }`}
            title="Click any text on the page to edit in place"
          >
            <Sparkles className="w-4 h-4" />
            <span>Edit Text</span>
            {textList.filter(t => t.page === currentPage).length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
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
              activeTool === "add-text" ? "bg-[#E5322D] text-white shadow-sm" : "text-gray-600 hover:text-black hover:bg-gray-200"
            }`}
            title="Click anywhere to add a new text box"
          >
            <Type className="w-4 h-4" />
            <span>Add Text</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSignatureModal(true)}
            className="px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
            title="Draw or type signature"
          >
            <FileSignature className="w-4 h-4" />
            <span>Sign</span>
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 text-gray-700 hover:bg-gray-200 transition-all cursor-pointer"
            title="Add image"
          >
            <ImageIcon className="w-4 h-4 text-amber-600" />
            <span>Image</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("whiteout")}
            className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "whiteout" ? "bg-[#E5322D] text-white shadow-sm" : "text-gray-600 hover:text-black hover:bg-gray-200"
            }`}
            title="Drag to erase/whiteout content"
          >
            <Eraser className="w-4 h-4" />
            <span>Whiteout</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("shape")}
            className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "shape" ? "bg-[#E5322D] text-white shadow-sm" : "text-gray-600 hover:text-black hover:bg-gray-200"
            }`}
            title="Draw shapes"
          >
            <Square className="w-4 h-4" />
            <span>Shapes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("draw")}
            className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "draw" ? "bg-[#E5322D] text-white shadow-sm" : "text-gray-600 hover:text-black hover:bg-gray-200"
            }`}
            title="Pen"
          >
            <PenLine className="w-4 h-4" />
            <span>Pen</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTool("highlight")}
            className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "highlight" ? "bg-[#E5322D] text-white shadow-sm" : "text-gray-600 hover:text-black hover:bg-gray-200"
            }`}
            title="Highlighter"
          >
            <Highlighter className="w-4 h-4 text-amber-500" />
            <span>Highlight</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFindReplace(prev => !prev)}
            className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              showFindReplace ? "bg-purple-600 text-white shadow-sm" : "text-gray-600 hover:text-black hover:bg-gray-200"
            }`}
            title="Find & Replace text"
          >
            <Search className="w-4 h-4 text-purple-600" />
            <span>Find & Replace</span>
          </button>
        </div>

        {/* Shape Sub-selector */}
        {activeTool === "shape" && (
          <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-xl border border-amber-200 text-xs">
            <span className="text-amber-800 font-bold">Shape:</span>
            <button
              type="button"
              onClick={() => setSelectedShapeType("rectangle")}
              className={`p-1 rounded cursor-pointer ${selectedShapeType === "rectangle" ? "bg-amber-600 text-white" : "text-gray-700 hover:bg-amber-100"}`}
              title="Rectangle"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedShapeType("circle")}
              className={`p-1 rounded cursor-pointer ${selectedShapeType === "circle" ? "bg-amber-600 text-white" : "text-gray-700 hover:bg-amber-100"}`}
              title="Circle"
            >
              <Circle className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedShapeType("line")}
              className={`p-1 rounded cursor-pointer ${selectedShapeType === "line" ? "bg-amber-600 text-white" : "text-gray-700 hover:bg-amber-100"}`}
              title="Line"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedShapeType("arrow")}
              className={`p-1 rounded cursor-pointer ${selectedShapeType === "arrow" ? "bg-amber-600 text-white" : "text-gray-700 hover:bg-amber-100"}`}
              title="Arrow"
            >
              <MoveUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Center/Right: Navigation, Zoom & Save */}
        <div className="flex items-center gap-2">
          {/* Toggle Thumbnails Sidebar */}
          {totalPages > 0 && (
            <button
              type="button"
              onClick={() => setShowThumbnailsSidebar(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                showThumbnailsSidebar ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
              title="Toggle Pages Sidebar"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Pages ({totalPages})</span>
            </button>
          )}

          {totalPages > 1 && (
            <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  setActiveTextId(null);
                }}
                className="p-1 hover:bg-white rounded disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                  setActiveTextId(null);
                }}
                className="p-1 hover:bg-white rounded disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Rotate Page */}
          <button
            type="button"
            onClick={handleRotatePage}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 text-gray-600 cursor-pointer"
            title="Rotate Page 90° Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.6, z - 0.2))}
              className="p-1 hover:bg-white rounded text-gray-600 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-gray-600 min-w-[2.5rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(2.2, z + 0.2))}
              className="p-1 hover:bg-white rounded text-gray-600 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-1.5 hover:bg-white rounded text-gray-600 disabled:opacity-30 cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1.5 hover:bg-white rounded text-gray-600 disabled:opacity-30 cursor-pointer"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Save Action */}
          <button
            type="button"
            onClick={handleSaveAndProcess}
            disabled={isSaving}
            className="cursor-pointer bg-[#E5322D] hover:bg-[#CC2A26] text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md flex items-center gap-2 active:scale-95 transition-all disabled:opacity-75"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{isSignTool ? "Sign & Download PDF" : "Save & Download PDF"}</span>
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

      {/* ========================================================================= */}
      {/* STUDIO LAYOUT: Left Page Thumbnails Sidebar + Main Document Canvas        */}
      {/* ========================================================================= */}
      <div className="w-full flex items-start gap-3 justify-center">
        {/* Left Thumbnails Sidebar */}
        {showThumbnailsSidebar && totalPages > 0 && (
          <div className="w-48 shrink-0 bg-white border border-gray-200 rounded-3xl p-3 shadow-md flex flex-col gap-2.5 sticky top-20 max-h-[78vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> Pages ({totalPages})
              </span>
              <button
                type="button"
                onClick={() => setShowThumbnailsSidebar(false)}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-black cursor-pointer"
                title="Hide Thumbnails Sidebar"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List of Pages */}
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pNum => {
                const isActive = currentPage === pNum;
                const thumbUrl = pageThumbnails[pNum];
                const stats = pageStats[pNum];

                return (
                  <div
                    key={pNum}
                    onClick={() => {
                      setCurrentPage(pNum);
                      setActiveTextId(null);
                      setActiveImageId(null);
                      setActiveEmbeddedImgId(null);
                    }}
                    className={`group relative rounded-xl p-1.5 border-2 transition-all cursor-pointer ${
                      isActive
                        ? "border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-100"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="w-full aspect-[1/1.3] bg-white rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center shadow-xs">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={`Page ${pNum}`} className="w-full h-full object-contain pointer-events-none" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 gap-1 text-[10px]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                          <span>Scanning...</span>
                        </div>
                      )}
                    </div>

                    {/* Page Number & Stats */}
                    <div className="flex items-center justify-between mt-1 px-1">
                      <span className={`text-[11px] font-bold ${isActive ? "text-blue-700" : "text-gray-700"}`}>
                        Page {pNum}
                      </span>
                      {stats && (
                        <span className="text-[9px] font-medium text-gray-400">
                          {stats.texts}T • {stats.images}Img
                        </span>
                      )}
                    </div>

                    {/* Action Button on Hover: Rotate Page */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPageRotations(prev => ({
                          ...prev,
                          [pNum]: ((prev[pNum] || 0) + 90) % 360
                        }));
                      }}
                      className="absolute top-2 right-2 p-1 bg-white/90 hover:bg-white text-gray-700 rounded-md shadow-sm border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Rotate Page 90° Clockwise"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Re-open sidebar button if closed */}
        {!showThumbnailsSidebar && totalPages > 0 && (
          <button
            type="button"
            onClick={() => setShowThumbnailsSidebar(true)}
            className="p-2.5 bg-white border border-gray-200 rounded-2xl shadow-md text-gray-600 hover:text-blue-600 hover:bg-gray-50 sticky top-20 cursor-pointer"
            title="Show Pages Sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* Main Document Canvas Container */}
        <div className="flex-1 min-w-0 flex justify-center">
          <div
            ref={containerRef}
        onClick={handleCanvasClick}
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
        className={`relative bg-gray-200/80 p-6 rounded-3xl border-2 transition-colors ${
          isDragOverCanvas ? "border-dashed border-blue-500 bg-blue-50/70" : "border-transparent"
        } shadow-inner overflow-auto max-w-full max-h-[78vh] flex justify-center items-start`}
      >
        {!isPdfJsLoaded || !pdfDoc ? (
          <div className="flex flex-col items-center justify-center p-20 text-gray-500 gap-3">
            <Loader2 className="w-8 h-8 text-[#E5322D] animate-spin" />
            <p className="font-semibold text-sm">Loading PDF into professional editor...</p>
          </div>
        ) : (
          <div className="relative shadow-2xl rounded-sm bg-white overflow-hidden select-none">
            {/* 1. Base PDF Rendered Canvas */}
            <canvas ref={pdfCanvasRef} className="block" />

            {/* 2. Whiteout Overlays */}
            {whiteouts
              .filter(wo => wo.page === currentPage)
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
                        const canvas = pdfCanvasRef.current;
                        if (canvas) {
                          const rect = canvas.getBoundingClientRect();
                          setDragOffset({ x: e.clientX - rect.left - wo.x, y: e.clientY - rect.top - wo.y });
                        }
                      }
                    }}
                    style={{
                      left: `${wo.x}px`,
                      top: `${wo.y}px`,
                      width: `${wo.width}px`,
                      height: `${wo.height}px`,
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
            {currentDragRect && (
              <div
                style={{
                  left: `${currentDragRect.x}px`,
                  top: `${currentDragRect.y}px`,
                  width: `${currentDragRect.width}px`,
                  height: `${currentDragRect.height}px`,
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
              .filter(s => s.page === currentPage)
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
                        const canvas = pdfCanvasRef.current;
                        if (canvas) {
                          const rect = canvas.getBoundingClientRect();
                          setDragOffset({ x: e.clientX - rect.left - shp.x, y: e.clientY - rect.top - shp.y });
                        }
                      }
                    }}
                    style={{
                      left: `${shp.x}px`,
                      top: `${shp.y}px`,
                      width: `${shp.width}px`,
                      height: `${shp.height}px`,
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
                          borderWidth: `${shp.strokeWidth}px`,
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
                          borderWidth: `${shp.strokeWidth}px`,
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
                          y1={shp.height}
                          x2={shp.width}
                          y2="0"
                          stroke={shp.strokeColor}
                          strokeWidth={shp.strokeWidth}
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
              ref={drawCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`absolute inset-0 ${
                activeTool === "draw" || activeTool === "highlight" || activeTool === "whiteout" || activeTool === "shape"
                  ? "cursor-crosshair z-25 pointer-events-auto"
                  : "pointer-events-none z-10"
              }`}
            />

            {/* 5. Image & Signature Annotations */}
            {images
              .filter(img => img.page === currentPage)
              .map(img => {
                const isActive = activeImageId === img.id;
                return (
                  <div
                    key={img.id}
                    style={{
                      left: `${img.x}px`,
                      top: `${img.y}px`,
                      width: `${img.width}px`,
                      height: `${img.height}px`,
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
                      const canvas = pdfCanvasRef.current;
                      if (canvas) {
                        const rect = canvas.getBoundingClientRect();
                        setDragOffset({ x: e.clientX - rect.left - img.x, y: e.clientY - rect.top - img.y });
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

            {/* 5b. PDF Embedded Images (Photos, Logos, Stamps extracted from document) */}
            {embeddedImages
              .filter(emb => emb.page === currentPage)
              .map(emb => {
                const isActive = activeEmbeddedImgId === emb.id;

                if (emb.isDeleted) {
                  // Whiteout original deleted image area
                  return (
                    <div
                      key={emb.id}
                      style={{
                        left: `${emb.x}px`,
                        top: `${emb.y}px`,
                        width: `${emb.width}px`,
                        height: `${emb.height}px`,
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
                      left: `${emb.x}px`,
                      top: `${emb.y}px`,
                      width: `${emb.width}px`,
                      height: `${emb.height}px`,
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
                        const canvas = pdfCanvasRef.current;
                        if (canvas) {
                          const rect = canvas.getBoundingClientRect();
                          setDragOffset({ x: e.clientX - rect.left - emb.x, y: e.clientY - rect.top - emb.y });
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
                    {/* If replaced with a new photo, show the new photo over the canvas */}
                    {emb.replacementDataUrl && (
                      <img
                        src={emb.replacementDataUrl}
                        alt="Replaced PDF Image"
                        draggable={false}
                        className="w-full h-full object-contain pointer-events-none bg-white"
                      />
                    )}

                    {/* Badge tag on hover - only in select tool */}
                    {activeTool === "select" && (
                      <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {emb.replacementDataUrl ? "Replaced Image" : "PDF Image"}
                      </span>
                    )}

                    {/* Mini Floating Action Toolbar when clicked/active */}
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
                        {/* Replace Image button */}
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

                        {/* Delete Image button */}
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

                        {/* Done button */}
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

                    {/* Resize handle when active */}
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

            {/* ========================================================================= */}
            {/* 6. INLINE TEXT EDITING: Pixel-Perfect In-Place Document Editing            */}
            {/* ========================================================================= */}
            {textList
              .filter(t => t.page === currentPage)
              .map(item => {
                const isSelected = activeTextId === item.id;
                const isModified = item.isOriginal && (
                  item.whiteoutOriginal ||
                  item.currentText !== item.originalText
                );

                const itemWidthPx = Math.max(item.width, 24);
                const itemHeightPx = Math.max(item.height, 13);

                // Determine width: Box NEVER arbitrarily expands across the page!
                // It stays at exact original line width unless user explicitly typed extra characters.
                const origLen = (item.originalText || "").trim().length;
                const currLen = (item.currentText || "").trim().length;
                const charRatio = origLen > 0 ? (currLen / origLen) : 1;

                const canvasW = pdfCanvasRef.current ? (parseFloat(pdfCanvasRef.current.style.width) || pdfCanvasRef.current.width) : 1000;
                const maxAllowedW = Math.max(itemWidthPx, canvasW - item.x - 15);

                const boxWidthPx = isSelected
                  ? Math.min(Math.max(itemWidthPx + 16, 60), maxAllowedW)
                  : (isModified && charRatio > 1.05)
                  ? Math.min(Math.round(itemWidthPx * charRatio), maxAllowedW)
                  : itemWidthPx;

                return (
                  <div
                    key={item.id}
                    style={{
                      left: `${item.x}px`,
                      top: `${item.y}px`,
                      width: `${boxWidthPx}px`,
                      height: `${itemHeightPx}px`,
                      zIndex: isSelected ? 50 : isModified ? 35 : 25,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTextId(item.id);
                      if (item.isScrambled || isScrambledText(item.currentText) || isScrambledText(item.originalText)) {
                        handleAutoFixText(item);
                      }
                    }}
                    className={`absolute ${
                      isSelected
                        ? "z-50 ring-2 ring-blue-600 ring-offset-0 rounded-[2px] shadow-sm"
                        : activeTool === "edit-text"
                        ? "hover:ring-1 hover:ring-blue-500/50 hover:bg-blue-500/[0.04] cursor-text rounded-[2px] transition-all"
                        : "cursor-pointer rounded-[1px]"
                    }`}
                  >
                    {isSelected ? (
                      /* ACTIVE INLINE EDITING */
                      <div className="relative w-full h-full">
                        {/* Corner edit handles for professional look */}
                        <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-600 border border-white rounded-[1px] pointer-events-none z-60" />
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 border border-white rounded-[1px] pointer-events-none z-60" />
                        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-600 border border-white rounded-[1px] pointer-events-none z-60" />
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-600 border border-white rounded-[1px] pointer-events-none z-60" />

                        {/* Professional Floating Toolbar positioned directly above the text line */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: "calc(100% + 8px)",
                            left: "50%",
                            transform: "translateX(-50%)",
                            zIndex: 100,
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-2xl rounded-2xl px-3 py-1.5 flex items-center gap-2 text-xs text-gray-800 animate-in fade-in zoom-in-95 duration-150 select-none whitespace-nowrap"
                        >
                          {/* Font Family selector */}
                          <select
                            value={item.fontFamily}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              takeSnapshot();
                              setTextList(prev => prev.map(t => t.id === item.id ? { ...t, fontFamily: val } : t));
                            }}
                            className="bg-gray-100 hover:bg-gray-200/70 border border-gray-200 text-xs font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer text-gray-700 transition-colors"
                          >
                            <option value="Helvetica">Arial / Helvetica</option>
                            <option value="TimesRoman">Times New Roman</option>
                            <option value="Courier">Courier New</option>
                          </select>

                          {/* Font Size Stepper */}
                          <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-lg">
                            <button
                              type="button"
                              onClick={() => {
                                takeSnapshot();
                                setTextList(prev => prev.map(t => t.id === item.id ? { ...t, fontSize: Math.max(6, Math.round(t.fontSize) - 1) } : t));
                              }}
                              className="w-5 h-5 hover:bg-white hover:shadow-xs rounded-md font-bold text-xs flex items-center justify-center cursor-pointer text-gray-600 transition-all"
                              title="Smaller"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-gray-800 min-w-[1.4rem] text-center">{Math.round(item.fontSize)}</span>
                            <button
                              type="button"
                              onClick={() => {
                                takeSnapshot();
                                setTextList(prev => prev.map(t => t.id === item.id ? { ...t, fontSize: Math.min(96, Math.round(t.fontSize) + 1) } : t));
                              }}
                              className="w-5 h-5 hover:bg-white hover:shadow-xs rounded-md font-bold text-xs flex items-center justify-center cursor-pointer text-gray-600 transition-all"
                              title="Larger"
                            >
                              +
                            </button>
                          </div>

                          {/* Bold & Italic */}
                          <div className="flex items-center gap-0.5 bg-gray-100 border border-gray-200 p-0.5 rounded-lg">
                            <button
                              type="button"
                              onClick={() => {
                                takeSnapshot();
                                setTextList(prev => prev.map(t => t.id === item.id ? { ...t, isBold: !t.isBold } : t));
                              }}
                              className={`w-6 h-6 rounded-md font-bold text-xs cursor-pointer flex items-center justify-center transition-all ${
                                item.isBold ? "bg-blue-600 text-white shadow-xs" : "hover:bg-white text-gray-700"
                              }`}
                              title="Bold"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                takeSnapshot();
                                setTextList(prev => prev.map(t => t.id === item.id ? { ...t, isItalic: !t.isItalic } : t));
                              }}
                              className={`w-6 h-6 rounded-md font-bold text-xs italic cursor-pointer flex items-center justify-center transition-all ${
                                item.isItalic ? "bg-blue-600 text-white shadow-xs" : "hover:bg-white text-gray-700"
                              }`}
                              title="Italic"
                            >
                              I
                            </button>
                          </div>

                          {/* Color Palette */}
                          <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2" title="Text Color">
                            {[
                              { name: "Black", value: "#000000" },
                              { name: "White", value: "#ffffff" },
                              { name: "Blue", value: "#2563EB" },
                              { name: "Red", value: "#E5322D" },
                            ].map(c => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => {
                                  takeSnapshot();
                                  setTextList(prev => prev.map(t => t.id === item.id ? { ...t, color: c.value } : t));
                                }}
                                className={`w-4 h-4 rounded-full border border-gray-300 cursor-pointer transition-transform ${
                                  item.color.toLowerCase() === c.value.toLowerCase() ? "ring-2 ring-blue-500 scale-125 shadow-xs" : "hover:scale-110"
                                }`}
                                style={{ backgroundColor: c.value }}
                                title={c.name}
                              />
                            ))}
                            {/* Auto-detected color swatch */}
                            {item.color && !["#000000", "#ffffff", "#2563eb", "#e5322d"].includes(item.color.toLowerCase()) && (
                              <button
                                type="button"
                                className="w-4 h-4 rounded-full border border-gray-400 cursor-pointer ring-2 ring-blue-500 scale-125 shadow-xs"
                                style={{ backgroundColor: item.color }}
                                title={`Original Text Color (${item.color})`}
                              />
                            )}
                          </div>

                          {/* Real Text (OCR) Button */}
                          <button
                            type="button"
                            onClick={() => handleAutoFixText(item)}
                            disabled={ocrLoadingId === item.id}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all border ml-1 ${
                              ocrLoadingId === item.id
                                ? "bg-purple-100 border-purple-300 text-purple-700 animate-pulse"
                                : (item.isScrambled || isScrambledText(item.currentText))
                                ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-700 shadow-sm"
                                : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                            }`}
                            title="Read visual text directly from PDF canvas"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>{ocrLoadingId === item.id ? "Reading..." : "Real Text (OCR)"}</span>
                          </button>

                          {/* Delete / Clear */}
                          <button
                            type="button"
                            onClick={() => {
                              takeSnapshot();
                              if (item.isOriginal) {
                                setTextList(prev => prev.map(t => t.id === item.id ? { ...t, currentText: "", whiteoutOriginal: true } : t));
                              } else {
                                setTextList(prev => prev.filter(t => t.id !== item.id));
                              }
                              setActiveTextId(null);
                            }}
                            className="p-1 hover:bg-red-50 text-red-600 rounded-lg cursor-pointer ml-0.5 transition-colors"
                            title="Delete text"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {/* Done button */}
                          <button
                            type="button"
                            onClick={() => setActiveTextId(null)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ml-1 active:scale-95 transition-all shadow-sm"
                            title="Apply changes (Enter)"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Done</span>
                          </button>
                        </div>

                        {/* Inline Edit Input — Seamlessly covers original with exact background and styling */}
                        <input
                          type="text"
                          value={ocrLoadingId === item.id && (item.isScrambled || isScrambledText(item.currentText)) ? "" : item.currentText}
                          placeholder={ocrLoadingId === item.id ? "✨ Reading real text from PDF..." : "Type text..."}
                          autoFocus
                          onFocus={(e) => {
                            const len = e.currentTarget.value.length;
                            e.currentTarget.setSelectionRange(len, len);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setActiveTextId(null);
                            }
                            if (e.key === "Escape") {
                              setActiveTextId(null);
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTextList(prev =>
                              prev.map(t => (t.id === item.id ? { ...t, currentText: val, whiteoutOriginal: true, isScrambled: false } : t))
                            );
                          }}
                          style={{
                            color: item.color || "#000000",
                            fontSize: `${Math.max(9, Math.round(item.fontSize * zoom * 0.92))}px`,
                            lineHeight: `${itemHeightPx}px`,
                            fontFamily: item.fontFamily === "Helvetica"
                              ? 'Arial, Helvetica, sans-serif'
                              : item.fontFamily === "TimesRoman"
                              ? '"Times New Roman", Times, Georgia, serif'
                              : '"Courier New", Courier, monospace',
                            fontWeight: item.isBold ? 700 : 400,
                            fontStyle: item.isItalic ? "italic" : "normal",
                            textAlign: item.align || "left",
                            backgroundColor: item.bgColor || "#ffffff",
                            height: "100%",
                            width: "100%",
                            padding: "0 2px",
                            margin: 0,
                            letterSpacing: "-0.01em",
                          }}
                          className="outline-none border-0 rounded-[1px] px-0.5 py-0 m-0 box-border block leading-none select-text"
                        />
                      </div>
                    ) : isModified ? (
                      /* MODIFIED TEXT — show edited text cleanly with matching bg + text color (covers canvas original) */
                      <div
                        style={{
                          color: item.color || "#000000",
                          fontSize: `${Math.max(9, Math.round(item.fontSize * zoom * 0.92))}px`,
                          lineHeight: `${itemHeightPx}px`,
                          fontFamily: item.fontFamily === "Helvetica"
                            ? 'Arial, Helvetica, sans-serif'
                            : item.fontFamily === "TimesRoman"
                            ? '"Times New Roman", Times, Georgia, serif'
                            : '"Courier New", Courier, monospace',
                          fontWeight: item.isBold ? 700 : 400,
                          fontStyle: item.isItalic ? "italic" : "normal",
                          textAlign: item.align || "left",
                          backgroundColor: item.bgColor || "#ffffff",
                          letterSpacing: "-0.01em",
                        }}
                        className="w-full h-full px-0.5 whitespace-nowrap cursor-text select-none flex items-center rounded-[1px]"
                        title="Click to edit"
                      >
                        {item.currentText || <span className="text-gray-300 italic">(empty)</span>}
                      </div>
                    ) : !item.isOriginal ? (
                      /* NEWLY ADDED TEXT */
                      <div
                        style={{
                          color: item.color || selectedColor || "#000000",
                          fontSize: `${item.fontSize * zoom}px`,
                          lineHeight: `${itemHeightPx}px`,
                          fontFamily: item.fontFamily === "Helvetica" ? "sans-serif" : item.fontFamily === "TimesRoman" ? "serif" : "monospace",
                          fontWeight: item.isBold ? 700 : 400,
                          fontStyle: item.isItalic ? "italic" : "normal",
                          textAlign: item.align || "left",
                          backgroundColor: item.bgColor || "transparent",
                        }}
                        className="px-0.5 rounded-[1px] border border-dashed border-blue-400 select-none whitespace-nowrap cursor-text"
                        title="Click to edit"
                      >
                        {item.currentText}
                      </div>
                    ) : (
                      /* ORIGINAL UNMODIFIED TEXT — iLovePDF style: invisible hit area, subtle highlight on hover */
                      <div
                        className="w-full h-full cursor-text rounded-[1px] hover:bg-blue-500/[0.06]"
                        title="Click to edit"
                      />
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
        </div>
      </div>

      {/* Footer Info / Tips */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-gray-500">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-red-500" />
          Click on any word or line to edit directly in-place.
        </span>
        <span>•</span>
        <span className="flex items-center gap-1.5">
          <FileSignature className="w-4 h-4 text-blue-600" />
          Use <strong>Sign</strong> to draw or type an official signature.
        </span>
        <span>•</span>
        <span>Press <strong>Enter</strong> or click <strong>Done</strong> to save text.</span>
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
