"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw, FileText } from "lucide-react";

interface RotateConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function RotateConfig({ files, onProcess }: RotateConfigProps) {
  // Mocking 5 pages for the uploaded PDF
  const [pageRotations, setPageRotations] = useState<number[]>([0, 0, 0, 0, 0]);

  const handleRotatePage = (index: number) => {
    const newRotations = [...pageRotations];
    newRotations[index] = (newRotations[index] + 90) % 360;
    setPageRotations(newRotations);
  };

  const handleRotateAll = () => {
    const newRotations = pageRotations.map(rot => (rot + 90) % 360);
    setPageRotations(newRotations);
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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 mb-8">
        {pageRotations.map((rotation, index) => (
          <div key={index} className="flex flex-col items-center group">
            <div 
              className="relative w-full aspect-[1/1.4] bg-white border-2 border-border shadow-sm rounded-lg flex items-center justify-center transition-all duration-300 hover:border-primary/50 overflow-hidden"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <div className="text-muted-foreground/30 flex flex-col items-center">
                <FileText className="w-12 h-12 mb-2" />
                <span className="font-bold text-lg">{index + 1}</span>
              </div>
              
              {/* Rotate overlay button */}
              <button 
                onClick={() => handleRotatePage(index)}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                style={{ transform: `rotate(${-rotation}deg)` }} // keep icon upright
                aria-label={`Rotate page ${index + 1}`}
              >
                <div className="bg-white p-2 rounded-full text-black hover:bg-gray-200 transition-colors shadow-lg">
                  <RotateCw className="w-6 h-6" />
                </div>
              </button>
            </div>
            <span className="mt-3 text-sm font-semibold text-muted-foreground">Page {index + 1}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-8 pt-6 border-t border-border">
        <Button onClick={() => onProcess({ rotations: pageRotations })} className="h-12 px-12 rounded-xl text-lg font-bold shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground">
          Apply Changes
        </Button>
      </div>
    </div>
  );
}
