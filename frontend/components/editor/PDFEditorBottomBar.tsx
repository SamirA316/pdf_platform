"use client";

import React, { useState, useEffect } from "react";
import { useEditor } from "@/lib/editor/EditorContext";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
} from "lucide-react";

export function PDFEditorBottomBar() {
  const {
    numPages,
    currentPageIndex,
    scrollToPage,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setFitMode,
    fitMode,
    viewportRotation,
    rotateViewClockwise,
    rotateViewCounterClockwise,
    resetViewRotation,
  } = useEditor();

  const [prevPageIndex, setPrevPageIndex] = useState<number>(currentPageIndex);
  const [inputPage, setInputPage] = useState<string>(String(currentPageIndex + 1));

  // Synchronize input value with currentPageIndex updates
  if (prevPageIndex !== currentPageIndex) {
    setPrevPageIndex(currentPageIndex);
    setInputPage(String(currentPageIndex + 1));
  }

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      scrollToPage(currentPageIndex - 1, "smooth");
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < numPages - 1) {
      scrollToPage(currentPageIndex + 1, "smooth");
    }
  };

  const submitPageJump = () => {
    const trimmed = inputPage.trim();
    if (!/^\d+$/.test(trimmed)) {
      setInputPage(String(currentPageIndex + 1));
      return;
    }
    const pageNum = Number(trimmed);
    if (isNaN(pageNum) || pageNum < 1) {
      setInputPage(String(currentPageIndex + 1));
      return;
    }
    const clamped = Math.max(1, Math.min(numPages, pageNum));
    setInputPage(String(clamped));
    scrollToPage(clamped - 1, "smooth");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      submitPageJump();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <footer className="h-10 border-t border-border bg-card/80 backdrop-blur-md px-4 flex items-center justify-between z-20 select-none text-xs text-muted-foreground">
      {/* Left: Page Navigation with Direct Jump Input */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={handlePrevPage}
          disabled={currentPageIndex <= 0}
          className="p-1 rounded hover:bg-muted text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Previous Page (PageUp)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 px-1">
          <span className="text-muted-foreground">Page</span>
          <input
            type="text"
            inputMode="numeric"
            value={inputPage}
            onChange={(e) => setInputPage(e.target.value)}
            onBlur={submitPageJump}
            onKeyDown={handleKeyDown}
            className="w-10 text-center font-semibold text-foreground bg-background border border-border/80 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            title="Type page number and press Enter"
          />
          <span className="text-muted-foreground">of {numPages || 1}</span>
        </div>

        <button
          onClick={handleNextPage}
          disabled={currentPageIndex >= numPages - 1}
          className="p-1 rounded hover:bg-muted text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Next Page (PageDown)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Rotate View, Fit Modes & Zoom */}
      <div className="flex items-center gap-2">
        {/* Rotate View Controls */}
        <div className="flex items-center gap-0.5 border-r border-border/80 pr-2">
          <button
            onClick={rotateViewCounterClockwise}
            className="p-1 rounded hover:bg-muted text-foreground transition-colors"
            title="Rotate View 90° Counter-Clockwise"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {viewportRotation !== 0 && (
            <button
              onClick={resetViewRotation}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
              title="Reset View Rotation to 0°"
            >
              {viewportRotation}°
            </button>
          )}
          <button
            onClick={rotateViewClockwise}
            className="p-1 rounded hover:bg-muted text-foreground transition-colors"
            title="Rotate View 90° Clockwise (Shift+R)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Fit Modes */}
        <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-md border border-border/50">
          <button
            onClick={() => setFitMode("width")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              fitMode === "width"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Fit to Width"
          >
            Fit Width
          </button>
          <button
            onClick={() => setFitMode("page")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              fitMode === "page"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Fit to Page"
          >
            Fit Page
          </button>
        </div>

        {/* Zoom Stepper & Select Dropdown */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="p-1 rounded hover:bg-muted text-foreground transition-colors"
            title="Zoom Out (Cmd/Ctrl -)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <select
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="bg-background border border-border/80 rounded px-1.5 py-0.5 text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            title="Select Zoom Preset"
          >
            <option value={0.25}>25%</option>
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1.0}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={2.0}>200%</option>
            <option value={3.0}>300%</option>
            <option value={4.0}>400%</option>
            {![0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0].includes(zoom) && (
              <option value={zoom}>{Math.round(zoom * 100)}%</option>
            )}
          </select>

          <button
            onClick={zoomIn}
            className="p-1 rounded hover:bg-muted text-foreground transition-colors"
            title="Zoom In (Cmd/Ctrl +)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
