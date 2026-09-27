"use client";

import React, { useRef, useEffect } from "react";
import { useEditor } from "@/lib/editor/EditorContext";
import { PageContainer } from "./PageContainer";
import { calculateFitZoom } from "@/lib/editor/coordinates";
import { FileText, Loader2 } from "lucide-react";

export function EditorViewport() {
  const {
    pageDimensions,
    currentPageIndex,
    isDocumentLoaded,
    isLoading,
    loadingProgress,
    error,
    fitMode,
    zoom,
    setZoom,
    setCurrentPageIndex,
    isProgrammaticScroll,
    activeTool,
    isPanning,
    setIsPanning,
  } = useEditor();

  const viewportRef = useRef<HTMLDivElement>(null);
  const [isSpacePressed, setIsSpacePressed] = React.useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Detect whether hand/pan interaction is active
  const isPanActive = activeTool === "hand" || isSpacePressed;

  // Global Spacebar listener for temporary pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const target = e.target as HTMLElement | null;
        const isInput =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.isContentEditable;
        if (!isInput) {
          e.preventDefault();
          setIsSpacePressed(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setIsPanning(false);
        dragStartRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setIsPanning]);

  // Trackpad pinch / Ctrl+Wheel zoom listener
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.05 : 0.95;
        setZoom(zoom * factor);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [zoom, setZoom]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const isMiddleClick = e.button === 1;
    const isLeftClickPan = e.button === 0 && isPanActive;

    if (isMiddleClick || isLeftClickPan) {
      const container = viewportRef.current;
      if (!container) return;

      e.preventDefault();
      setIsPanning(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !viewportRef.current) return;
      e.preventDefault();

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      viewportRef.current.scrollLeft = dragStartRef.current.scrollLeft - dx;
      viewportRef.current.scrollTop = dragStartRef.current.scrollTop - dy;
    };

    const handleMouseUp = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null;
        setIsPanning(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setIsPanning]);

  // Auto-calculate zoom on resize if fitMode is active
  useEffect(() => {
    if (!viewportRef.current || pageDimensions.length === 0 || fitMode === "custom") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      const currentPage = pageDimensions[currentPageIndex] || pageDimensions[0];

      if (currentPage && width > 0 && height > 0) {
        const fitZoom = calculateFitZoom(
          currentPage.width,
          currentPage.height,
          width,
          height,
          fitMode
        );
        setZoom(fitZoom);
      }
    });

    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [pageDimensions, currentPageIndex, fitMode, setZoom]);

  // Track page visibility during manual scroll to synchronize currentPageIndex
  // Adheres strictly to Rules of Hooks (declared unconditionally before early returns)
  useEffect(() => {
    const container = viewportRef.current;
    if (
      !container ||
      pageDimensions.length === 0 ||
      isLoading ||
      error ||
      !isDocumentLoaded
    ) {
      return;
    }

    const visibilityMap = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScroll.current) return;

        for (const entry of entries) {
          const pageIdx = Number(entry.target.getAttribute("data-page-index"));
          if (!isNaN(pageIdx)) {
            visibilityMap.set(pageIdx, entry.intersectionRatio);
          }
        }

        let maxRatio = -1;
        let dominantPage = -1;

        visibilityMap.forEach((ratio, pageIdx) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            dominantPage = pageIdx;
          }
        });

        if (dominantPage !== -1 && maxRatio > 0.2) {
          setCurrentPageIndex(dominantPage);
        }
      },
      {
        root: container,
        threshold: [0.1, 0.3, 0.5, 0.7, 0.9],
      }
    );

    const pageElements = container.querySelectorAll("[data-page-index]");
    pageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [
    pageDimensions,
    isLoading,
    error,
    isDocumentLoaded,
    setCurrentPageIndex,
    isProgrammaticScroll,
  ]);

  if (isLoading) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-muted/30 select-none p-6">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
        <p className="text-sm font-medium text-foreground">Loading PDF Document...</p>
        <p className="text-xs text-muted-foreground mt-1">Preparing high-resolution vector canvas</p>
        {loadingProgress > 0 && (
          <div className="w-52 flex flex-col items-center gap-1.5 mt-4">
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden border border-border/60">
              <div
                className="h-full bg-primary transition-all duration-150 rounded-full"
                style={{ width: `${Math.max(5, loadingProgress)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              {loadingProgress}%
            </span>
          </div>
        )}
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-muted/30 select-none p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">Could not load document</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{error}</p>
      </main>
    );
  }

  if (!isDocumentLoaded || pageDimensions.length === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-muted/30 select-none p-6 text-center">
        <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-foreground">No Document Loaded</p>
        <p className="text-xs text-muted-foreground mt-1">
          Open a PDF file to begin interactive editing
        </p>
      </main>
    );
  }

  return (
    <main
      ref={viewportRef}
      onMouseDown={handleMouseDown}
      className={`flex-1 overflow-auto bg-muted/40 p-8 flex flex-col items-center gap-8 relative select-none ${
        isPanning
          ? "cursor-grabbing"
          : isPanActive
          ? "cursor-grab"
          : "cursor-default"
      }`}
    >
      {pageDimensions.map((page) => (
        <div
          key={page.pageIndex}
          id={`editor-page-${page.pageIndex}`}
          data-page-index={page.pageIndex}
          className={`scroll-mt-6 transition-transform duration-200 ${
            isPanActive || isPanning ? "pointer-events-none" : ""
          }`}
        >
          <PageContainer page={page} />
        </div>
      ))}
    </main>
  );
}
