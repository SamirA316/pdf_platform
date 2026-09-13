import { CheckCircle2, Download, RefreshCw, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProgressState({ fileName }: { fileName: string }) {
  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-secondary rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-foreground">Processing {fileName}...</h3>
          <p className="text-muted-foreground mt-2">Please wait while we compress your file.</p>
        </div>
      </div>
    </div>
  );
}

export function ResultCard({ fileName, savedBytes }: { fileName: string, savedBytes: string }) {
  return (
    <div className="w-full max-w-3xl mx-auto rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="w-28 h-28 bg-green-500 text-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/30 ring-8 ring-green-500/10">
          <CheckCircle2 className="w-14 h-14" strokeWidth={3} />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-foreground">Compression Complete!</h3>
          <p className="text-muted-foreground mt-2">
            Successfully compressed <span className="font-semibold text-foreground">{fileName}</span>. 
            You saved <span className="font-semibold text-success">{savedBytes}</span>!
          </p>
        </div>
        <div className="flex gap-4 mt-4">
          <Button className="h-10 rounded-[10px] px-8 gap-2 font-bold shadow-sm">
            <Download className="w-4 h-4" /> Download File
          </Button>
          <Button variant="outline" className="h-10 rounded-[10px] px-8 gap-2 font-bold border-border shadow-sm">
            <RefreshCw className="w-4 h-4" /> Process Another
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string, onRetry: () => void }) {
  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl border border-destructive/20 bg-destructive/5 p-12 text-center shadow-sm">
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-2">
          <FileWarning className="w-8 h-8" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-destructive">Upload Failed</h3>
          <p className="text-muted-foreground mt-2">{message}</p>
        </div>
        <Button onClick={onRetry} variant="outline" className="h-10 rounded-[10px] px-8 mt-4 font-bold border-destructive/20 hover:bg-destructive/10 text-destructive hover:text-destructive shadow-sm">
          Try Again
        </Button>
      </div>
    </div>
  );
}
