"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

interface ResizeConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function ResizeConfig({ files, onProcess }: ResizeConfigProps) {
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [maintainRatio, setMaintainRatio] = useState(true);

  return (
    <div className="w-full max-w-xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-primary/10 rounded-full mb-4 text-primary">
          <Settings2 className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Resize Image</h3>
        <p className="text-muted-foreground mt-2">
          File: <span className="font-medium text-foreground">{files[0]?.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Width (px)</label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="e.g. 1920"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Height (px)</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="e.g. 1080"
          />
        </div>
      </div>

      <div className="flex items-center mb-8">
        <input
          type="checkbox"
          id="ratio"
          checked={maintainRatio}
          onChange={(e) => setMaintainRatio(e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
        <label htmlFor="ratio" className="ml-2 text-sm text-foreground">
          Maintain aspect ratio
        </label>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={() => onProcess({ width, height, maintainRatio })} 
          className="w-full h-10 rounded-lg font-bold shadow-sm"
          disabled={!width && !height}
        >
          Resize Image
        </Button>
      </div>
    </div>
  );
}
