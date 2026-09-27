"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useEditor } from "@/lib/editor/EditorContext";
import { EditorObject, ITextObject, IShapeObject, IDrawingObject, IImageObject } from "@/types/editor";
import {
  pdfToScreen,
  ResizeHandleType,
  IRect,
  IPoint,
  getResizeAnchor,
  calculateResizedRect,
  calculateMovedPosition,
  calculateRotationAngle,
  screenPointToGroundTruthPdf,
  ViewportRotation,
} from "@/lib/editor/coordinates";
import { SelectionOverlay } from "./SelectionOverlay";

interface IObjectLayerProps {
  pageIndex: number;
}

interface IInlineTextEditorProps {
  object: ITextObject;
  zoom: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

function InlineTextEditor({
  object,
  zoom,
  onCommit,
  onCancel,
}: IInlineTextEditorProps) {
  const [text, setText] = React.useState(object.text);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const isFinishedRef = React.useRef(false);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  const handleFinish = (commit: boolean) => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;
    if (commit) {
      onCommit(text);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Stop event propagation to prevent triggering global editor shortcuts
    e.stopPropagation();

    if (e.key === "Escape") {
      e.preventDefault();
      handleFinish(false);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleFinish(true);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => handleFinish(true)}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      placeholder="Type here..."
      style={{
        fontSize: `${pdfToScreen(object.fontSize, zoom)}px`,
        fontFamily: object.fontFamily,
        fontWeight: object.fontWeight,
        fontStyle: object.fontStyle,
        textDecoration: object.textDecoration,
        color: object.color,
        textAlign: object.textAlign,
        lineHeight: object.lineHeight,
        width: "100%",
        height: "100%",
        border: "1.5px dashed #2563eb",
        borderRadius: "2px",
        outline: "none",
        resize: "none",
        background: "rgba(255, 255, 255, 0.95)",
        padding: "4px",
        boxSizing: "border-box",
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
      }}
      className="shadow-xs cursor-text select-text pointer-events-auto"
    />
  );
}

export function ObjectLayer({ pageIndex }: IObjectLayerProps) {
  const {
    objectsByPage,
    selectedObjectIds,
    editingObjectId,
    selectObject,
    setEditingObjectId,
    updateObject,
    commitResize,
    commitMove,
    commitRotate,
    deleteObject,
    zoom,
    activeTool,
    pageDimensions,
    viewportRotation,
  } = useEditor();

  const layerRef = useRef<HTMLDivElement>(null);

  // Resize State for interactive drag resizing
  const [resizeState, setResizeState] = useState<{
    id: string;
    handle: ResizeHandleType;
    origRect: IRect;
    anchor: IPoint;
  } | null>(null);

  const lastRectRef = useRef<IRect | null>(null);
  const resizeStateRef = useRef(resizeState);
  resizeStateRef.current = resizeState;

  // Rotate State for interactive free rotation (Phase 5.5.6)
  const [rotateState, setRotateState] = useState<{
    id: string;
    origRotation: number;
    center: IPoint;
  } | null>(null);

  const lastRotationRef = useRef<number | null>(null);
  const rotateStateRef = useRef(rotateState);
  rotateStateRef.current = rotateState;

  // Move State for interactive text body drag
  const [moveState, setMoveState] = useState<{
    id: string;
    origPos: IPoint;
    grabOffset: IPoint;
    width: number;
    height: number;
  } | null>(null);

  const lastPosRef = useRef<IPoint | null>(null);
  const moveStateRef = useRef(moveState);
  moveStateRef.current = moveState;

  const pageObjects = objectsByPage[pageIndex] || [];

  const handleResizeStart = useCallback(
    (handle: ResizeHandleType, e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (selectedObjectIds.length !== 1) return;
      const selectedId = selectedObjectIds[0];
      const pageObjs = objectsByPage[pageIndex] || [];
      const obj = pageObjs.find((o) => o.id === selectedId);
      if (!obj || obj.type !== "text") return;

      const origRect: IRect = {
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
      };

      const anchor = getResizeAnchor(origRect, handle);
      lastRectRef.current = origRect;
      setResizeState({
        id: obj.id,
        handle,
        origRect,
        anchor,
      });
    },
    [selectedObjectIds, objectsByPage, pageIndex]
  );

  const handleRotateStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (selectedObjectIds.length !== 1) return;
      const selectedId = selectedObjectIds[0];
      const pageObjs = objectsByPage[pageIndex] || [];
      const obj = pageObjs.find((o) => o.id === selectedId);
      if (!obj || obj.type !== "text") return;

      const center: IPoint = {
        x: obj.x + obj.width / 2,
        y: obj.y + obj.height / 2,
      };

      const origRotation = obj.rotation || 0;
      lastRotationRef.current = origRotation;

      setRotateState({
        id: obj.id,
        origRotation,
        center,
      });
    },
    [selectedObjectIds, objectsByPage, pageIndex]
  );

  useEffect(() => {
    if (!resizeState) return;

    const pageDim = pageDimensions[pageIndex] || {
      width: 595.28,
      height: 841.89,
      rotation: 0,
    };
    const nativeRotation = (pageDim.rotation || 0) as ViewportRotation;

    const cursor =
      resizeState.handle === "top-left" || resizeState.handle === "bottom-right"
        ? "nwse-resize"
        : "nesw-resize";
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = cursor;

    const handlePointerMove = (e: PointerEvent) => {
      const current = resizeStateRef.current;
      if (!current) return;

      const containerEl = layerRef.current?.closest(
        `[data-page-index="${pageIndex}"]`
      ) as HTMLElement | null;
      if (!containerEl) return;

      const rect = containerEl.getBoundingClientRect();
      const screenX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const screenY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const pointerPdf = screenPointToGroundTruthPdf(
        screenX,
        screenY,
        zoom,
        pageDim.width,
        pageDim.height,
        nativeRotation,
        viewportRotation
      );

      const newRect = calculateResizedRect(
        current.anchor,
        pointerPdf,
        pageDim.width,
        pageDim.height
      );

      lastRectRef.current = newRect;
      updateObject(current.id, newRect, false);
    };

    const handlePointerUp = () => {
      const current = resizeStateRef.current;
      if (current && lastRectRef.current) {
        commitResize(current.id, current.origRect, lastRectRef.current);
      }
      setResizeState(null);
      lastRectRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.style.cursor = prevCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    resizeState,
    pageIndex,
    pageDimensions,
    zoom,
    viewportRotation,
    updateObject,
    commitResize,
  ]);

  // Pointer move / up listener for interactive free rotation (Phase 5.5.6)
  useEffect(() => {
    if (!rotateState) return;

    const pageDim = pageDimensions[pageIndex] || {
      width: 595.28,
      height: 841.89,
      rotation: 0,
    };
    const nativeRotation = (pageDim.rotation || 0) as ViewportRotation;

    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    const handlePointerMove = (e: PointerEvent) => {
      const current = rotateStateRef.current;
      if (!current) return;

      const containerEl = layerRef.current?.closest(
        `[data-page-index="${pageIndex}"]`
      ) as HTMLElement | null;
      if (!containerEl) return;

      const rect = containerEl.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const pointerPdf = screenPointToGroundTruthPdf(
        screenX,
        screenY,
        zoom,
        pageDim.width,
        pageDim.height,
        nativeRotation,
        viewportRotation
      );

      const newRotation = calculateRotationAngle(current.center, pointerPdf);
      lastRotationRef.current = newRotation;
      updateObject(current.id, { rotation: newRotation }, false);
    };

    const handlePointerUp = () => {
      const current = rotateStateRef.current;
      if (current && lastRotationRef.current !== null) {
        if (lastRotationRef.current !== current.origRotation) {
          commitRotate(current.id, current.origRotation, lastRotationRef.current);
        }
      }
      setRotateState(null);
      lastRotationRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.style.cursor = prevCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    rotateState,
    pageIndex,
    pageDimensions,
    zoom,
    viewportRotation,
    updateObject,
    commitRotate,
  ]);

  // Pointer move / up listener for interactive body dragging
  useEffect(() => {
    if (!moveState) return;

    const pageDim = pageDimensions[pageIndex] || {
      width: 595.28,
      height: 841.89,
      rotation: 0,
    };
    const nativeRotation = (pageDim.rotation || 0) as ViewportRotation;

    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    const handlePointerMove = (e: PointerEvent) => {
      const current = moveStateRef.current;
      if (!current) return;

      const containerEl = layerRef.current?.closest(
        `[data-page-index="${pageIndex}"]`
      ) as HTMLElement | null;
      if (!containerEl) return;

      const rect = containerEl.getBoundingClientRect();
      const screenX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const screenY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const pointerPdf = screenPointToGroundTruthPdf(
        screenX,
        screenY,
        zoom,
        pageDim.width,
        pageDim.height,
        nativeRotation,
        viewportRotation
      );

      const newPos = calculateMovedPosition(
        pointerPdf,
        current.grabOffset,
        current.width,
        current.height,
        pageDim.width,
        pageDim.height
      );

      lastPosRef.current = newPos;
      updateObject(current.id, newPos, false);
    };

    const handlePointerUp = () => {
      const current = moveStateRef.current;
      if (current && lastPosRef.current) {
        if (
          lastPosRef.current.x !== current.origPos.x ||
          lastPosRef.current.y !== current.origPos.y
        ) {
          commitMove(current.id, current.origPos, lastPosRef.current);
        }
      }
      setMoveState(null);
      lastPosRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.style.cursor = prevCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    moveState,
    pageIndex,
    pageDimensions,
    zoom,
    viewportRotation,
    updateObject,
    commitMove,
  ]);

  const handleObjectPointerDown = useCallback(
    (e: React.PointerEvent, obj: EditorObject) => {
      if (e.button !== 0) return;
      if (editingObjectId === obj.id) return;
      if (activeTool !== "select" || obj.type !== "text") return;
      if (rotateState || resizeState) return;

      if (!selectedObjectIds.includes(obj.id)) {
        selectObject(obj.id, e.shiftKey);
      }

      e.stopPropagation();

      const containerEl = layerRef.current?.closest(
        `[data-page-index="${pageIndex}"]`
      ) as HTMLElement | null;
      if (!containerEl) return;

      const rect = containerEl.getBoundingClientRect();
      const screenX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const screenY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const pageDim = pageDimensions[pageIndex] || {
        width: 595.28,
        height: 841.89,
        rotation: 0,
      };
      const nativeRotation = (pageDim.rotation || 0) as ViewportRotation;

      const pointerPdf = screenPointToGroundTruthPdf(
        screenX,
        screenY,
        zoom,
        pageDim.width,
        pageDim.height,
        nativeRotation,
        viewportRotation
      );

      const grabOffset: IPoint = {
        x: pointerPdf.x - obj.x,
        y: pointerPdf.y - obj.y,
      };

      const origPos: IPoint = { x: obj.x, y: obj.y };
      lastPosRef.current = origPos;

      setMoveState({
        id: obj.id,
        origPos,
        grabOffset,
        width: obj.width,
        height: obj.height,
      });
    },
    [
      activeTool,
      editingObjectId,
      selectedObjectIds,
      selectObject,
      pageIndex,
      pageDimensions,
      zoom,
      viewportRotation,
    ]
  );

  const handleObjectClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (activeTool === "select" && editingObjectId !== id) {
      selectObject(id, e.shiftKey);
    }
  };

  const handleObjectDoubleClick = (e: React.MouseEvent, obj: EditorObject) => {
    e.stopPropagation();
    if (obj.type === "text") {
      selectObject(obj.id);
      setEditingObjectId(obj.id);
    }
  };

  return (
    <div ref={layerRef} className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {pageObjects.map((obj) => {
        const isSelected = selectedObjectIds.includes(obj.id);
        const isEditing = editingObjectId === obj.id;
        const x = pdfToScreen(obj.x, zoom);
        const y = pdfToScreen(obj.y, zoom);
        const width = pdfToScreen(obj.width, zoom);
        const height = pdfToScreen(obj.height, zoom);

        return (
          <React.Fragment key={obj.id}>
            <div
              onPointerDown={(e) => handleObjectPointerDown(e, obj)}
              onClick={(e) => handleObjectClick(e, obj.id)}
              onDoubleClick={(e) => handleObjectDoubleClick(e, obj)}
              style={{
                position: "absolute",
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`,
                transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
                transformOrigin: "center center",
                opacity: obj.opacity,
                pointerEvents: activeTool === "select" || isEditing ? "auto" : "none",
                cursor: isEditing
                  ? "text"
                  : activeTool === "select"
                  ? moveState?.id === obj.id
                    ? "grabbing"
                    : "move"
                  : "default",
              }}
              className="group select-none"
            >
              {/* 1. Text Object */}
              {obj.type === "text" && (
                isEditing ? (
                  <InlineTextEditor
                    object={obj as ITextObject}
                    zoom={zoom}
                    onCommit={(newText) => {
                      const trimmed = newText.trim();
                      if (!trimmed) {
                        deleteObject(obj.id);
                      } else {
                        updateObject(obj.id, { text: trimmed });
                      }
                      setEditingObjectId(null);
                    }}
                    onCancel={() => {
                      const currentText = (obj as ITextObject).text.trim();
                      if (!currentText) {
                        deleteObject(obj.id);
                      }
                      setEditingObjectId(null);
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: `${pdfToScreen((obj as ITextObject).fontSize, zoom)}px`,
                      fontFamily: (obj as ITextObject).fontFamily,
                      fontWeight: (obj as ITextObject).fontWeight,
                      fontStyle: (obj as ITextObject).fontStyle,
                      textDecoration: (obj as ITextObject).textDecoration,
                      color: (obj as ITextObject).color,
                      textAlign: (obj as ITextObject).textAlign,
                      lineHeight: (obj as ITextObject).lineHeight,
                      width: "100%",
                      height: "100%",
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}
                    className="p-1"
                  >
                    {(obj as ITextObject).text || (
                      <span className="text-muted-foreground/40 italic select-none">
                        Type here...
                      </span>
                    )}
                  </div>
                )
              )}

              {/* 2. Shape Object */}
              {obj.type === "shape" && (
                <svg className="w-full h-full overflow-visible">
                  {(obj as IShapeObject).shapeType === "rectangle" && (
                    <rect
                      x={0}
                      y={0}
                      width={width}
                      height={height}
                      fill={(obj as IShapeObject).fillColor}
                      stroke={(obj as IShapeObject).strokeColor}
                      strokeWidth={pdfToScreen((obj as IShapeObject).strokeWidth, zoom)}
                    />
                  )}
                  {(obj as IShapeObject).shapeType === "circle" && (
                    <ellipse
                      cx={width / 2}
                      cy={height / 2}
                      rx={width / 2}
                      ry={height / 2}
                      fill={(obj as IShapeObject).fillColor}
                      stroke={(obj as IShapeObject).strokeColor}
                      strokeWidth={pdfToScreen((obj as IShapeObject).strokeWidth, zoom)}
                    />
                  )}
                  {(obj as IShapeObject).shapeType === "line" && (
                    <line
                      x1={0}
                      y1={0}
                      x2={width}
                      y2={height}
                      stroke={(obj as IShapeObject).strokeColor}
                      strokeWidth={pdfToScreen((obj as IShapeObject).strokeWidth, zoom)}
                    />
                  )}
                </svg>
              )}

              {/* 3. Drawing / Pen Object */}
              {obj.type === "drawing" && (
                <svg className="w-full h-full overflow-visible pointer-events-none">
                  <polyline
                    points={(obj as IDrawingObject).points
                      .map((p) => `${pdfToScreen(p.x - obj.x, zoom)},${pdfToScreen(p.y - obj.y, zoom)}`)
                      .join(" ")}
                    fill="none"
                    stroke={(obj as IDrawingObject).color}
                    strokeWidth={pdfToScreen((obj as IDrawingObject).strokeWidth, zoom)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      mixBlendMode: (obj as IDrawingObject).isHighlighter ? "multiply" : "normal",
                    }}
                  />
                </svg>
              )}

              {/* 4. Image Object */}
              {obj.type === "image" && (
                <img
                  src={(obj as IImageObject).src}
                  alt="Editor image"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              )}
            </div>

            {/* Selection Overlay (Active Handles) - hidden during inline editing */}
            {isSelected &&
              selectedObjectIds.length === 1 &&
              obj.type === "text" &&
              activeTool === "select" &&
              !isEditing && (
                <SelectionOverlay
                  pdfRect={{
                    x: obj.x,
                    y: obj.y,
                    width: obj.width,
                    height: obj.height,
                  }}
                  zoom={zoom}
                  rotation={obj.rotation}
                  onResizeStart={handleResizeStart}
                  onRotateStart={handleRotateStart}
                />
              )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
