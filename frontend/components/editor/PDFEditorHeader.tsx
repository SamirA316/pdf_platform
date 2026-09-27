"use client";

import React from "react";
import { useEditor } from "@/lib/editor/EditorContext";
import {
  Undo2,
  Redo2,
  Download,
  Save,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
} from "lucide-react";
import Link from "next/link";

interface IPDFEditorHeaderProps {
  onSaveDraft?: () => void;
  onExportPdf?: () => void;
  isExporting?: boolean;
}

export function PDFEditorHeader({ onSaveDraft, onExportPdf, isExporting }: IPDFEditorHeaderProps) {
  const {
    fileName,
    canUndo,
    canRedo,
    undo,
    redo,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    isDirty,
  } = useEditor();

  const zoomPercent = Math.round(zoom * 100);

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Back Link & Document Name */}
      <div className="flex items-center gap-3">
        <Link
          href="/tools/edit-pdf"
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Back to Tools"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
            PDF
          </div>
          <div>
            <h1 className="text-sm font-semibold truncate max-w-[200px] sm:max-w-[320px] text-foreground">
              {fileName}
            </h1>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>PDF Editor</span>
              {isDirty && (
                <>
                  <span className="w-1 h-1 rounded-full bg-amber-500" />
                  <span className="text-amber-500 font-medium">Unsaved changes</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Center: Undo / Redo & Zoom Controls */}
      <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent transition-all"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent transition-all"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-border mx-1" />

        <button
          onClick={zoomOut}
          className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetZoom}
          className="px-2 py-1 text-xs font-semibold rounded-md hover:bg-background text-foreground transition-all min-w-[52px] text-center"
          title="Reset Zoom (100%)"
        >
          {zoomPercent}%
        </button>
        <button
          onClick={zoomIn}
          className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Save & Export Actions */}
      <div className="flex items-center gap-2">
        {onSaveDraft && (
          <button
            onClick={onSaveDraft}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-all"
          >
            <Save className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Save Draft</span>
          </button>
        )}
        <button
          onClick={onExportPdf}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? "Exporting..." : "Download PDF"}</span>
        </button>
      </div>
    </header>
  );
}
