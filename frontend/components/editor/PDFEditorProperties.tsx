"use client";

import React, { useState, useEffect } from "react";
import { useEditor } from "@/lib/editor/EditorContext";
import { EditorFontFamily, EditorTextAlign, ITextObject, IShapeObject } from "@/types/editor";
import {
  SUPPORTED_FONT_FAMILIES,
  isValidFontSize,
  clampFontSize,
  isValidLineHeight,
  clampLineHeight,
  isValidHexColor,
  toggleFontWeight,
  toggleFontStyle,
  toggleTextDecoration,
} from "@/lib/editor/formatUtils";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Sliders,
  Type,
  Palette,
  Minus,
  Plus,
} from "lucide-react";

const PRESET_COLORS = [
  "#000000",
  "#1e293b",
  "#dc2626",
  "#ea580c",
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#facc15",
  "#ffffff",
];

const LINE_HEIGHT_PRESETS = [1.0, 1.2, 1.5, 2.0];

export function PDFEditorProperties() {
  const {
    activeTool,
    activeProperties,
    updateActiveProperties,
    selectedObjectIds,
    getSelectedObjects,
    updateObject,
    deleteSelection,
  } = useEditor();

  const selectedObjects = getSelectedObjects();
  const primarySelected = selectedObjects[0];
  const selectedTextObjects = selectedObjects.filter((o): o is ITextObject => o.type === "text");

  const isTextContext =
    activeTool === "text" ||
    (primarySelected && primarySelected.type === "text") ||
    selectedTextObjects.length > 0;

  const isShapeContext =
    activeTool === "rectangle" ||
    activeTool === "circle" ||
    activeTool === "line" ||
    activeTool === "arrow" ||
    (primarySelected && primarySelected.type === "shape");

  const isDrawContext =
    activeTool === "pen" ||
    activeTool === "highlighter" ||
    (primarySelected && primarySelected.type === "drawing");

  // Determine current active formatting values
  const currentFontFamily: EditorFontFamily =
    primarySelected && primarySelected.type === "text"
      ? (primarySelected as ITextObject).fontFamily
      : activeProperties.fontFamily;

  const currentFontSize: number =
    primarySelected && primarySelected.type === "text"
      ? (primarySelected as ITextObject).fontSize
      : activeProperties.fontSize;

  const currentFontWeight: "normal" | "bold" =
    primarySelected && primarySelected.type === "text"
      ? (primarySelected as ITextObject).fontWeight
      : activeProperties.fontWeight;

  const currentFontStyle: "normal" | "italic" =
    primarySelected && primarySelected.type === "text"
      ? (primarySelected as ITextObject).fontStyle
      : activeProperties.fontStyle;

  const currentTextDecoration: "none" | "underline" =
    primarySelected && primarySelected.type === "text"
      ? (primarySelected as ITextObject).textDecoration
      : activeProperties.textDecoration;

  const currentColor: string =
    primarySelected && "color" in primarySelected
      ? (primarySelected as any).color
      : activeProperties.color;

  const currentTextAlign: EditorTextAlign =
    primarySelected && primarySelected.type === "text"
      ? (primarySelected as ITextObject).textAlign
      : activeProperties.textAlign;

  const currentLineHeight: number =
    primarySelected && primarySelected.type === "text"
      ? (primarySelected as ITextObject).lineHeight
      : activeProperties.lineHeight ?? 1.2;

  // Local state for numeric inputs (committed on blur / Enter)
  const [fontSizeInput, setFontSizeInput] = useState<string>(String(currentFontSize));
  const [lineHeightInput, setLineHeightInput] = useState<string>(String(currentLineHeight));

  useEffect(() => {
    setFontSizeInput(String(currentFontSize));
  }, [currentFontSize, primarySelected?.id]);

  useEffect(() => {
    setLineHeightInput(String(currentLineHeight));
  }, [currentLineHeight, primarySelected?.id]);

  // Unified formatting apply function
  const applyTextFormatting = (updates: Partial<ITextObject>) => {
    updateActiveProperties(updates as any);
    if (selectedTextObjects.length > 0) {
      selectedTextObjects.forEach((textObj) => {
        const hasChange = Object.entries(updates).some(
          ([key, val]) => (textObj as any)[key] !== val
        );
        if (hasChange) {
          updateObject(textObj.id, updates, true);
        }
      });
    }
  };

  // Finalize font size changes
  const commitFontSize = () => {
    const parsed = parseFloat(fontSizeInput);
    if (!isValidFontSize(parsed)) {
      setFontSizeInput(String(currentFontSize));
      return;
    }
    const clamped = clampFontSize(parsed);
    setFontSizeInput(String(clamped));
    if (clamped !== currentFontSize) {
      applyTextFormatting({ fontSize: clamped });
    }
  };

  // Finalize line height changes
  const commitLineHeight = () => {
    const parsed = parseFloat(lineHeightInput);
    if (!isValidLineHeight(parsed)) {
      setLineHeightInput(String(currentLineHeight));
      return;
    }
    const clamped = clampLineHeight(parsed);
    setLineHeightInput(String(clamped));
    if (clamped !== currentLineHeight) {
      applyTextFormatting({ lineHeight: clamped });
    }
  };

  // Color handler
  const handleColorChange = (hex: string) => {
    if (!isValidHexColor(hex)) return;
    updateActiveProperties({ color: hex });
    if (selectedTextObjects.length > 0) {
      selectedTextObjects.forEach((textObj) => {
        if (textObj.color !== hex) {
          updateObject(textObj.id, { color: hex }, true);
        }
      });
    } else if (primarySelected) {
      if ("color" in primarySelected && (primarySelected as any).color !== hex) {
        updateObject(primarySelected.id, { color: hex } as any);
      } else if ("strokeColor" in primarySelected && (primarySelected as any).strokeColor !== hex) {
        updateObject(primarySelected.id, { strokeColor: hex } as any);
      }
    }
  };

  // Font family handler
  const handleFontFamilyChange = (font: EditorFontFamily) => {
    applyTextFormatting({ fontFamily: font });
  };

  // Text align handler
  const handleAlignmentChange = (align: EditorTextAlign) => {
    applyTextFormatting({ textAlign: align });
  };

  // Style toggle handlers
  const handleBoldToggle = () => {
    applyTextFormatting({ fontWeight: toggleFontWeight(currentFontWeight) });
  };

  const handleItalicToggle = () => {
    applyTextFormatting({ fontStyle: toggleFontStyle(currentFontStyle) });
  };

  const handleUnderlineToggle = () => {
    applyTextFormatting({ textDecoration: toggleTextDecoration(currentTextDecoration) });
  };

  const handleStrokeWidthChange = (w: number) => {
    updateActiveProperties({ strokeWidth: w });
    if (primarySelected) {
      if ("strokeWidth" in primarySelected) {
        updateObject(primarySelected.id, { strokeWidth: w } as any);
      }
    }
  };

  return (
    <aside className="w-64 border-l border-border bg-card/60 backdrop-blur-md p-4 flex flex-col gap-5 z-20 select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Properties
          </h2>
        </div>
        {selectedObjectIds.length > 0 && (
          <button
            onClick={deleteSelection}
            className="p-1 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete Selected (Del)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 1. Color Palette */}
      {(isTextContext || isShapeContext || isDrawContext) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Color</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={isValidHexColor(currentColor) ? currentColor : "#000000"}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border border-border bg-transparent p-0"
                title="Custom Color"
              />
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                {currentColor}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {PRESET_COLORS.map((hex) => {
              const isSelected = currentColor.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  onClick={() => handleColorChange(hex)}
                  style={{ backgroundColor: hex }}
                  className={`w-8 h-8 rounded-lg border transition-all ${
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 shadow-sm"
                      : "border-border hover:scale-105"
                  }`}
                  title={hex}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Text Formatting Properties */}
      {isTextContext && (
        <div className="space-y-3 border-t border-border pt-3">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Typography</span>
          </label>

          {/* Font Family */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">
              Font Family
            </span>
            <select
              value={currentFontFamily}
              onChange={(e) => handleFontFamilyChange(e.target.value as EditorFontFamily)}
              className="w-full text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              {SUPPORTED_FONT_FAMILIES.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size & Steppers */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">
              Font Size
            </span>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center rounded-lg border border-border bg-background px-2 py-1">
                <input
                  type="number"
                  min={4}
                  max={500}
                  step={1}
                  value={fontSizeInput}
                  onChange={(e) => setFontSizeInput(e.target.value)}
                  onBlur={commitFontSize}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitFontSize();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-full text-xs bg-transparent text-foreground focus:outline-none font-medium"
                />
                <span className="text-[11px] text-muted-foreground ml-1">pt</span>
              </div>
              <div className="flex items-center border border-border rounded-lg bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const nextSize = clampFontSize(currentFontSize - 1);
                    setFontSizeInput(String(nextSize));
                    applyTextFormatting({ fontSize: nextSize });
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Decrease Font Size"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextSize = clampFontSize(currentFontSize + 1);
                    setFontSizeInput(String(nextSize));
                    applyTextFormatting({ fontSize: nextSize });
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Increase Font Size"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Style Toggles: Bold, Italic, Underline */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">
              Style & Alignment
            </span>
            <div className="flex items-center justify-between gap-2">
              {/* Bold / Italic / Underline */}
              <div className="flex items-center border border-border rounded-lg p-0.5 bg-background">
                <button
                  type="button"
                  onClick={handleBoldToggle}
                  className={`p-1.5 rounded transition-all ${
                    currentFontWeight === "bold"
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleItalicToggle}
                  className={`p-1.5 rounded transition-all ${
                    currentFontStyle === "italic"
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleUnderlineToggle}
                  className={`p-1.5 rounded transition-all ${
                    currentTextDecoration === "underline"
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Underline"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Alignments */}
              <div className="flex items-center border border-border rounded-lg p-0.5 bg-background">
                <button
                  type="button"
                  onClick={() => handleAlignmentChange("left")}
                  className={`p-1.5 rounded transition-all ${
                    currentTextAlign === "left"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Align Left"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignmentChange("center")}
                  className={`p-1.5 rounded transition-all ${
                    currentTextAlign === "center"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Align Center"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignmentChange("right")}
                  className={`p-1.5 rounded transition-all ${
                    currentTextAlign === "right"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Align Right"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Line Height */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">
                Line Spacing
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {currentLineHeight}x
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center rounded-lg border border-border bg-background px-2 py-1">
                <input
                  type="number"
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={lineHeightInput}
                  onChange={(e) => setLineHeightInput(e.target.value)}
                  onBlur={commitLineHeight}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitLineHeight();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-full text-xs bg-transparent text-foreground focus:outline-none font-medium"
                />
              </div>
              {/* Presets */}
              <div className="flex items-center gap-1">
                {LINE_HEIGHT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setLineHeightInput(String(preset));
                      applyTextFormatting({ lineHeight: preset });
                    }}
                    className={`px-1.5 py-1 text-[10px] rounded border transition-all ${
                      currentLineHeight === preset
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Stroke / Line Width for Shapes / Drawings */}
      {(isShapeContext || isDrawContext) && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium text-foreground">Stroke Thickness</span>
            <span className="text-muted-foreground text-[11px]">
              {primarySelected && "strokeWidth" in primarySelected
                ? (primarySelected as any).strokeWidth
                : activeProperties.strokeWidth}{" "}
              pt
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={24}
            value={
              primarySelected && "strokeWidth" in primarySelected
                ? (primarySelected as any).strokeWidth
                : activeProperties.strokeWidth
            }
            onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
            className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
          />
        </div>
      )}

      {/* Empty State when no relevant context */}
      {!isTextContext && !isShapeContext && !isDrawContext && selectedObjects.length === 0 && (
        <div className="text-center py-8 text-xs text-muted-foreground">
          <Sliders className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No object selected.</p>
          <p className="text-[11px] mt-1">Select an object or tool to adjust properties.</p>
        </div>
      )}

      {/* Selection Meta */}
      {selectedObjects.length > 0 && primarySelected && (
        <div className="mt-auto border-t border-border pt-3 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground capitalize mb-1">
            {primarySelected.type} Object
            {selectedObjects.length > 1 && ` (+${selectedObjects.length - 1} more)`}
          </p>
          <p>
            Pos: {Math.round(primarySelected.x)}pt, {Math.round(primarySelected.y)}pt
          </p>
          <p>
            Size: {Math.round(primarySelected.width)} × {Math.round(primarySelected.height)} pt
          </p>
          {primarySelected.rotation ? (
            <p>
              Rotation: {Math.round(primarySelected.rotation)}°
            </p>
          ) : null}
        </div>
      )}
    </aside>
  );
}
