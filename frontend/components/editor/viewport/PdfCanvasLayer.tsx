"use client";

import React, { useRef, useEffect, useState } from "react";
import { useEditor } from "@/lib/editor/EditorContext";
import { renderPageToCanvas } from "@/lib/editor/pdf/pdfRenderer";
import { Loader2 } from "lucide-react";

interface IPdfCanvasLayerProps {
  pageIndex: number;
  rotationDelta?: number;
}

export function PdfCanvasLayer({ pageIndex, rotationDelta = 0 }: IPdfCanvasLayerProps) {
  const { pdfDocument, zoom } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pdfDocument) return;

    setIsRendering(true);

    const handle = renderPageToCanvas(pdfDocument, pageIndex, canvas, {
      zoom,
      rotationDelta,
    });

    handle.promise
      .then(() => {
        setIsRendering(false);
      })
      .catch((err) => {
        console.error(`[PdfCanvasLayer] Failed to render page ${pageIndex + 1}:`, err);
        setIsRendering(false);
      });

    // Cleanup: cancel this render task if zoom or orientation changes before finishing
    return () => {
      handle.cancel();
    };
  }, [pdfDocument, pageIndex, zoom, rotationDelta]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="block w-full h-full pointer-events-none transition-opacity duration-150"
        style={{ opacity: isRendering ? 0.85 : 1 }}
      />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/20 pointer-events-none">
          <Loader2 className="w-5 h-5 text-primary/40 animate-spin" />
        </div>
      )}
    </div>
  );
}
