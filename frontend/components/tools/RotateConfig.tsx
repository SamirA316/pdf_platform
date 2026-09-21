"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw, RotateCcw, RefreshCw, FileText, Layers, CheckSquare, AlertCircle } from "lucide-react";

interface RotateConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function RotateConfig({ files, onProcess }: RotateConfigProps) {
  const [mode, setMode] = useState<"all" | "selective">("all");
  const [rotation, setRotation] = useState<number>(90);
  const [pagesInput, setPagesInput] = useState<string>("1");
  const [selectiveAngle, setSelectiveAngle] = useState<number>(90);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
    setValidationError(null);
  };

  const handleRotateLeft = () => {
    setRotation((prev) => ((prev - 90) % 360 + 360) % 360);
    setValidationError(null);
  };

  const handleFlip180 = () => {
    setRotation((prev) => (prev + 180) % 360);
    setValidationError(null);
  };

  const handleReset = () => {
    setRotation(0);
    setValidationError(null);
  };

  const handleSubmit = () => {
    setValidationError(null);

    if (mode === "all") {
      if (rotation % 360 === 0) {
        setValidationError("Please select a rotation angle (e.g. 90°, 180°, or 270°). Current angle is 0°.");
        return;
      }
      onProcess({
        rotation: rotation % 360,
      });
    } else {
      const rawParts = pagesInput.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      if (rawParts.length === 0) {
        setValidationError("Please specify at least one page number.");
        return;
      }

      const parsedPages: number[] = [];
      for (const part of rawParts) {
        if (!/^\d+$/.test(part)) {
          setValidationError(`'${part}' is not a valid page number. Only positive digits are allowed.`);
          return;
        }
        const num = Number(part);
        if (num < 1) {
          setValidationError("Page numbers must be at least 1.");
          return;
        }
        parsedPages.push(num);
      }

      const unique = new Set(parsedPages);
      if (unique.size !== parsedPages.length) {
        setValidationError("Duplicate page numbers are not permitted.");
        return;
      }

      const rotations = parsedPages.map((page) => ({
        page,
        rotation: selectiveAngle,
      }));

      onProcess({
        rotations,
      });
    }
  };

  const fileName = files[0]?.name || "document.pdf";

  const getRotationLabel = (deg: number) => {
    switch (deg % 360) {
      case 90:
        return "90° Clockwise";
      case 180:
        return "180° Flip";
      case 270:
        return "270° (90° Counter-Clockwise)";
      default:
        return "0° (Original Orientation)";
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-purple-50 text-purple-600 rounded-full mb-3 shadow-xs">
          <RotateCw className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-extrabold text-foreground">Rotate PDF Pages</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Source file: <span className="font-semibold text-foreground">{fileName}</span>
        </p>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-muted/60 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => {
            setMode("all");
            setValidationError(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            mode === "all"
              ? "bg-white text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span>Rotate All Pages</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("selective");
            setValidationError(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            mode === "selective"
              ? "bg-white text-foreground shadow-xs font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckSquare className="w-4 h-4 shrink-0" />
          <span>Select Specific Pages</span>
        </button>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2.5 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Mode 1: All Pages */}
      {mode === "all" && (
        <div className="space-y-6 mb-8">
          {/* Interactive Document Preview */}
          <div className="flex flex-col items-center justify-center p-6 bg-muted/30 border border-border rounded-2xl">
            <div
              className="relative w-36 sm:w-44 aspect-[1/1.35] bg-white border-2 border-purple-200 shadow-md rounded-xl flex flex-col items-center justify-center transition-transform duration-300 overflow-hidden"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <FileText className="w-12 h-12 text-purple-500/70 mb-2" />
              <div className="w-20 h-2 bg-gray-200 rounded mb-1" />
              <div className="w-16 h-2 bg-gray-200 rounded mb-1" />
              <div className="w-12 h-2 bg-gray-200 rounded" />
              <span className="absolute bottom-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                PAGE TOP
              </span>
            </div>

            <div className="mt-5 inline-flex items-center gap-2 px-3 py-1 bg-purple-100/80 text-purple-700 rounded-full text-xs font-bold">
              <span>{getRotationLabel(rotation)}</span>
            </div>
          </div>

          {/* Quick Rotation Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={handleRotateRight}
              className="p-3 bg-background border border-border hover:border-purple-300 hover:bg-purple-50/50 rounded-xl text-xs font-bold text-foreground flex flex-col items-center gap-1.5 transition-all active:scale-95"
            >
              <RotateCw className="w-5 h-5 text-purple-600" />
              <span>Right (+90°)</span>
            </button>

            <button
              type="button"
              onClick={handleRotateLeft}
              className="p-3 bg-background border border-border hover:border-purple-300 hover:bg-purple-50/50 rounded-xl text-xs font-bold text-foreground flex flex-col items-center gap-1.5 transition-all active:scale-95"
            >
              <RotateCcw className="w-5 h-5 text-purple-600" />
              <span>Left (-90°)</span>
            </button>

            <button
              type="button"
              onClick={handleFlip180}
              className="p-3 bg-background border border-border hover:border-purple-300 hover:bg-purple-50/50 rounded-xl text-xs font-bold text-foreground flex flex-col items-center gap-1.5 transition-all active:scale-95"
            >
              <RefreshCw className="w-5 h-5 text-purple-600" />
              <span>Flip (180°)</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-3 bg-background border border-border hover:border-gray-300 hover:bg-gray-50 rounded-xl text-xs font-bold text-muted-foreground flex flex-col items-center gap-1.5 transition-all active:scale-95"
            >
              <span className="text-sm font-extrabold leading-5">0°</span>
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Selective Per-Page */}
      {mode === "selective" && (
        <div className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Pages to Rotate
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
              Enter specific page numbers separated by commas (e.g. <strong>1, 3</strong>). Unspecified pages will remain in their original orientation.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Rotation Angle for Selected Pages
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { angle: 90, label: "90° Clockwise" },
                { angle: 180, label: "180° Flip" },
                { angle: 270, label: "270° Counter" },
              ].map((item) => (
                <button
                  key={item.angle}
                  type="button"
                  onClick={() => setSelectiveAngle(item.angle)}
                  className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all ${
                    selectiveAngle === item.angle
                      ? "border-purple-600 bg-purple-50 text-purple-700 shadow-xs"
                      : "border-border bg-background text-foreground hover:bg-muted/50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        className="w-full h-12 rounded-xl font-bold text-base bg-purple-600 hover:bg-purple-700 text-white shadow-md active:scale-98 transition-all"
      >
        <RotateCw className="w-4 h-4 mr-2" />
        Rotate PDF Now
      </Button>
    </div>
  );
}
