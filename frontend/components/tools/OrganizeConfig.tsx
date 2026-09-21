"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Copy,
  Trash2,
  RefreshCw,
  FileText,
  AlertCircle,
  Layers,
} from "lucide-react";

interface OrganizeConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

interface PageItem {
  id: string;
  sourcePage: number;
  rotation: number;
}

export function OrganizeConfig({ files, onProcess }: OrganizeConfigProps) {
  // Default with 5 initial pages or single page
  const [pages, setPages] = useState<PageItem[]>([
    { id: "p1", sourcePage: 1, rotation: 0 },
    { id: "p2", sourcePage: 2, rotation: 0 },
    { id: "p3", sourcePage: 3, rotation: 0 },
    { id: "p4", sourcePage: 4, rotation: 0 },
  ]);
  const [quickInput, setQuickInput] = useState("");
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleMoveLeft = (index: number) => {
    if (index === 0) return;
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1]!;
      copy[index - 1] = copy[index]!;
      copy[index] = temp;
      return copy;
    });
    setValidationError(null);
  };

  const handleMoveRight = (index: number) => {
    if (index === pages.length - 1) return;
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1]!;
      copy[index + 1] = copy[index]!;
      copy[index] = temp;
      return copy;
    });
    setValidationError(null);
  };

  const handleRotatePage = (index: number) => {
    setPages((prev) => {
      const copy = [...prev];
      const item = copy[index]!;
      copy[index] = { ...item, rotation: (item.rotation + 90) % 360 };
      return copy;
    });
    setValidationError(null);
  };

  const handleDuplicatePage = (index: number) => {
    if (pages.length >= 50) {
      setValidationError("Cannot exceed 50 pages in interactive organizer.");
      return;
    }
    setPages((prev) => {
      const copy = [...prev];
      const item = copy[index]!;
      const newItem: PageItem = {
        id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sourcePage: item.sourcePage,
        rotation: item.rotation,
      };
      copy.splice(index + 1, 0, newItem);
      return copy;
    });
    setValidationError(null);
  };

  const handleDeletePage = (index: number) => {
    if (pages.length <= 1) {
      setValidationError("At least one page must remain in the document.");
      return;
    }
    setPages((prev) => prev.filter((_, i) => i !== index));
    setValidationError(null);
  };

  const handleReset = () => {
    setPages([
      { id: "p1", sourcePage: 1, rotation: 0 },
      { id: "p2", sourcePage: 2, rotation: 0 },
      { id: "p3", sourcePage: 3, rotation: 0 },
      { id: "p4", sourcePage: 4, rotation: 0 },
    ]);
    setValidationError(null);
  };

  const handleSubmit = () => {
    setValidationError(null);

    if (isQuickMode) {
      const rawParts = quickInput.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      if (rawParts.length === 0) {
        setValidationError("Please specify at least one page number in the order list.");
        return;
      }

      const parsedOrder: Array<{ sourcePage: number; rotation: number }> = [];
      for (const part of rawParts) {
        if (!/^\d+$/.test(part)) {
          setValidationError(`'${part}' is not a valid page number.`);
          return;
        }
        const pNum = Number(part);
        if (pNum < 1) {
          setValidationError("Page numbers must be >= 1.");
          return;
        }
        parsedOrder.push({ sourcePage: pNum, rotation: 0 });
      }

      onProcess({ pages: parsedOrder });
    } else {
      if (pages.length === 0) {
        setValidationError("At least one page must be included in the organized PDF.");
        return;
      }

      const formattedPages = pages.map((p) => ({
        sourcePage: p.sourcePage,
        rotation: p.rotation,
      }));

      onProcess({ pages: formattedPages });
    }
  };

  const fileName = files[0]?.name || "document.pdf";

  return (
    <div className="w-full max-w-4xl mx-auto bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-orange-50 text-orange-600 rounded-full mb-3 shadow-xs">
          <LayoutGrid className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-extrabold text-foreground">Organize PDF Pages</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Reorder, rotate, duplicate, or remove pages from:{" "}
          <span className="font-semibold text-foreground">{fileName}</span>
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsQuickMode(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !isQuickMode ? "bg-orange-500 text-white shadow-xs" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Visual Organizer
          </button>
          <button
            type="button"
            onClick={() => setIsQuickMode(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isQuickMode ? "bg-orange-500 text-white shadow-xs" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Quick Sequence Input
          </button>
        </div>

        {!isQuickMode && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2.5 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Visual Page Cards Grid */}
      {!isQuickMode ? (
        <div className="space-y-6 mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                className="bg-background border-2 border-border hover:border-orange-300 rounded-2xl p-4 flex flex-col items-center justify-between shadow-2xs transition-all relative group"
              >
                {/* Sequence badge */}
                <div className="w-full flex items-center justify-between text-xs font-extrabold text-muted-foreground mb-3">
                  <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-md">
                    Pos #{idx + 1}
                  </span>
                  <span className="text-[11px] text-gray-400">Src: P{p.sourcePage}</span>
                </div>

                {/* Page Thumbnail with Rotation */}
                <div className="my-2 flex items-center justify-center h-28 w-20 bg-muted/30 border border-border rounded-lg overflow-hidden transition-transform duration-300">
                  <div
                    className="flex flex-col items-center justify-center"
                    style={{ transform: `rotate(${p.rotation}deg)` }}
                  >
                    <FileText className="w-8 h-8 text-orange-500/70 mb-1" />
                    <span className="text-[10px] font-bold text-muted-foreground">P{p.sourcePage}</span>
                  </div>
                </div>

                {p.rotation > 0 && (
                  <span className="text-[10px] font-bold text-purple-600 mb-2">
                    {p.rotation}° Rotated
                  </span>
                )}

                {/* Action Toolbar */}
                <div className="w-full grid grid-cols-4 gap-1 pt-2 border-t border-border mt-2">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveLeft(idx)}
                    title="Move Left"
                    className="p-1.5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 rounded hover:bg-muted/60"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={idx === pages.length - 1}
                    onClick={() => handleMoveRight(idx)}
                    title="Move Right"
                    className="p-1.5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 rounded hover:bg-muted/60"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotatePage(idx)}
                    title="Rotate 90°"
                    className="p-1.5 flex items-center justify-center text-muted-foreground hover:text-purple-600 rounded hover:bg-purple-50"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicatePage(idx)}
                    title="Duplicate Page"
                    className="p-1.5 flex items-center justify-center text-muted-foreground hover:text-blue-600 rounded hover:bg-blue-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Delete button */}
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeletePage(idx)}
                    title="Delete Page"
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center shadow-xs transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Current output will contain <strong>{pages.length}</strong> pages in the exact sequence shown above.
          </p>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Custom Page Order
            </label>
            <input
              type="text"
              value={quickInput}
              onChange={(e) => {
                setQuickInput(e.target.value);
                setValidationError(null);
              }}
              placeholder="e.g. 3, 1, 5, 2, 4"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter the desired page sequence separated by commas. You can duplicate pages (e.g. <strong>1, 2, 2, 3</strong>) or reorder arbitrarily.
            </p>
          </div>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleSubmit}
        className="w-full h-12 rounded-xl font-bold text-base bg-orange-600 hover:bg-orange-700 text-white shadow-md active:scale-98 transition-all"
      >
        <LayoutGrid className="w-4 h-4 mr-2" />
        Organize & Save PDF
      </Button>
    </div>
  );
}
