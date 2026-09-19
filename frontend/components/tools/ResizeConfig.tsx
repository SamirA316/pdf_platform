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

        {/* Removed width and height fields as backend expects "size" string like "A4" or "Letter" */}

      <div className="flex justify-center">
        <Button 
          onClick={() => onProcess({ size: "A4" })} 
          className="w-full h-10 rounded-lg font-bold shadow-sm"
        >
          Resize PDF to A4
        </Button>
      </div>
    </div>
  );
}
