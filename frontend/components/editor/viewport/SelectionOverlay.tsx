"use client";

import React from "react";
import { IRect, pdfRectToScreen, ResizeHandleType } from "@/lib/editor/coordinates";

interface ISelectionOverlayProps {
  pdfRect: IRect;
  zoom: number;
  rotation?: number;
  onResizeStart?: (handle: ResizeHandleType, e: React.PointerEvent) => void;
  onRotateStart?: (e: React.PointerEvent) => void;
}

const CORNER_HANDLES: { type: ResizeHandleType; className: string }[] = [
  { type: "top-left", className: "-top-1.5 -left-1.5 cursor-nwse-resize" },
  { type: "top-right", className: "-top-1.5 -right-1.5 cursor-nesw-resize" },
  { type: "bottom-left", className: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
  { type: "bottom-right", className: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
];

export function SelectionOverlay({
  pdfRect,
  zoom,
  rotation = 0,
  onResizeStart,
  onRotateStart,
}: ISelectionOverlayProps) {
  const screenRect = pdfRectToScreen(pdfRect, zoom);

  const handlePointerDown = (handle: ResizeHandleType, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart?.(handle, e);
  };

  const handleRotatePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onRotateStart?.(e);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${screenRect.x}px`,
        top: `${screenRect.y}px`,
        width: `${screenRect.width}px`,
        height: `${screenRect.height}px`,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "center center",
        pointerEvents: "none",
      }}
      className="border-2 border-primary shadow-xs z-30"
    >
      {/* 1. Dedicated Rotation Handle & Stem (Phase 5.5.6) */}
      {onRotateStart && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
          style={{ width: "20px" }}
        >
          {/* Distinct Circular Rotation Knob */}
          <div
            data-handle="rotate"
            onPointerDown={handleRotatePointerDown}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            className="w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-125 transition-transform shadow-xs touch-none"
            title="Rotate Object"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary pointer-events-none" />
          </div>
          {/* Vertical Connecting Stem Line */}
          <div className="w-[1.5px] h-3 bg-primary" />
        </div>
      )}

      {/* 2. Strictly 4 Corner Resize Handles */}
      {CORNER_HANDLES.map(({ type, className }) => (
        <div
          key={type}
          data-handle={type}
          onPointerDown={(e) => handlePointerDown(type, e)}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className={`absolute w-3 h-3 bg-background border-2 border-primary rounded-xs pointer-events-auto transition-transform hover:scale-125 touch-none ${className}`}
        />
      ))}
    </div>
  );
}

