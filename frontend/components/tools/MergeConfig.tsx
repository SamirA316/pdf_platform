"use client";

import { Button } from "@/components/ui/button";
import { FileText, X, Layers, ChevronUp, ChevronDown } from "lucide-react";

interface MergeConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
  onAddMore: () => void;
  onRemoveFile: (index: number) => void;
  onMoveFile?: (fromIndex: number, toIndex: number) => void;
}

export function MergeConfig({ files, onProcess, onAddMore, onRemoveFile, onMoveFile }: MergeConfigProps) {
  const handleMoveUp = (index: number) => {
    if (index > 0 && onMoveFile) {
      onMoveFile(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < files.length - 1 && onMoveFile) {
      onMoveFile(index, index + 1);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-primary/10 rounded-full mb-4 text-primary">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Merge Files</h3>
        <p className="text-muted-foreground mt-2">
          {files.length} {files.length === 1 ? "file" : "files"} selected. Reorder files to define the merge sequence.
        </p>
      </div>

      <div className="space-y-3 mb-8 max-h-[360px] overflow-y-auto pr-2">
        {files.map((file, i) => (
          <div
            key={`${file.name}-${i}`}
            className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl border border-border transition-colors hover:bg-secondary/30"
          >
            <div className="flex items-center space-x-3 overflow-hidden flex-1 mr-4">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="overflow-hidden">
                <span className="font-medium text-foreground truncate block">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1 flex-shrink-0">
              {onMoveFile && (
                <>
                  <button
                    type="button"
                    onClick={() => handleMoveUp(i)}
                    disabled={i === 0}
                    className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-secondary/50"
                    title="Move Up"
                    aria-label="Move Up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(i)}
                    disabled={i === files.length - 1}
                    className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-secondary/50"
                    title="Move Down"
                    aria-label="Move Down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onRemoveFile(i)}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors ml-2 rounded-lg hover:bg-destructive/10"
                title="Remove file"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-8 pt-6 border-t border-border">
        <Button variant="outline" onClick={onAddMore} className="h-10 rounded-lg font-bold flex-1">
          + Add More
        </Button>
        <Button
          onClick={() => onProcess()}
          className="h-10 rounded-lg font-bold flex-1 shadow-sm"
          disabled={files.length < 2}
        >
          Merge PDFs
        </Button>
      </div>

      {files.length < 2 && (
        <p className="text-center text-sm text-destructive mt-4 font-medium">
          Please add at least 2 files to merge.
        </p>
      )}
    </div>
  );
}
