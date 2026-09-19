"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Scissors } from "lucide-react";

interface SplitConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function SplitConfig({ files, onProcess }: SplitConfigProps) {
  const [startPage, setStartPage] = useState("1");
  const [endPage, setEndPage] = useState("2");

  return (
    <div className="w-full max-w-xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-orange-100 rounded-full mb-4 text-orange-600">
          <Scissors className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Split PDF</h3>
        <p className="text-muted-foreground mt-2">
          File: <span className="font-medium text-foreground">{files[0]?.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Start Page</label>
          <input
            type="number"
            value={startPage}
            onChange={(e) => setStartPage(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="1"
            min="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">End Page</label>
          <input
            type="number"
            value={endPage}
            onChange={(e) => setEndPage(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="2"
            min="1"
          />
        </div>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={() => onProcess({ startPage, endPage })} 
          className="w-full h-10 rounded-lg font-bold shadow-sm"
          disabled={!startPage || !endPage}
        >
          Split PDF
        </Button>
      </div>
    </div>
  );
}
