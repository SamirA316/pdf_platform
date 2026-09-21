"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadFileToV1 } from "@/lib/apiClient";
import {
  Stamp,
  FileText,
  Type,
  Image as ImageIcon,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  Compass,
  Palette,
} from "lucide-react";

interface WatermarkConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

const QUICK_TEXTS = ["CONFIDENTIAL", "DO NOT COPY", "DRAFT", "SAMPLE", "ORIGINAL"];

const POSITIONS = [
  { id: "top-left", label: "Top Left" },
  { id: "center", label: "Center" },
  { id: "top-right", label: "Top Right" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "bottom-right", label: "Bottom Right" },
] as const;

export function WatermarkConfig({ files, onProcess }: WatermarkConfigProps) {
  const [type, setType] = useState<"text" | "image">("text");

  // Text watermark state
  const [text, setText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState(40);
  const [color, setColor] = useState("#E5322D");

  // Image watermark state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scale, setScale] = useState(0.5);

  // Common options
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(45);
  const [position, setPosition] = useState<"center" | "top-left" | "top-right" | "bottom-left" | "bottom-right">("center");
  const [pagesMode, setPagesMode] = useState<"all" | "selected">("all");
  const [selectedPagesText, setSelectedPagesText] = useState("");

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, or JPEG).");
      return;
    }

    setError(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setError(null);

    let parsedPages: "all" | number[] = "all";
    if (pagesMode === "selected") {
      const parts = selectedPagesText
        .split(",")
        .map((p) => parseInt(p.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);
      if (parts.length === 0) {
        setError("Please enter at least one valid page number (e.g. 1, 2, 3).");
        return;
      }
      parsedPages = parts;
    }

    if (type === "text") {
      if (!text.trim()) {
        setError("Please enter watermark text.");
        return;
      }

      onProcess({
        type: "text",
        text: text.trim(),
        fontSize,
        color,
        opacity,
        rotation,
        position,
        pages: parsedPages,
      });
    } else if (type === "image") {
      if (!imageFile) {
        setError("Please choose a watermark image to stamp.");
        return;
      }

      try {
        setIsUploadingImage(true);
        const uploadedImg = await uploadFileToV1(imageFile);
        setIsUploadingImage(false);

        onProcess({
          type: "image",
          imageFileId: uploadedImg.id,
          scale,
          opacity,
          rotation,
          position,
          pages: parsedPages,
        });
      } catch (err: any) {
        setIsUploadingImage(false);
        setError(err.message || "Failed to upload watermark image. Please try again.");
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm transition-all">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl mb-3 shadow-xs">
          <Stamp className="w-6 h-6" />
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          Add Watermark to PDF
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-md mx-auto">
          Stamp text or an image over your PDF pages with customizable opacity, rotation, and alignment.
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

      {/* Watermark Type Selector (Text vs Image) */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setType("text")}
          className={`flex items-center justify-center gap-2 py-3 rounded-2xl border font-bold text-sm transition-all cursor-pointer ${
            type === "text"
              ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 text-red-600 dark:text-red-400 ring-2 ring-red-500/20 shadow-xs"
              : "border-border bg-card text-muted-foreground hover:bg-muted/30"
          }`}
        >
          <Type className="w-4 h-4" />
          Text Watermark
        </button>

        <button
          type="button"
          onClick={() => setType("image")}
          className={`flex items-center justify-center gap-2 py-3 rounded-2xl border font-bold text-sm transition-all cursor-pointer ${
            type === "image"
              ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 text-red-600 dark:text-red-400 ring-2 ring-red-500/20 shadow-xs"
              : "border-border bg-card text-muted-foreground hover:bg-muted/30"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Image Watermark
        </button>
      </div>

      {/* TEXT WATERMARK CONTROLS */}
      {type === "text" && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm font-bold text-foreground mb-1.5 block">
              Watermark Text
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. CONFIDENTIAL"
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_TEXTS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setText(chip)}
                  className="px-2.5 py-1 rounded-lg bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Font Size ({fontSize} pt)
                </label>
              </div>
              <input
                type="range"
                min="16"
                max="80"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" />
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-input cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono font-medium text-muted-foreground">{color}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE WATERMARK CONTROLS */}
      {type === "image" && (
        <div className="space-y-4 mb-6">
          <label className="text-sm font-bold text-foreground block">
            Watermark Image (PNG or JPEG)
          </label>
          <div className="relative border-2 border-dashed border-border rounded-2xl p-4 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleImageChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            {imagePreview ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={imagePreview}
                  alt="Watermark preview"
                  className="h-20 max-w-[200px] object-contain rounded-lg border bg-muted/40 p-1"
                />
                <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
                  {imageFile?.name}
                </span>
                <span className="text-[11px] text-primary font-bold">Click to change image</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <UploadCloud className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  Select watermark stamp image
                </span>
                <span className="text-xs text-muted-foreground">
                  PNG with transparency is recommended
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Image Scale ({Math.round(scale * 100)}%)
              </label>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      )}

      {/* COMMON CONTROLS: Opacity & Rotation */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Opacity ({Math.round(opacity * 100)}%)
          </label>
          <input
            type="range"
            min="0.05"
            max="0.9"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5" />
            Rotation ({rotation}°)
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 45, 90, 315].map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => setRotation(deg)}
                className={`py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  rotation === deg
                    ? "border-red-500 bg-red-50/50 text-red-600 dark:bg-red-950/20"
                    : "border-border text-muted-foreground hover:bg-muted/30"
                }`}
              >
                {deg === 315 ? "-45°" : `${deg}°`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Position Selector */}
      <div className="mb-6">
        <label className="text-sm font-bold text-foreground block mb-2">
          Stamp Position
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {POSITIONS.map((pos) => {
            const isSelected = position === pos.id;
            return (
              <button
                key={pos.id}
                type="button"
                onClick={() => setPosition(pos.id)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? "border-red-500 bg-red-50/50 text-red-600 dark:bg-red-950/20 font-bold ring-2 ring-red-500/20"
                    : "border-border text-muted-foreground hover:bg-muted/30 font-medium"
                }`}
              >
                <span className="text-xs">{pos.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Page Target */}
      <div className="mb-6">
        <label className="text-sm font-bold text-foreground block mb-2">
          Apply to Pages
        </label>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <button
            type="button"
            onClick={() => setPagesMode("all")}
            className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              pagesMode === "all"
                ? "border-red-500 bg-red-50/50 text-red-600 dark:bg-red-950/20 ring-2 ring-red-500/20"
                : "border-border text-muted-foreground hover:bg-muted/30"
            }`}
          >
            All Pages
          </button>
          <button
            type="button"
            onClick={() => setPagesMode("selected")}
            className={`py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              pagesMode === "selected"
                ? "border-red-500 bg-red-50/50 text-red-600 dark:bg-red-950/20 ring-2 ring-red-500/20"
                : "border-border text-muted-foreground hover:bg-muted/30"
            }`}
          >
            Selected Pages
          </button>
        </div>
        {pagesMode === "selected" && (
          <input
            type="text"
            value={selectedPagesText}
            onChange={(e) => setSelectedPagesText(e.target.value)}
            placeholder="e.g. 1, 3, 5"
            className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        )}
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
        disabled={isUploadingImage}
        className="w-full h-12 rounded-xl font-bold text-base shadow-sm bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
      >
        <span>
          {isUploadingImage ? "Uploading Watermark Image..." : "Apply Watermark to PDF"}
        </span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
