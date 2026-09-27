/**
 * QuickPDF Platform - High-DPI Canvas Rendering & Cancellation Engine
 * Phase 5.2
 */

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { IPageRenderOptions, IRenderTaskHandle, IThumbnailRenderOptions } from "./pdfTypes";

/**
 * Renders a specific PDF page onto a canvas with High-DPI scaling and active cancellation support.
 */
export function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  options: IPageRenderOptions
): IRenderTaskHandle {
  let activeRenderTask: RenderTask | null = null;
  let isCancelled = false;

  const promise = (async () => {
    // PDF.js pages are 1-indexed
    const pageNum = pageIndex + 1;
    const page = await doc.getPage(pageNum);

    if (isCancelled) return;

    const dpr =
      options.devicePixelRatio ||
      (typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 3) : 1);

    const totalRotation = (page.rotate + (options.rotationDelta || 0)) % 360;
    const scale = options.zoom * dpr;

    // Viewport scaled for High-DPI canvas buffer
    const viewport = page.getViewport({ scale, rotation: totalRotation });

    // Logical CSS display dimensions
    const displayWidth = Math.round(viewport.width / dpr);
    const displayHeight = Math.round(viewport.height / dpr);

    // Set internal canvas pixel buffer (Retina crispness)
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    // Set CSS display size
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("Unable to obtain 2D canvas rendering context");
    }

    // Render page
    activeRenderTask = page.render({
      canvasContext: ctx,
      viewport,
      intent: "display",
    });

    try {
      await activeRenderTask.promise;
    } catch (err: any) {
      // PDF.js throws when task is intentionally cancelled
      if (err?.name === "RenderingCancelledException") {
        // Silently handled: new render has preempted the cancelled one
        return;
      }
      throw err;
    }
  })();

  return {
    promise,
    cancel: () => {
      isCancelled = true;
      if (activeRenderTask) {
        try {
          activeRenderTask.cancel();
        } catch {
          // Ignore cancellation race conditions
        }
      }
    },
  };
}

/**
 * Renders a lightweight downscaled thumbnail of a page onto a thumbnail canvas.
 */
export function renderPageThumbnail(
  doc: PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  options: IThumbnailRenderOptions = {}
): IRenderTaskHandle {
  let activeRenderTask: RenderTask | null = null;
  let isCancelled = false;

  const targetWidth = options.targetWidth || 112; // Standard thumbnail width
  const dpr = options.devicePixelRatio || (typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1);

  const promise = (async () => {
    const pageNum = pageIndex + 1;
    const page = await doc.getPage(pageNum);

    if (isCancelled) return;

    // Get unscaled viewport to calculate target scale
    const baseViewport = page.getViewport({ scale: 1.0, rotation: page.rotate });
    const scale = (targetWidth / baseViewport.width) * dpr;
    const viewport = page.getViewport({ scale, rotation: page.rotate });

    const displayWidth = Math.round(viewport.width / dpr);
    const displayHeight = Math.round(viewport.height / dpr);

    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    activeRenderTask = page.render({
      canvasContext: ctx,
      viewport,
      intent: "display",
    });

    try {
      await activeRenderTask.promise;
    } catch (err: any) {
      if (err?.name === "RenderingCancelledException") {
        return;
      }
      throw err;
    }
  })();

  return {
    promise,
    cancel: () => {
      isCancelled = true;
      if (activeRenderTask) {
        try {
          activeRenderTask.cancel();
        } catch {
          // Ignore
        }
      }
    },
  };
}
