"use client";

import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface BasicConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
  title: string;
}

export function BasicConfig({ files, onProcess, title }: BasicConfigProps) {
  return (
    <div className="w-full max-w-xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm text-center">
      <div className="inline-flex p-3 bg-primary/10 rounded-full mb-6 text-primary">
        <Zap className="w-6 h-6" />
      </div>
      
      <h3 className="text-2xl font-bold text-foreground mb-4">Ready to {title}</h3>
      
      <p className="text-muted-foreground mb-8">
        File: <span className="font-medium text-foreground">{files[0]?.name}</span>
      </p>

      <Button onClick={() => onProcess({})} className="w-full h-10 rounded-lg font-bold shadow-sm max-w-xs mx-auto">
        Process File
      </Button>
    </div>
  );
}
