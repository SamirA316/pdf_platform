"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileBadge, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

interface PdfaConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function PdfaConfig({ files, onProcess }: PdfaConfigProps) {
  const [version, setVersion] = useState<"PDF/A-1b" | "PDF/A-2b" | "PDF/A-3b">("PDF/A-2b");

  const versions = [
    {
      id: "PDF/A-2b" as const,
      name: "PDF/A-2b",
      badge: "Recommended",
      standard: "ISO 19005-2:2011",
      description: "Modern archival standard with transparency support, vector graphics, and standard color profiles.",
    },
    {
      id: "PDF/A-1b" as const,
      name: "PDF/A-1b",
      badge: "Legacy Baseline",
      standard: "ISO 19005-1:2005",
      description: "Strict visual preservation baseline suitable for legacy systems and government document repositories.",
    },
    {
      id: "PDF/A-3b" as const,
      name: "PDF/A-3b",
      badge: "Universal",
      standard: "ISO 19005-3:2012",
      description: "Next-gen archival allowing arbitrary embedded file attachments (e.g. XML invoices & ZUGFeRD).",
    },
  ];

  const handleConvert = () => {
    onProcess({ version });
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white dark:bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm transition-all">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl mb-3 shadow-xs">
          <FileBadge className="w-6 h-6" />
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          Convert to PDF/A Standard
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-md mx-auto">
          Transform standard PDFs into ISO-compliant PDF/A archival documents for permanent digital preservation.
        </p>
        {files[0] && (
          <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 bg-muted/60 rounded-full text-xs font-medium text-foreground">
            <span className="truncate max-w-[260px] font-semibold">{files[0].name}</span>
            <span className="text-muted-foreground">
              ({(files[0].size / (1024 * 1024)).toFixed(2)} MB)
            </span>
          </div>
        )}
      </div>

      {/* Version Selector */}
      <div className="space-y-3 mb-8">
        <label className="block text-sm font-bold text-foreground">
          Select Archival Conformance Standard
        </label>
        <div className="grid grid-cols-1 gap-3">
          {versions.map((item) => {
            const isSelected = version === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setVersion(item.id)}
                className={`flex items-start justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-xs"
                    : "border-border hover:border-muted-foreground/30 bg-background"
                }`}
              >
                <div className="space-y-1 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">{item.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-semibold text-muted-foreground">
                      {item.standard}
                    </span>
                    {item.badge === "Recommended" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <div className="mt-1">
                  {isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compliance Guarantee Notice */}
      <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 mb-6 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Embeds standard sRGB OutputIntent profile and ISO 19005 XMP identification metadata. Unencrypted archive format guaranteed.
        </p>
      </div>

      {/* Convert Action Button */}
      <Button
        onClick={handleConvert}
        className="w-full h-12 rounded-xl text-base font-bold shadow-sm hover:shadow-md transition-all gap-2"
      >
        <span>Convert to {version}</span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
