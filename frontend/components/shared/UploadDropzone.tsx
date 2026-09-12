"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadDropzoneProps {
  onUpload?: (files: FileList | null) => void;
  accept?: string;
  maxSizeMB?: number;
  allowMultiple?: boolean;
}

export function UploadDropzone({ 
  onUpload, 
  accept = ".pdf",
  maxSizeMB = 10,
  allowMultiple = false
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload?.(e.dataTransfer.files);
    }
  }, [onUpload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload?.(e.target.files);
    }
  };

  return (
    <div 
      className={`w-full max-w-3xl mx-auto rounded-3xl border-2 border-dashed transition-all duration-200 ease-in-out flex flex-col items-center justify-center p-12 shadow-sm ${
        isDragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50 hover:bg-secondary/20"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 pointer-events-none">
        <Upload className="w-8 h-8 text-primary" strokeWidth={1.5} />
      </div>
      
      <h3 className="text-xl md:text-2xl font-semibold mb-3 text-foreground tracking-tight pointer-events-none">
        Choose {allowMultiple ? "files" : "a file"} or drag & drop it here
      </h3>
      
      <p className="text-muted-foreground mb-8 pointer-events-none">
        Accepts {accept.replace(/\./g, '').split(',').join(', ')} up to {maxSizeMB}MB
      </p>
      
      <div className="flex gap-4">
        <Button 
          size="lg" 
          className="rounded-full px-8 shadow-sm"
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          Select {allowMultiple ? "Files" : "File"}
        </Button>
      </div>
      
      <input 
        type="file" 
        id="file-upload" 
        className="hidden" 
        onChange={handleFileSelect}
        accept={accept}
        multiple={allowMultiple}
      />
    </div>
  );
}
