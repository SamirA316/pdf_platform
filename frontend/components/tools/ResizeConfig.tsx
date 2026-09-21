"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Maximize2,
  FileText,
  Compass,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Sparkles,
} from "lucide-react";

interface ResizeConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

interface PagePreset {
  id: string;
  name: string;
  desc: string;
  mm: string;
}

const PAGE_PRESETS: PagePreset[] = [
  { id: "a4", name: "A4", desc: "Standard Document", mm: "210 × 297 mm" },
  { id: "a3", name: "A3", desc: "Large Poster / Ledger", mm: "297 × 420 mm" },
  { id: "a5", name: "A5", desc: "Booklet / Pocket", mm: "148 × 210 mm" },
  { id: "letter", name: "Letter", desc: "US Standard", mm: "8.5 × 11 in" },
  { id: "legal", name: "Legal", desc: "US Legal Document", mm: "8.5 × 14 in" },
  { id: "custom", name: "Custom", desc: "Specific Dimensions", mm: "User defined" },
];

export function ResizeConfig({ files, onProcess }: ResizeConfigProps) {
  const [selectedSize, setSelectedSize] = useState<string>("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [customWidth, setCustomWidth] = useState<string>("210");
  const [customHeight, setCustomHeight] = useState<string>("297");
  const [customUnit, setCustomUnit] = useState<"mm" | "inch" | "pt">("mm");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    if (selectedSize === "custom") {
      const w = parseFloat(customWidth);
      const h = parseFloat(customHeight);

      if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
        setError("Please enter valid positive numbers for width and height.");
        return;
      }

      onProcess({
        size: "custom",
        orientation,
        width: w,
        height: h,
        unit: customUnit,
      });
    } else {
      onProcess({
        size: selectedSize,
        orientation,
      });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm transition-all">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl mb-3 shadow-xs">
          <Maximize2 className="w-6 h-6" />
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          Resize PDF Pages
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-md mx-auto">
          Scale and refit your PDF pages to standard paper sizes or custom dimensions without cropping content.
        </p>
        {files[0] && (
          <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 bg-muted/60 rounded-full text-xs font-medium text-foreground">
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span className="truncate max-w-[260px]">{files[0].name}</span>
            <span className="text-muted-foreground">
              ({(files[0].size / (1024 * 1024)).toFixed(2)} MB)
            </span>
          </div>
        )}
      </div>

      {/* Page Size Presets Grid */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-primary" />
            Page Size Preset
          </label>
          <span className="text-xs text-muted-foreground">Select format</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PAGE_PRESETS.map((preset) => {
            const isSelected = selectedSize === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedSize(preset.id)}
                className={`relative flex flex-col p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 shadow-xs ring-2 ring-red-500/20"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base font-bold text-foreground">
                    {preset.name}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  {preset.desc}
                </span>
                <span className="text-[11px] text-muted-foreground/80 mt-1">
                  {preset.mm}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Dimensions Form (if Custom is chosen) */}
      {selectedSize === "custom" && (
        <div className="mb-6 p-4 rounded-2xl bg-muted/40 border border-border/80 animate-in fade-in slide-in-from-top-2 duration-200">
          <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            Custom Dimensions
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Width
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                placeholder="210"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Height
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                placeholder="297"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Unit
              </label>
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as "mm" | "inch" | "pt")}
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              >
                <option value="mm">Millimeters (mm)</option>
                <option value="inch">Inches (in)</option>
                <option value="pt">PDF Points (pt)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Orientation Selector */}
      <div className="mb-6">
        <label className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
          <Compass className="w-4 h-4 text-primary" />
          Page Orientation
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOrientation("portrait")}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
              orientation === "portrait"
                ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 ring-2 ring-red-500/20"
                : "border-border bg-card hover:bg-muted/30"
            }`}
          >
            {/* Visual Portrait Preview Icon */}
            <div
              className={`w-6 h-8 rounded-sm border-2 flex items-center justify-center transition-colors ${
                orientation === "portrait"
                  ? "border-red-600 dark:border-red-400 bg-red-100/50 dark:bg-red-900/30"
                  : "border-muted-foreground/40 bg-muted/20"
              }`}
            >
              <span className="text-[8px] font-bold text-muted-foreground">P</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-foreground">Portrait</div>
              <div className="text-xs text-muted-foreground">Vertical (taller)</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOrientation("landscape")}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
              orientation === "landscape"
                ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 ring-2 ring-red-500/20"
                : "border-border bg-card hover:bg-muted/30"
            }`}
          >
            {/* Visual Landscape Preview Icon */}
            <div
              className={`w-8 h-6 rounded-sm border-2 flex items-center justify-center transition-colors ${
                orientation === "landscape"
                  ? "border-red-600 dark:border-red-400 bg-red-100/50 dark:bg-red-900/30"
                  : "border-muted-foreground/40 bg-muted/20"
              }`}
            >
              <span className="text-[8px] font-bold text-muted-foreground">L</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-foreground">Landscape</div>
              <div className="text-xs text-muted-foreground">Horizontal (wider)</div>
            </div>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleSubmit}
        className="w-full h-12 rounded-xl font-bold text-base shadow-sm bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
      >
        <span>
          Resize PDF to {selectedSize === "custom" ? "Custom Size" : selectedSize.toUpperCase()} ({orientation})
        </span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
