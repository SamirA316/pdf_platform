"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Shrink, Zap, Shield, HelpCircle, Settings2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CompressConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function CompressConfig({ files, onProcess }: CompressConfigProps) {
  const [level, setLevel] = useState<"extreme" | "recommended" | "less" | "custom">("recommended");
  const [customSize, setCustomSize] = useState("");
  const [customUnit, setCustomUnit] = useState<"KB" | "MB">("KB");

  return (
    <div className="w-full max-w-4xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-primary/10 rounded-full mb-4 text-primary">
          <Shrink className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Select Compression Level</h3>
        <p className="text-muted-foreground mt-2">
          File: <span className="font-medium text-foreground">{files[0]?.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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

        {/* Custom */}
        <button
          onClick={() => setLevel("custom")}
          className={`flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all ${
            level === "custom" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
          }`}
        >
          <Settings2 className={`w-8 h-8 mb-3 ${level === "custom" ? "text-primary" : "text-muted-foreground"}`} />
          <h4 className="font-semibold mb-1">Custom Size</h4>
          <p className="text-xs text-muted-foreground">Specify exact file size.</p>
        </button>
      </div>

      {level === "custom" && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 py-4 px-6 bg-muted/30 rounded-2xl border border-border">
          <label className="text-sm font-semibold text-foreground">Target File Size:</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              className="w-32 px-4 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-center font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="e.g. 500"
            />
            <DropdownMenu>
              <DropdownMenuTrigger className="px-4 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold cursor-pointer flex items-center gap-2 hover:bg-muted/50 transition-colors">
                {customUnit}
                <ChevronDown className="w-4 h-4 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[80px]">
                <DropdownMenuItem onClick={() => setCustomUnit("KB")} className="font-semibold cursor-pointer justify-center">KB</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCustomUnit("MB")} className="font-semibold cursor-pointer justify-center">MB</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Button 
          onClick={() => onProcess({ 
            level, 
            customSize: level === 'custom' ? `${customSize}${customUnit}` : undefined 
          })} 
          className="h-10 rounded-lg font-bold px-12 shadow-sm"
          disabled={level === "custom" && !customSize}
        >
          Compress File
        </Button>
      </div>
    </div>
  );
}
