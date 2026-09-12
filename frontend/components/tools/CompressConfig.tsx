"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Shrink, Zap, Shield, HelpCircle } from "lucide-react";

interface CompressConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function CompressConfig({ files, onProcess }: CompressConfigProps) {
  const [level, setLevel] = useState<"extreme" | "recommended" | "less">("recommended");

  return (
    <div className="w-full max-w-3xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-primary/10 rounded-full mb-4 text-primary">
          <Shrink className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Select Compression Level</h3>
        <p className="text-muted-foreground mt-2">
          File: <span className="font-medium text-foreground">{files[0]?.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Extreme */}
        <button
          onClick={() => setLevel("extreme")}
          className={`flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all ${
            level === "extreme" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
          }`}
        >
          <Zap className={`w-8 h-8 mb-3 ${level === "extreme" ? "text-primary" : "text-muted-foreground"}`} />
          <h4 className="font-semibold mb-1">Extreme</h4>
          <p className="text-xs text-muted-foreground">Smallest size, lower quality.</p>
        </button>

        {/* Recommended */}
        <button
          onClick={() => setLevel("recommended")}
          className={`flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all relative ${
            level === "recommended" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
          }`}
        >
          {level === "recommended" && (
            <div className="absolute top-0 right-4 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
              DEFAULT
            </div>
          )}
          <Shield className={`w-8 h-8 mb-3 ${level === "recommended" ? "text-primary" : "text-muted-foreground"}`} />
          <h4 className="font-semibold mb-1">Recommended</h4>
          <p className="text-xs text-muted-foreground">Good quality, good compression.</p>
        </button>

        {/* Less */}
        <button
          onClick={() => setLevel("less")}
          className={`flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all ${
            level === "less" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
          }`}
        >
          <HelpCircle className={`w-8 h-8 mb-3 ${level === "less" ? "text-primary" : "text-muted-foreground"}`} />
          <h4 className="font-semibold mb-1">Less Compression</h4>
          <p className="text-xs text-muted-foreground">High quality, larger file size.</p>
        </button>
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={() => onProcess({ level })} className="rounded-full px-12 shadow-sm">
          Compress File
        </Button>
      </div>
    </div>
  );
}
