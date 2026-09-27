"use client";

import React, { useRef, useEffect, useState } from "react";
import { useEditor } from "@/lib/editor/EditorContext";
import { renderPageThumbnail } from "@/lib/editor/pdf/pdfRenderer";
import { PanelLeftClose, PanelLeftOpen, Loader2 } from "lucide-react";

interface IPDFEditorThumbnailsProps {
  isOpen: boolean;
  onToggle: () => void;
}

function ThumbnailPageItem({
  pageIndex,
  aspectRatio,
}: {
  pageIndex: number;
  aspectRatio: number;
}) {
  const { pdfDocument } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pdfDocument) return;

    const handle = renderPageThumbnail(pdfDocument, pageIndex, canvas, {
      targetWidth: 112,
    });

    handle.promise
      .then(() => setIsRendered(true))
      .catch((err) => {
        // Silently handled if cancelled
        if (err?.name !== "RenderingCancelledException") {
          console.warn(`[Thumbnail] Page ${pageIndex + 1} render failed:`, err);
        }
      });

    return () => {
      handle.cancel();
    };
  }, [pdfDocument, pageIndex]);

  return (
    <div
      style={{ aspectRatio: `${aspectRatio}` }}
      className="w-28 rounded-md border border-border/80 bg-background shadow-xs flex flex-col items-center justify-center relative overflow-hidden"
    >
      <canvas ref={canvasRef} className="block w-full h-full object-contain pointer-events-none" />
      {!isRendered && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/60 text-muted-foreground gap-1">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-[9px]">P. {pageIndex + 1}</span>
        </div>
      )}
    </div>
  );
}

export function PDFEditorThumbnails({ isOpen, onToggle }: IPDFEditorThumbnailsProps) {
  const { pageDimensions, currentPageIndex, scrollToPage } = useEditor();

  // Auto-scroll active thumbnail into view when currentPageIndex changes
  useEffect(() => {
    if (!isOpen) return;
    const el = document.getElementById(`thumbnail-page-${currentPageIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentPageIndex, isOpen]);

  if (!isOpen) {
    return (
      <div className="border-r border-border bg-card/40 p-2 flex flex-col items-center">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Open Page Thumbnails"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-48 border-r border-border bg-card/40 backdrop-blur-md flex flex-col select-none z-10">
      <div className="h-10 px-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Pages ({pageDimensions.length})
        </span>
        <button
          onClick={onToggle}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Collapse Thumbnails"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {pageDimensions.map((page, index) => {
          const isSelected = currentPageIndex === index;
          const aspectRatio = page.width && page.height ? page.width / page.height : 0.707;

          return (
            <button
              key={index}
              id={`thumbnail-page-${index}`}
              onClick={() => scrollToPage(index, "smooth")}
              className={`w-full flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-left group ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary ring-offset-1 ring-offset-background"
                  : "border-border/60 hover:border-border hover:bg-muted/50"
              }`}
            >
              {/* Actual PDF Thumbnail Canvas */}
              <ThumbnailPageItem pageIndex={index} aspectRatio={aspectRatio} />
              <span
                className={`text-[11px] font-medium ${
                  isSelected ? "text-primary font-bold" : "text-muted-foreground"
                }`}
              >
                Page {index + 1}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
