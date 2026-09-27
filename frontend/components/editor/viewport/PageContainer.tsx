"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useEditor } from "@/lib/editor/EditorContext";
import { IPageDimension, ITextObject, MIN_TEXT_WIDTH, MIN_TEXT_HEIGHT } from "@/types/editor";
import {
  pdfToScreen,
  screenToPdf,
  getRotatedDimensions,
  unrotatePoint,
  ViewportRotation,
} from "@/lib/editor/coordinates";
import { ObjectLayer } from "./ObjectLayer";
import { PdfCanvasLayer } from "./PdfCanvasLayer";

interface IPageContainerProps {
  page: IPageDimension;
}

interface ITextDragState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function PageContainer({ page }: IPageContainerProps) {
  const {
    zoom,
    viewportRotation,
    activeTool,
    activeProperties,
    addObject,
    selectObject,
    editingObjectId,
    setEditingObjectId,
    clearSelection,
  } = useEditor();

  const containerRef = useRef<HTMLDivElement>(null);
  const [textDragState, setTextDragState] = useState<ITextDragState | null>(null);

  // Extract per-page native rotation and combine with global viewport rotation
  const nativeRotation = (((page.rotation || 0) % 360 + 360) % 360) as ViewportRotation;
  const totalVisualRotation = ((nativeRotation + viewportRotation) % 360) as ViewportRotation;

  // Compute display dimensions accounting for total visual rotation (native + viewport)
  const { width: displayWidthPt, height: displayHeightPt } = getRotatedDimensions(
    page.width,
    page.height,
    totalVisualRotation
  );

  const containerWidth = pdfToScreen(displayWidthPt, zoom);
  const containerHeight = pdfToScreen(displayHeightPt, zoom);
  const unrotatedWidth = pdfToScreen(page.width, zoom);
  const unrotatedHeight = pdfToScreen(page.height, zoom);

  const offsetX = (containerWidth - unrotatedWidth) / 2;
  const offsetY = (containerHeight - unrotatedHeight) / 2;

  // Helper: Screen container coordinates -> Ground-Truth PDF Points
  const screenPointToGroundTruthPdf = useCallback(
    (screenX: number, screenY: number) => {
      const rawPdfX = screenToPdf(screenX, zoom);
      const rawPdfY = screenToPdf(screenY, zoom);

      // Sequential coordinate inversion:
      // 1. Screen Viewport Inverse -> Native Page Orientation Space
      const nativeDim = getRotatedDimensions(page.width, page.height, nativeRotation);
      const afterViewportInverse = unrotatePoint(
        { x: rawPdfX, y: rawPdfY },
        viewportRotation,
        nativeDim.width,
        nativeDim.height
      );
      // 2. Native Page Inverse -> Ground-Truth PDF Points Space
      const unrotated = unrotatePoint(
        afterViewportInverse,
        nativeRotation,
        page.width,
        page.height
      );

      return unrotated;
    },
    [page.width, page.height, zoom, nativeRotation, viewportRotation]
  );

  // Mouse / Pointer Down: Start Text Box drawing or Select tool handling
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !containerRef.current) return;

    // In Select tool mode: clear selection when clicking empty page space
    if (activeTool === "select") {
      if (editingObjectId !== null) {
        setEditingObjectId(null);
      }
      clearSelection();
      return;
    }

    // In Text tool mode:
    if (activeTool === "text") {
      // If user was actively editing a text box, dismiss editing mode first
      if (editingObjectId !== null) {
        setEditingObjectId(null);
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const startX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const startY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      setTextDragState({
        isDrawing: true,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
      });
      return;
    }

    // Quick add Shape on click when Shape tool is active
    if (activeTool === "rectangle" || activeTool === "circle") {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const unrotated = screenPointToGroundTruthPdf(clickX, clickY);

      addObject(page.pageIndex, {
        id: `shp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: "shape",
        pageIndex: page.pageIndex,
        shapeType: activeTool,
        x: Math.max(0, unrotated.x - 50),
        y: Math.max(0, unrotated.y - 50),
        width: 100,
        height: 100,
        rotation: 0,
        opacity: activeProperties.opacity,
        zIndex: 1,
        strokeColor: activeProperties.color,
        strokeWidth: activeProperties.strokeWidth,
        fillColor: activeProperties.fillColor,
      });
    }
  };

  // Window-level mouse move and mouse up listeners for smooth drag-to-create
  useEffect(() => {
    if (!textDragState?.isDrawing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      setTextDragState((prev) => (prev ? { ...prev, currentX, currentY } : null));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!containerRef.current || !textDragState) {
        setTextDragState(null);
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const finalX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const finalY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const dx = Math.abs(finalX - textDragState.startX);
      const dy = Math.abs(finalY - textDragState.startY);

      const p1 = screenPointToGroundTruthPdf(textDragState.startX, textDragState.startY);
      const p2 = screenPointToGroundTruthPdf(finalX, finalY);

      let x = Math.min(p1.x, p2.x);
      let y = Math.min(p1.y, p2.y);
      let width = Math.abs(p1.x - p2.x);
      let height = Math.abs(p1.y - p2.y);

      // Distinguish click from drag
      if (dx < 5 && dy < 5) {
        // Simple click without meaningful drag: create sensible minimum text box
        const defaultWidth = 140;
        const defaultHeight = 36;
        width = defaultWidth;
        height = defaultHeight;
        x = Math.max(0, Math.min(page.width - defaultWidth, p1.x - 20));
        y = Math.max(0, Math.min(page.height - defaultHeight, p1.y - 12));
      } else {
        // Drag in any direction: normalize and enforce minimums
        width = Math.max(MIN_TEXT_WIDTH, width);
        height = Math.max(MIN_TEXT_HEIGHT, height);
        x = Math.max(0, Math.min(page.width - width, x));
        y = Math.max(0, Math.min(page.height - height, y));
      }

      const newId = `txt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newTextObject: ITextObject = {
        id: newId,
        type: "text",
        pageIndex: page.pageIndex,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
        rotation: 0,
        opacity: activeProperties.opacity,
        zIndex: 1,
        text: "",
        fontSize: activeProperties.fontSize,
        fontFamily: activeProperties.fontFamily,
        fontWeight: activeProperties.fontWeight,
        fontStyle: activeProperties.fontStyle,
        textDecoration: activeProperties.textDecoration || "none",
        color: activeProperties.color,
        textAlign: activeProperties.textAlign,
        lineHeight: activeProperties.lineHeight || 1.2,
      };

      addObject(page.pageIndex, newTextObject);
      selectObject(newId);
      setEditingObjectId(newId);

      setTextDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    textDragState,
    page.pageIndex,
    page.width,
    page.height,
    screenPointToGroundTruthPdf,
    activeProperties,
    addObject,
    selectObject,
    setEditingObjectId,
  ]);

  return (
    <div
      ref={containerRef}
      data-page-container
      data-page-index={page.pageIndex}
      onMouseDown={handleMouseDown}
      style={{
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
      }}
      className={`relative bg-white shadow-xl rounded-xs select-none mx-auto border border-border/40 transition-all duration-150 ${
        activeTool === "text" ? "cursor-crosshair" : "cursor-default"
      }`}
    >
      {/* Background Canvas Layer (PDF.js render target with high-DPI, cancellation, and rotation) */}
      <div className="absolute inset-0 block w-full h-full pointer-events-none z-0 overflow-hidden">
        <PdfCanvasLayer pageIndex={page.pageIndex} rotationDelta={viewportRotation} />
      </div>

      {/* Interactive Object Layer with total visual rotation transform (Native + Viewport) */}
      <div
        style={{
          position: "absolute",
          left: `${offsetX}px`,
          top: `${offsetY}px`,
          width: `${unrotatedWidth}px`,
          height: `${unrotatedHeight}px`,
          transformOrigin: "center center",
          transform: totalVisualRotation ? `rotate(${totalVisualRotation}deg)` : undefined,
        }}
        className="pointer-events-none"
      >
        <ObjectLayer pageIndex={page.pageIndex} />
      </div>

      {/* Live Drag Preview for Text Box Creation */}
      {textDragState?.isDrawing && (
        <div
          style={{
            position: "absolute",
            left: `${Math.min(textDragState.startX, textDragState.currentX)}px`,
            top: `${Math.min(textDragState.startY, textDragState.currentY)}px`,
            width: `${Math.max(1, Math.abs(textDragState.currentX - textDragState.startX))}px`,
            height: `${Math.max(1, Math.abs(textDragState.currentY - textDragState.startY))}px`,
          }}
          className="border-2 border-dashed border-primary bg-primary/10 pointer-events-none z-30 transition-none"
        />
      )}
    </div>
  );
}
