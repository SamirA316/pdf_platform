"use client";

import { useState, useCallback } from "react";
import { HardDrive, Cloud, ChevronDown, Link as LinkIcon, Image as ImageIcon, Box, UploadCloud, FileType2, Shield, Zap } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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

  const isImage = accept.includes("jpg") || accept.includes("png");
  const fileType = isImage ? "Image" : "PDF";

  const triggerUpload = () => {
    document.getElementById('file-upload')?.click();
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-6">
      <div 
        className={`relative w-full transition-all duration-300 ease-in-out flex flex-col items-center justify-center py-10 px-6 md:px-10 rounded-[2rem] border-2 border-dashed ${
          isDragging 
            ? "bg-primary/5 border-primary shadow-xl scale-[1.02]" 
            : "bg-white border-border shadow-sm hover:border-primary/40 hover:bg-gray-50/50 hover:shadow-md"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2rem]">
          <div className={`absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent transition-opacity duration-500 ${isDragging ? 'opacity-100' : 'opacity-0'}`} />
        </div>

        <div className="flex flex-col items-center justify-center relative z-10 w-full">
          
          <div className={`mb-4 p-4 rounded-full transition-colors duration-300 ${isDragging ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'}`}>
            {isImage ? <ImageIcon className="w-10 h-10" strokeWidth={1.5} /> : <FileType2 className="w-10 h-10" strokeWidth={1.5} />}
          </div>

          <h3 className="text-2xl md:text-3xl font-extrabold text-[#33333B] tracking-tight text-center mb-2">
            Upload your {fileType} files
          </h3>
          <p className="text-gray-500 mb-6 text-center text-sm md:text-base font-medium max-w-md">
            Drag and drop your files here, or use the button below to browse your computer or cloud storage.
          </p>

          {/* Split Button Container - Modernized */}
          <div className="flex shadow-sm rounded-xl overflow-hidden transition-all hover:shadow-md border border-[#D42A25] group/btn">
            <button 
              className="bg-[#E5322D] hover:bg-[#D42A25] text-white font-bold text-base md:text-lg px-8 py-3 flex-1 whitespace-nowrap outline-none transition-colors flex items-center gap-2"
              onClick={triggerUpload}
            >
              <UploadCloud className="w-5 h-5" />
              Select {fileType} files
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger className="bg-[#E5322D] hover:bg-[#D42A25] text-white px-3 flex items-center justify-center outline-none border-l border-white/20 transition-colors">
                <ChevronDown className="w-5 h-5 opacity-90 group-hover/btn:opacity-100" strokeWidth={2.5} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-gray-100 shadow-xl mt-2 font-medium text-[#4A4A55]">
                {isImage ? (
                  <>
                    <DropdownMenuItem onClick={triggerUpload} className="cursor-pointer py-3 px-4 text-sm focus:bg-red-50 focus:text-red-600 rounded-lg">
                      <ImageIcon className="w-4 h-4 mr-3 text-indigo-500" />
                      <span>Photo Gallery</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={triggerUpload} className="cursor-pointer py-3 px-4 text-sm focus:bg-red-50 focus:text-red-600 rounded-lg">
                      <HardDrive className="w-4 h-4 mr-3 text-gray-500" />
                      <span>Local Storage</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-100 my-1" />
                    <DropdownMenuItem onClick={triggerUpload} className="cursor-pointer py-3 px-4 text-sm focus:bg-red-50 focus:text-red-600 rounded-lg">
                      <Cloud className="w-4 h-4 mr-3 text-blue-500" />
                      <span>Google Photos</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={triggerUpload} className="cursor-pointer py-3 px-4 text-sm focus:bg-red-50 focus:text-red-600 rounded-lg">
                      <HardDrive className="w-4 h-4 mr-3 text-gray-500" />
                      <span>Local Device</span>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator className="bg-gray-100 my-1" />
                <DropdownMenuItem onClick={triggerUpload} className="cursor-pointer py-3 px-4 text-sm focus:bg-red-50 focus:text-red-600 rounded-lg">
                  <Cloud className="w-4 h-4 mr-3 text-blue-500" />
                  <span>Google Drive</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={triggerUpload} className="cursor-pointer py-3 px-4 text-sm focus:bg-red-50 focus:text-red-600 rounded-lg">
                  <Box className="w-4 h-4 mr-3 text-blue-600" />
                  <span>Dropbox</span>
                </DropdownMenuItem>
                {!isImage && (
                  <DropdownMenuItem onClick={triggerUpload} className="cursor-pointer py-3 px-4 text-sm focus:bg-red-50 focus:text-red-600 rounded-lg">
                    <LinkIcon className="w-4 h-4 mr-3 text-green-600" />
                    <span>From URL</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="mt-5 flex items-center justify-center gap-6 text-xs font-semibold text-gray-400">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> Secure encryption</span>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> Fast processing</span>
            <span className="hidden sm:flex items-center gap-1.5">Max {maxSizeMB}MB</span>
          </div>

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
    </div>
  );
}
