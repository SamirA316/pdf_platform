"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw, FileText } from "lucide-react";

interface RotateConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function RotateConfig({ files, onProcess }: RotateConfigProps) {
  const [angle, setAngle] = useState<number>(0);

  const handleRotateAll = () => {
    setAngle((prev) => (prev + 90) % 360);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-purple-100 rounded-full mb-4 text-purple-600">
          <RotateCw className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Rotate PDF Pages</h3>
        <p className="text-muted-foreground mt-2">
          Hover over a page to rotate it individually, or rotate all pages at once.
        </p>
        <p className="text-sm font-semibold text-primary mt-2">File: {files[0]?.name}</p>
      </div>

      <div className="flex justify-end mb-6">
        <Button variant="outline" onClick={handleRotateAll} className="flex items-center gap-2">
          <RotateCw className="w-4 h-4" />
          Rotate All Pages
        </Button>
      </div>

      <div className="flex justify-center mb-8">
        <div 
          className="relative w-48 aspect-[1/1.4] bg-white border-2 border-border shadow-sm rounded-lg flex items-center justify-center transition-all duration-300 hover:border-primary/50 overflow-hidden"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="text-muted-foreground/30 flex flex-col items-center">
            <FileText className="w-16 h-16 mb-2" />
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-8 pt-6 border-t border-border">
        <Button onClick={() => onProcess({ angle })} className="h-12 px-12 rounded-xl text-lg font-bold shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground">
          Apply Changes
        </Button>
      </div>
    </div>
  );
}
