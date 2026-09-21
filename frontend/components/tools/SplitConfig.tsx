"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Scissors, Plus, Trash2, Layers, CheckSquare, FileText, AlertCircle } from "lucide-react";

interface SplitConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

interface PageRange {
  start: string;
  end: string;
}

export function SplitConfig({ files, onProcess }: SplitConfigProps) {
  const [mode, setMode] = useState<"ranges" | "pages" | "every-page">("ranges");
  const [ranges, setRanges] = useState<PageRange[]>([
    { start: "1", end: "2" },
  ]);
  const [pagesInput, setPagesInput] = useState<string>("1, 3");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAddRange = () => {
    const lastRange = ranges[ranges.length - 1];
    let nextStart = "1";
    let nextEnd = "2";
    if (lastRange && !isNaN(parseInt(lastRange.end, 10))) {
      const endVal = parseInt(lastRange.end, 10);
      nextStart = String(endVal + 1);
      nextEnd = String(endVal + 2);
    }
    setRanges([...ranges, { start: nextStart, end: nextEnd }]);
    setValidationError(null);
  };

  const handleRemoveRange = (index: number) => {
    if (ranges.length <= 1) return;
    setRanges(ranges.filter((_, i) => i !== index));
    setValidationError(null);
  };

  const handleRangeChange = (index: number, field: "start" | "end", value: string) => {
    const updated = [...ranges];
    updated[index] = { ...updated[index]!, [field]: value };
    setRanges(updated);
    setValidationError(null);
  };

  const handleSubmit = () => {
    setValidationError(null);

    if (mode === "ranges") {
      const parsedRanges: Array<{ start: number; end: number }> = [];
      for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i]!;
        const startRaw = r.start.trim();
        const endRaw = r.end.trim();

        if (!/^\d+$/.test(startRaw) || !/^\d+$/.test(endRaw)) {
          setValidationError(`Range #${i + 1} must contain positive digits only without letters or symbols.`);
          return;
        }

        const start = Number(startRaw);
        const end = Number(endRaw);

        if (start < 1 || end < 1) {
          setValidationError(`Range #${i + 1}: Page numbers must be at least 1.`);
          return;
        }
        if (end < start) {
          setValidationError(`Range #${i + 1}: End page (${end}) cannot be less than Start page (${start}).`);
          return;
        }
        parsedRanges.push({ start, end });
      }

      // Check for overlapping ranges on client side for immediate feedback
      const sorted = [...parsedRanges].sort((a, b) => a.start - b.start);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i]!.end >= sorted[i + 1]!.start) {
          setValidationError("Page ranges must not overlap.");
          return;
        }
      }

      onProcess({
        mode: "ranges",
        ranges: parsedRanges,
      });
    } else if (mode === "pages") {
      const rawParts = pagesInput.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      if (rawParts.length === 0) {
        setValidationError("Please specify at least one page number.");
        return;
      }

      const parsedPages: number[] = [];
      for (const part of rawParts) {
        if (!/^\d+$/.test(part)) {
          setValidationError(`'${part}' is not a valid page number. Only positive digits are allowed (e.g. '2' instead of '2abc').`);
          return;
        }
        const num = Number(part);
        if (num < 1) {
          setValidationError(`Page numbers must be at least 1.`);
          return;
        }
        parsedPages.push(num);
      }

      // Check duplicates
      const unique = new Set(parsedPages);
      if (unique.size !== parsedPages.length) {
        setValidationError("Duplicate page selections are not allowed.");
        return;
      }

      onProcess({
        mode: "pages",
        pages: parsedPages,
      });
    } else if (mode === "every-page") {
      onProcess({
        mode: "every-page",
      });
    }
  };

  const fileName = files[0]?.name || "document.pdf";

  return (
    <div className="w-full max-w-2xl mx-auto bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-red-50 text-[#E5322D] rounded-full mb-3 shadow-xs">
          <Scissors className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-extrabold text-foreground">Split PDF</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Source file: <span className="font-semibold text-foreground">{fileName}</span>
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-muted/60 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => {
            setMode("ranges");
            setValidationError(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            mode === "ranges"
              ? "bg-white text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span>Page Ranges</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("pages");
            setValidationError(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            mode === "pages"
              ? "bg-white text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckSquare className="w-4 h-4 shrink-0" />
          <span>Select Pages</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("every-page");
            setValidationError(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            mode === "every-page"
              ? "bg-white text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Every Page</span>
        </button>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2.5 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Mode A: Ranges */}
      {mode === "ranges" && (
        <div className="space-y-4 mb-8">
          <div className="text-xs text-muted-foreground mb-2">
            Define custom page ranges to extract into separate PDF files.
          </div>
          {ranges.map((r, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 bg-background border border-border rounded-xl shadow-2xs"
            >
              <span className="text-xs font-bold text-muted-foreground w-16">
                Range {idx + 1}
              </span>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={r.start}
                  onChange={(e) => handleRangeChange(idx, "start", e.target.value)}
                  placeholder="From"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-muted-foreground text-xs font-semibold">to</span>
                <input
                  type="number"
                  min="1"
                  value={r.end}
                  onChange={(e) => handleRangeChange(idx, "end", e.target.value)}
                  placeholder="To"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {ranges.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveRange(idx)}
                  className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove Range"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddRange}
            className="w-full py-2.5 border-2 border-dashed border-border hover:border-foreground/40 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Range</span>
          </button>
        </div>
      )}

      {/* Mode B: Pages */}
      {mode === "pages" && (
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Pages to Extract
            </label>
            <input
              type="text"
              value={pagesInput}
              onChange={(e) => {
                setPagesInput(e.target.value);
                setValidationError(null);
              }}
              placeholder="e.g. 1, 3, 5"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter specific page numbers separated by commas (e.g. <strong>2, 5, 8</strong>). The selected pages will be extracted and saved into a single PDF document.
            </p>
          </div>
        </div>
      )}

      {/* Mode C: Every Page */}
      {mode === "every-page" && (
        <div className="mb-8 p-6 bg-muted/30 border border-border rounded-2xl text-center space-y-2">
          <FileText className="w-8 h-8 text-[#E5322D] mx-auto opacity-80" />
          <h4 className="text-sm font-bold text-foreground">Split every page individually</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Every page in your document will be separated into its own individual single-page PDF file.
          </p>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleSubmit}
        className="w-full h-12 rounded-xl font-bold text-base bg-[#E5322D] hover:bg-[#CC2A26] text-white shadow-md active:scale-98 transition-all"
      >
        <Scissors className="w-4 h-4 mr-2" />
        Split PDF Now
      </Button>
    </div>
  );
}
