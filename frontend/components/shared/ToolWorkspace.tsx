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

type FlowState = "upload" | "configure" | "processing" | "result" | "error";

interface ToolWorkspaceProps {
  accept: string;
  maxSizeMB: number;
  actionType: "compress" | "merge" | "protect" | "resize" | "chat" | "rotate" | "basic";
  allowMultiple: boolean;
  title: string;
}

export function ToolWorkspace({ accept, maxSizeMB, actionType, allowMultiple, title }: ToolWorkspaceProps) {
  const [flowState, setFlowState] = useState<FlowState>("upload");
  const [files, setFiles] = useState<File[]>([]);

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

  const handleProcess = () => {
    setFlowState("processing");
    // Simulate processing time
    setTimeout(() => {
      setFlowState("result");
    }, 3000);
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
        <ResultCard fileName={files.length > 1 ? `Merged_${files.length}_files.pdf` : files[0]?.name} savedBytes="Processed File" />
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
