"use client";

import { CheckCircle2, Download, RefreshCw, FileWarning } from "lucide-react";
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

interface ResultCardProps {
  fileName: string;
  savedBytes?: string;
  actionDone?: string;
  onDownload?: () => void;
  onStartOver?: () => void;
  isDownloading?: boolean;
  downloadError?: string | null;
  downloadUrl?: string | null;
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
}: ResultCardProps) {
  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-sm">
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
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
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
                <span>Download File</span>
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
