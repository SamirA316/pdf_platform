/**
 * QuickPDF Platform - PDF Document Loading & Metadata Service
 * Phase 5.2
 */

import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { IPageDimension } from "@/types/editor";
import { IPdfDocumentMetadata } from "./pdfTypes";

// Configure worker path on client
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
}

export interface ILoadPdfOptions {
  password?: string;
  onProgress?: (percent: number) => void;
}

/**
 * Loads a PDF document from raw bytes (ArrayBuffer/Uint8Array) or a URL stream.
 */
export async function loadPdfDocument(
  source: ArrayBuffer | Uint8Array | string,
  options: ILoadPdfOptions = {}
): Promise<PDFDocumentProxy> {
  const loadingParams: Record<string, unknown> = typeof source === "string" ? { url: source } : { data: source };

  if (options.password) {
    loadingParams.password = options.password;
  }

  // Disable font and canvas eval restrictions where possible
  loadingParams.cMapUrl = "/pdfjs/cmaps/";
  loadingParams.cMapPacked = true;

  const loadingTask = pdfjsLib.getDocument(loadingParams as any);

  if (options.onProgress) {
    loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
      if (progressData.total > 0) {
        const pct = Math.round((progressData.loaded / progressData.total) * 100);
        options.onProgress?.(pct);
      }
    };
  }

  try {
    const doc = await loadingTask.promise;
    return doc;
  } catch (err: unknown) {
    const pdfErr = err as { name?: string; message?: string };
    // Check for password requirement
    if (pdfErr.name === "PasswordException") {
      const error = new Error("Password required to decrypt PDF") as Error & { code?: string };
      error.code = "PASSWORD_REQUIRED";
      throw error;
    }
    if (pdfErr.name === "InvalidPDFException") {
      const error = new Error("The provided file is corrupted or not a valid PDF document") as Error & { code?: string };
      error.code = "INVALID_PDF";
      throw error;
    }
    throw err;
  }
}

/**
 * Iterates through all pages in the PDFDocumentProxy to extract actual dimensions and native rotations.
 */
export async function extractDocumentDimensions(
  doc: PDFDocumentProxy
): Promise<IPageDimension[]> {
  const numPages = doc.numPages;
  const dimensions: IPageDimension[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    // Get viewport at default scale 1.0 (72 DPI PDF standard points)
    const viewport = page.getViewport({ scale: 1.0 });

    dimensions.push({
      pageIndex: pageNum - 1, // 0-indexed for editor state
      width: Math.round(viewport.width * 100) / 100,
      height: Math.round(viewport.height * 100) / 100,
      rotation: page.rotate || 0,
    });
  }

  return dimensions;
}

/**
 * Retrieves full document metadata including title, page count, and page dimensions.
 */
export async function getDocumentMetadata(
  doc: PDFDocumentProxy
): Promise<IPdfDocumentMetadata> {
  const [pages, meta] = await Promise.all([
    extractDocumentDimensions(doc),
    doc.getMetadata().catch(() => ({ info: null })),
  ]);

  const info = meta?.info as Record<string, unknown> | undefined;
  const title = typeof info?.Title === "string" ? info.Title : undefined;

  return {
    numPages: doc.numPages,
    fingerprint: doc.fingerprints?.[0] || undefined,
    title,
    pages,
  };
}

/**
 * Safely releases memory allocated by PDFDocumentProxy and its internal caches.
 */
export async function destroyPdfDocument(doc: PDFDocumentProxy | null): Promise<void> {
  if (!doc) return;
  try {
    await doc.destroy();
  } catch (err) {
    console.warn("[PDFService] Error while destroying PDFDocumentProxy:", err);
  }
}
