"use client";

import { CheckCircle2, Download, RefreshCw, FileWarning, ImageIcon, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProgressState({ fileName, action = "Processing" }: { fileName: string, action?: string }) {
  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-sm">
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-gray-100 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#E5322D] rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#33333B]">{action} {fileName}...</h3>
          <p className="text-gray-500 mt-2 font-medium">Please wait while we complete this action.</p>
        </div>
      </div>
    </div>
  );
}

export interface ResultDocumentItem {
  id: string;
  originalName: string;
  size?: number;
  filename?: string;
}

interface ResultCardProps {
  fileName: string;
  savedBytes?: string;
  actionDone?: string;
  onDownload?: () => void;
  onStartOver?: () => void;
  isDownloading?: boolean;
  downloadError?: string | null;
  downloadUrl?: string | null;
  resultDocuments?: ResultDocumentItem[] | null;
  onDownloadSingle?: (docId: string, name: string) => void;
}

export function ResultCard({ 
  fileName, 
  savedBytes, 
  actionDone = "Task Complete!",
  onDownload,
  onStartOver,
  isDownloading = false,
  downloadError = null,
  downloadUrl = null,
  resultDocuments = null,
  onDownloadSingle,
}: ResultCardProps) {
  const isMultipleFiles = resultDocuments && resultDocuments.length > 1;
  const isPdfFiles = resultDocuments && resultDocuments.some(d => d.originalName.toLowerCase().endsWith(".pdf"));
  const isSingleImage = fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png");

  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl border border-gray-100 bg-white p-8 md:p-12 text-center shadow-sm">
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center mb-2 shadow-[0_10px_30px_rgba(34,197,94,0.3)] ring-8 ring-green-50">
          <CheckCircle2 className="w-12 h-12" strokeWidth={3} />
        </div>
        <div>
          <h3 className="text-3xl font-extrabold text-[#33333B]">{actionDone}</h3>
          <p className="text-gray-500 mt-3 text-lg">
            Successfully processed <span className="font-bold text-[#33333B]">{fileName}</span>. 
            {savedBytes && <span className="font-semibold text-green-600 ml-1">You saved {savedBytes}!</span>}
          </p>
        </div>

        {/* Multi-document / Multi-image direct downloads list */}
        {isMultipleFiles && (
          <div className="w-full max-w-xl bg-gray-50 border border-gray-200/80 rounded-2xl p-4 text-left">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {isPdfFiles ? `Split PDF Files (${resultDocuments.length})` : `Converted Images (${resultDocuments.length})`}
              </span>
              <span className="text-xs text-green-600 font-semibold">
                {isPdfFiles ? "Ready to Download" : "Direct JPG / PNG"}
              </span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {resultDocuments.map((doc, idx) => (
                <div 
                  key={doc.id || idx} 
                  className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-all shadow-xs"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isPdfFiles ? "bg-red-50 text-[#E5322D]" : "bg-yellow-50 text-yellow-600"
                    }`}>
                      {isPdfFiles ? <FileDown className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-semibold text-gray-800 truncate">{doc.originalName}</p>
                      <p className="text-xs text-gray-400">
                        {isPdfFiles ? `File #${idx + 1}` : `Page ${idx + 1}`}
                        {doc.size ? ` • ${(doc.size / 1024).toFixed(1)} KB` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDownloadSingle ? onDownloadSingle(doc.id, doc.originalName) : onDownload?.();
                    }}
                    className="cursor-pointer ml-3 shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#E5322D] hover:text-white hover:bg-[#E5322D] border border-[#E5322D]/30 rounded-lg transition-all"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDownload?.();
            }} 
            disabled={isDownloading}
            className="cursor-pointer inline-flex items-center justify-center bg-[#E5322D] hover:bg-[#CC2A26] text-white h-14 rounded-xl px-10 gap-2 font-bold text-lg shadow-lg active:scale-95 transition-all disabled:opacity-75 disabled:pointer-events-none"
          >
            {isDownloading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" strokeWidth={2.5} />
                <span>
                  {isMultipleFiles 
                    ? `Download All (${resultDocuments.length} ${isPdfFiles ? "Files" : "Images"})` 
                    : isSingleImage 
                      ? "Download Image" 
                      : "Download File"}
                </span>
              </>
            )}
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartOver?.();
            }}
            className="cursor-pointer inline-flex items-center justify-center border border-gray-200 bg-white hover:bg-gray-50 hover:text-[#33333B] text-[#4A4A55] h-14 rounded-xl px-10 gap-2 font-bold text-lg active:scale-95 transition-all"
          >
            <RefreshCw className="w-5 h-5" strokeWidth={2.5} />
            <span>Start Over</span>
          </button>
        </div>
        {downloadError && (
          <div className="flex flex-col items-center gap-2 mt-2">
            <p className="text-red-500 font-semibold text-sm">{downloadError}</p>
            {downloadUrl && (
              <a 
                href={downloadUrl} 
                target="_blank" 
                rel="noreferrer" 
                download
                className="text-sm font-bold text-[#E5322D] underline hover:text-[#CC2A26]"
              >
                Click here for direct download link
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorState({ 
  message, 
  onRetry,
  actionText,
  onAction,
}: { 
  message: string; 
  onRetry: () => void;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl border border-red-100 bg-red-50/50 p-12 text-center shadow-sm">
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
          <FileWarning className="w-10 h-10" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-2xl font-extrabold text-red-700">Something went wrong</h3>
          <p className="text-red-600/80 mt-2 text-lg max-w-lg font-medium">{message}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onRetry} className="bg-red-600 hover:bg-red-700 h-12 rounded-xl px-10 mt-4 font-bold text-white shadow-md active:scale-95 transition-transform">
            Try Again
          </Button>
          {actionText && onAction && (
            <Button onClick={onAction} variant="outline" className="h-12 rounded-xl px-8 mt-4 font-bold text-[#33333B] border-gray-300 hover:bg-white shadow-sm active:scale-95 transition-transform">
              {actionText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
