"use client";

import { useState } from "react";
import { UploadDropzone } from "@/components/shared/UploadDropzone";
import { ProgressState, ResultCard, ErrorState } from "@/components/shared/StateCards";
import { MergeConfig } from "@/components/tools/MergeConfig";
import { CompressConfig } from "@/components/tools/CompressConfig";
import { ProtectConfig } from "@/components/tools/ProtectConfig";
import { ResizeConfig } from "@/components/tools/ResizeConfig";
import { ChatConfig } from "@/components/tools/ChatConfig";
import { BasicConfig } from "@/components/tools/BasicConfig";
import { RotateConfig } from "@/components/tools/RotateConfig";
import { apiClient } from "@/lib/apiClient";
import { SplitConfig } from "@/components/tools/SplitConfig";
import { WatermarkConfig } from "@/components/tools/WatermarkConfig";
import { OrganizeConfig } from "@/components/tools/OrganizeConfig";

type FlowState = "upload" | "configure" | "processing" | "result" | "error";

interface ToolWorkspaceProps {
  slug: string;
  accept: string;
  maxSizeMB: number;
  actionType: "compress" | "merge" | "protect" | "resize" | "chat" | "rotate" | "basic";
  allowMultiple: boolean;
  title: string;
}

export function ToolWorkspace({ slug, accept, maxSizeMB, actionType, allowMultiple, title }: ToolWorkspaceProps) {
  const [flowState, setFlowState] = useState<FlowState>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);

  const handleUpload = (newFiles: FileList | null) => {
    if (newFiles && newFiles.length > 0) {
      const fileArray = Array.from(newFiles);
      
      // Enforce file size limit
      const hasOversized = fileArray.some(f => f.size > maxSizeMB * 1024 * 1024);
      if (hasOversized) {
        setFlowState("error");
        return;
      }
      
      if (allowMultiple) {
        setFiles(prev => [...prev, ...fileArray]);
      } else {
        setFiles([fileArray[0]]);
      }
      
      setFlowState("configure");
    }
  };

  const getEndpoint = (slug: string) => {
    switch (slug) {
      case "merge-pdf": return "/api/pdf/merge";
      case "split-pdf": return "/api/pdf/split";
      case "rotate-pdf": return "/api/pdf/rotate";
      case "organize-pdf": return "/api/pdf/organize";
      case "watermark": return "/api/pdf/watermark";
      case "page-numbers": return "/api/pdf/page-numbers";
      case "jpg-to-pdf": return "/api/pdf/image-to-pdf";
      case "scan-to-pdf": return "/api/pdf/image-to-pdf";
      case "resize-pdf": return "/api/pdf/resize";
      case "protect-pdf": return "/api/pdf/protect";
      case "unlock-pdf": return "/api/pdf/unlock";
      case "compress-pdf": return "/api/pdf/compress";
      case "ai-summarizer": return "/api/pdf/summarize";
      case "translate-pdf": return "/api/pdf/translate";
      case "chat-with-pdf": return "/api/pdf/chat";
      case "word-to-pdf": 
      case "excel-to-pdf":
      case "powerpoint-to-pdf": return "/api/pdf/convert-to-pdf";
      case "pdf-to-jpg":
      case "pdf-to-png": return `/api/pdf/pdf-to-image/${slug}`;
      case "repair-pdf": return "/api/pdf/repair";
      case "pdf-to-pdfa": return "/api/pdf/pdfa";
      case "pdf-to-markdown": return "/api/pdf/markdown";
      case "html-to-pdf": return "/api/pdf/html-to-pdf";
      case "ocr-pdf": return "/api/pdf/ocr";
      case "pdf-to-word":
      case "pdf-to-excel":
      case "pdf-to-powerpoint": return `/api/pdf/export/${slug}`;
      case "edit-pdf":
      case "sign-pdf":
      case "compare-pdf":
      case "redact-pdf":
      case "crop-pdf":
      case "pdf-forms": return `/api/pdf/ui/${slug}`;
      default: return `/api/pdf/${slug}`;
    }
  };

  const handleProcess = async (config?: Record<string, unknown>) => {
    setFlowState("processing");
    try {
      const formData = new FormData();
      
      if (allowMultiple || actionType === "merge") {
        files.forEach(f => formData.append("files", f));
      } else {
        formData.append("file", files[0]);
      }

      if (config) {
        Object.keys(config).forEach(key => {
          if (Array.isArray(config[key])) {
             formData.append(key, JSON.stringify(config[key]));
          } else {
             formData.append(key, String(config[key]));
          }
        });
      }

      const endpoint = getEndpoint(slug);
      
      const response = await apiClient(endpoint, {
        data: formData,
      });

      if (response.document && response.document.id) {
        setResultId(response.document.id);
      }
      
      setFlowState("result");
    } catch (error) {
      console.error(error);
      setFlowState("error");
    }
  };

  const handleRetry = () => {
    setFlowState("upload");
    setFiles([]);
  };

  const renderConfig = () => {
    switch (actionType) {
      case "merge":
        return <MergeConfig 
                  files={files} 
                  onProcess={handleProcess} 
                  onAddMore={() => document.getElementById('file-upload')?.click()} 
                  onRemoveFile={(idx: number) => setFiles(f => f.filter((_, i) => i !== idx))}
                />;
      case "compress":
        return <CompressConfig files={files} onProcess={handleProcess} />;
      case "protect":
        return <ProtectConfig files={files} onProcess={handleProcess} />;
      case "resize":
        return <ResizeConfig files={files} onProcess={handleProcess} />;
      case "chat":
        return <ChatConfig files={files} onProcess={handleProcess} />;
      case "rotate":
        return <RotateConfig files={files} onProcess={handleProcess} />;
      default:
        if (slug === "split-pdf") return <SplitConfig files={files} onProcess={handleProcess} />;
        if (slug === "watermark") return <WatermarkConfig files={files} onProcess={handleProcess} />;
        if (slug === "organize-pdf") return <OrganizeConfig files={files} onProcess={handleProcess} />;
        return <BasicConfig files={files} onProcess={handleProcess} title={title} />;
    }
  };

  return (
    <div className="my-12">
      <div className={flowState === "upload" || actionType === "merge" ? "block" : "hidden"}>
        {/* We keep UploadDropzone mounted for Merge to allow hidden input clicking */}
        {(flowState === "upload" || (flowState === "configure" && actionType === "merge")) && (
          <div className={flowState === "configure" ? "hidden" : "block"}>
            <UploadDropzone 
              onUpload={handleUpload} 
              accept={accept} 
              maxSizeMB={maxSizeMB}
              allowMultiple={allowMultiple}
            />
          </div>
        )}
      </div>
      
      {flowState === "configure" && renderConfig()}
      
      {flowState === "processing" && (
        <ProgressState fileName={files.length > 1 ? `${files.length} files` : files[0]?.name} />
      )}
      
      {flowState === "result" && (
        <div className="flex flex-col items-center gap-4 mt-8">
          <ResultCard fileName={files.length > 1 ? `Processed_${files.length}_files.pdf` : files[0]?.name} savedBytes="Processed File" />
          {resultId && (
            <a href={`http://localhost:3001/api/documents/download/${resultId}`} target="_blank" rel="noreferrer" className="w-full max-w-sm">
               <button className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors">
                 Download Processed File
               </button>
            </a>
          )}
        </div>
      )}
      
      {flowState === "error" && (
        <ErrorState 
          message={`A file exceeds the maximum allowed size of ${maxSizeMB}MB for free accounts. Please upgrade to Pro to process larger files.`}
          onRetry={handleRetry} 
        />
      )}
    </div>
  );
}
