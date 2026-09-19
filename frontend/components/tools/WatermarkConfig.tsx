"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Stamp } from "lucide-react";

interface WatermarkConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function WatermarkConfig({ files, onProcess }: WatermarkConfigProps) {
  const [text, setText] = useState("CONFIDENTIAL");

  return (
    <div className="w-full max-w-xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-red-100 rounded-full mb-4 text-red-600">
          <Stamp className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Add Watermark</h3>
        <p className="text-muted-foreground mt-2">
          File: <span className="font-medium text-foreground">{files[0]?.name}</span>
        </p>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-foreground mb-2">Watermark Text</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder="Enter text..."
        />
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={() => onProcess({ text })} 
          className="w-full h-10 rounded-lg font-bold shadow-sm"
          disabled={!text}
        >
          Add Watermark
        </Button>
      </div>
    </div>
  );
}
