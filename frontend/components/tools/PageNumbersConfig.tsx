"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ListOrdered,
  FileText,
  ArrowRight,
  Sliders,
  Sparkles,
} from "lucide-react";

interface PageNumbersConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

const POSITIONS = [
  { id: "top-left", label: "Top Left", x: "left", y: "top" },
  { id: "top-center", label: "Top Center", x: "center", y: "top" },
  { id: "top-right", label: "Top Right", x: "right", y: "top" },
  { id: "bottom-left", label: "Bottom Left", x: "left", y: "bottom" },
  { id: "bottom-center", label: "Bottom Center", x: "center", y: "bottom" },
  { id: "bottom-right", label: "Bottom Right", x: "right", y: "bottom" },
] as const;

const FORMAT_PRESETS = [
  { id: "Page {n} / {total}", label: "Page 1 / 10", sample: "Page {n} / {total}" },
  { id: "{n} of {total}", label: "1 of 10", sample: "{n} of {total}" },
  { id: "{n}", label: "1", sample: "{n}" },
  { id: "- {n} -", label: "- 1 -", sample: "- {n} -" },
  { id: "custom", label: "Custom", sample: "Custom Template" },
];

export function PageNumbersConfig({ files, onProcess }: PageNumbersConfigProps) {
  const [position, setPosition] = useState<
    "bottom-center" | "bottom-left" | "bottom-right" | "top-center" | "top-left" | "top-right"
  >("bottom-center");
  const [formatPreset, setFormatPreset] = useState<string>("Page {n} / {total}");
  const [customFormat, setCustomFormat] = useState<string>("Page {n} / {total}");
  const [startNumber, setStartNumber] = useState<number>(1);
  const [fontSize, setFontSize] = useState<number>(12);
  const [color, setColor] = useState<string>("#000000");
  const [skipFirstPage, setSkipFirstPage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeFormat = formatPreset === "custom" ? customFormat : formatPreset;

  const handleSubmit = () => {
    setError(null);

    if (!activeFormat.trim()) {
      setError("Please choose or enter a page number format.");
      return;
    }

    if (startNumber < 1) {
      setError("Starting page number must be 1 or higher.");
      return;
    }

    onProcess({
      position,
      startNumber,
      fontSize,
      format: activeFormat.trim(),
      color,
      pages: skipFirstPage ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] : "all",
    });
  };

  const previewText = activeFormat
    .replace(/\{n\}/g, String(startNumber))
    .replace(/\{total\}/g, "10");

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm transition-all">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl mb-3 shadow-xs">
          <ListOrdered className="w-6 h-6" />
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          Add Page Numbers
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-md mx-auto">
          Number your PDF pages cleanly with customizable position, starting numbers, and formatting.
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

      {/* Position Selector with Visual Paper Preview */}
      <div className="mb-6">
        <label className="text-sm font-bold text-foreground block mb-2">
          Position on Page
        </label>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2">
          {POSITIONS.map((pos) => {
            const isSelected = position === pos.id;
            return (
              <button
                key={pos.id}
                type="button"
                onClick={() => setPosition(pos.id)}
                className={`py-3 px-2 rounded-2xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? "border-red-500 bg-red-50/50 text-red-600 dark:bg-red-950/20 font-bold ring-2 ring-red-500/20 shadow-xs"
                    : "border-border text-muted-foreground hover:bg-muted/30 font-medium"
                }`}
              >
                <div className="text-xs sm:text-sm">{pos.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Format Selector */}
      <div className="mb-6">
        <label className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-2">
          <Sliders className="w-4 h-4 text-primary" />
          Number Format
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {FORMAT_PRESETS.map((preset) => {
            const isSelected = formatPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setFormatPreset(preset.id)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "border-red-500 bg-red-50/50 text-red-600 dark:bg-red-950/20 ring-2 ring-red-500/20"
                    : "border-border text-muted-foreground hover:bg-muted/30"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {formatPreset === "custom" && (
          <div className="p-3 bg-muted/40 rounded-xl border border-border/80 mb-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Custom Template (<span className="font-mono text-foreground font-bold">&#123;n&#125;</span> = page, <span className="font-mono text-foreground font-bold">&#123;total&#125;</span> = total)
            </label>
            <input
              type="text"
              value={customFormat}
              onChange={(e) => setCustomFormat(e.target.value)}
              placeholder="e.g. Doc Page {n} of {total}"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
        )}

        {/* Live Preview Pill */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-xl text-xs">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Live Preview:
          </span>
          <span className="font-mono font-bold text-foreground">{previewText}</span>
        </div>
      </div>

      {/* Start Number & Font Size */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Start Number
          </label>
          <input
            type="number"
            min="1"
            value={startNumber}
            onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Font Size ({fontSize} pt)
          </label>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          >
            <option value="9">9 pt (Small)</option>
            <option value="11">11 pt (Standard)</option>
            <option value="12">12 pt (Medium)</option>
            <option value="14">14 pt (Large)</option>
            <option value="16">16 pt (Extra Large)</option>
          </select>
        </div>
      </div>

      {/* Options: Skip Cover Page & Color */}
      <div className="flex items-center justify-between p-3.5 bg-muted/30 rounded-2xl border border-border/80 mb-6">
        <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-medium text-foreground select-none">
          <input
            type="checkbox"
            checked={skipFirstPage}
            onChange={(e) => setSkipFirstPage(e.target.checked)}
            className="rounded border-input text-red-600 focus:ring-red-500 w-4 h-4"
          />
          Skip First Page (Cover page)
        </label>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Color:</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-7 h-7 rounded-lg border border-input cursor-pointer bg-transparent"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        className="w-full h-12 rounded-xl font-bold text-base shadow-sm bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
      >
        <span>Add Page Numbers to PDF</span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
