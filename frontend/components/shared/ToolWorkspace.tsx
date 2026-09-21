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
import { API_BASE_URL, apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { SplitConfig } from "@/components/tools/SplitConfig";
import { WatermarkConfig } from "@/components/tools/WatermarkConfig";
import { OrganizeConfig } from "@/components/tools/OrganizeConfig";
import { EditConfig } from "@/components/tools/EditConfig";

type FlowState = "upload" | "configure" | "processing" | "result" | "error";

interface ToolWorkspaceProps {
  slug: string;
  accept: string;
  maxSizeMB: number;
  actionType: "compress" | "merge" | "protect" | "resize" | "chat" | "rotate" | "edit" | "basic";
  allowMultiple: boolean;
  title: string;
}

export function ToolWorkspace({ slug, accept, maxSizeMB, actionType, allowMultiple, title }: ToolWorkspaceProps) {
  const [flowState, setFlowState] = useState<FlowState>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const [resultFileName, setResultFileName] = useState<string | null>(null);
  const [compressionSavedText, setCompressionSavedText] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [processError, setProcessError] = useState<{ message: string; isAuth?: boolean } | null>(null);
  const router = useRouter();

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

  const handleProcess = async (config?: Record<string, unknown>, customFile?: File) => {
    setFlowState("processing");
    setProcessError(null);
    setDownloadError(null);
    try {
      const formData = new FormData();
      const filesToUpload = customFile ? [customFile] : files;
      
      if (filesToUpload && filesToUpload.length > 0) {
        filesToUpload.forEach(f => formData.append("files", f));
        if (filesToUpload[0]) {
          formData.append("file", filesToUpload[0]);
        }
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

      if (response.document) {
        if (response.document.id) {
          setResultId(response.document.id);
        }
        if (response.document.originalName) {
          setResultFileName(response.document.originalName);
        }
      }

      if (response.savedPercentage !== undefined && response.savedPercentage > 0 && response.savedBytes) {
        const formatBytes = (bytes: number) => {
          if (bytes < 1024) return `${bytes} B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        };
        setCompressionSavedText(`${response.savedPercentage}% (${formatBytes(response.savedBytes)})`);
      } else if (actionType === "compress") {
        setCompressionSavedText("Optimized");
      } else {
        setCompressionSavedText(null);
      }
      
      setFlowState("result");
    } catch (error: any) {
      console.error("Processing error:", error);
      const msg = error?.message || "Failed to process document";
      const isAuth = msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("login");
      setProcessError({
        message: isAuth 
          ? "You must be logged in to process documents. Please sign in or create an account."
          : msg,
        isAuth,
      });
      setFlowState("error");
    }
  };

  const handleDownload = async () => {
    if (!resultId) {
      setDownloadError("No file ready for download. Please process your file again or start over.");
      return;
    }
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/download/${resultId}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        let errMsg = "Download failed";
        try {
          const data = await response.json();
          if (data.error) errMsg = data.error;
        } catch {
          errMsg = `Server returned status ${response.status}`;
        }
        throw new Error(errMsg);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      // Extract filename from Content-Disposition if present
      const disposition = response.headers.get("content-disposition");
      let downloadName = resultFileName;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          downloadName = match[1];
        }
      }
      if (!downloadName) {
        downloadName = files.length > 1
          ? `Processed_${files.length}_files.pdf`
          : `processed_${files[0]?.name || "document.pdf"}`;
      }

      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
        } catch {}
      }, 1500);
    } catch (err: any) {
      console.error("Download error:", err);
      setDownloadError(err?.message || "Failed to download document. Please ensure you are logged in.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRetry = () => {
    setFlowState("upload");
    setFiles([]);
    setResultId(null);
    setResultFileName(null);
    setCompressionSavedText(null);
    setDownloadError(null);
    setProcessError(null);
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
        return <ProtectConfig files={files} onProcess={handleProcess} slug={slug} />;
      case "resize":
        return <ResizeConfig files={files} onProcess={handleProcess} />;
      case "chat":
        return <ChatConfig files={files} onProcess={handleProcess} />;
      case "rotate":
        return <RotateConfig files={files} onProcess={handleProcess} />;
      case "edit":
        return <EditConfig files={files} onProcess={handleProcess} slug={slug} />;
      default:
        if (slug === "edit-pdf" || slug === "sign-pdf") return <EditConfig files={files} onProcess={handleProcess} slug={slug} />;
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
          <ResultCard 
            fileName={resultFileName || (files.length > 1 ? `Processed_${files.length}_files.pdf` : files[0]?.name)} 
            savedBytes={compressionSavedText || undefined}
            onDownload={handleDownload}
            onStartOver={handleRetry}
            isDownloading={isDownloading}
            downloadError={downloadError}
            downloadUrl={resultId ? `${API_BASE_URL}/api/documents/download/${resultId}` : null}
          />
        </div>
      )}
      
      {flowState === "error" && (
        <ErrorState 
          message={processError?.message || `A file exceeds the maximum allowed size of ${maxSizeMB}MB for free accounts. Please upgrade to Pro to process larger files.`}
          onRetry={handleRetry} 
          actionText={processError?.isAuth ? "Sign In" : undefined}
          onAction={processError?.isAuth ? () => router.push("/login") : undefined}
        />
      )}
    </div>
  );
}
