"use client";

import { Button } from "@/components/ui/button";
import { FileText, X, Plus, Layers } from "lucide-react";

interface MergeConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
  onAddMore: () => void;
  onRemoveFile: (index: number) => void;
}

export function MergeConfig({ files, onProcess, onAddMore, onRemoveFile }: MergeConfigProps) {
  return (
    <div className="w-full max-w-3xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-primary/10 rounded-full mb-4 text-primary">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Merge Files</h3>
        <p className="text-muted-foreground mt-2">
          {files.length} files selected. You can add more files before merging them into one.
        </p>
      </div>

      <div className="space-y-3 mb-8 max-h-[300px] overflow-y-auto pr-2">
        {files.map((file, i) => (
          <div key={`${file.name}-${i}`} className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border">
            <div className="flex items-center space-x-3 overflow-hidden">
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="font-medium text-foreground truncate">{file.name}</span>
            </div>
            <button 
              onClick={() => onRemoveFile(i)}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors ml-4"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button variant="outline" size="lg" onClick={onAddMore} className="rounded-full flex-1">
          <Plus className="w-4 h-4 mr-2" /> Add More Files
        </Button>
        <Button size="lg" onClick={onProcess} className="rounded-full flex-1 shadow-sm" disabled={files.length < 2}>
          Merge {files.length} Files
        </Button>
      </div>
      
      {files.length < 2 && (
        <p className="text-center text-sm text-destructive mt-4">
          Please add at least 2 files to merge.
        </p>
      )}
    </div>
  );
}
