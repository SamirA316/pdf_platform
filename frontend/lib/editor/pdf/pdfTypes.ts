/**
 * QuickPDF Platform - PDF Viewer & Rendering Type Definitions
 * Phase 5.2
 */

import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { IPageDimension } from "@/types/editor";

export type { PDFDocumentProxy, PDFPageProxy, RenderTask };

export type PdfErrorCode =
  | "INVALID_PDF"
  | "PDF_LOAD_FAILED"
  | "PASSWORD_REQUIRED"
  | "PASSWORD_INVALID"
  | "PAGE_RENDER_FAILED"
  | "NETWORK_ERROR";

export interface IPdfDocumentMetadata {
  numPages: number;
  fingerprint?: string;
  title?: string;
  pages: IPageDimension[];
}

export interface IPageRenderOptions {
  zoom: number;
  devicePixelRatio?: number;
  rotationDelta?: number; // Additional user rotation in degrees (0, 90, 180, 270)
}

export interface IRenderTaskHandle {
  promise: Promise<void>;
  cancel: () => void;
}

export interface IThumbnailRenderOptions {
  targetWidth?: number; // Target display width in CSS px (default 112)
  devicePixelRatio?: number;
}
