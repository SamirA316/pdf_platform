"use client";

import { useState } from "react";
import { MessageSquare, Send, Sparkles } from "lucide-react";

interface ChatConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function ChatConfig({ files, onProcess }: ChatConfigProps) {
  const [query, setQuery] = useState("");

  return (
    <div className="w-full max-w-4xl mx-auto bg-card border border-border rounded-3xl overflow-hidden shadow-sm flex flex-col h-[600px]">
      <div className="p-6 border-b border-border bg-secondary/20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Chat with PDF</h3>
            <p className="text-xs text-muted-foreground">{files[0]?.name}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
        <MessageSquare className="w-12 h-12 text-primary/20" />
        <div className="max-w-md">
          <h4 className="text-lg font-medium mb-2">AI Document Analysis Ready</h4>
          <p className="text-sm text-muted-foreground">
            I&apos;ve analyzed your document. You can ask me to summarize it, extract specific data points, or explain complex sections.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <button onClick={() => setQuery("Summarize the key points.")} className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs rounded-full hover:bg-secondary/80">
            Summarize key points
          </button>
          <button onClick={() => setQuery("What is the main conclusion?")} className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs rounded-full hover:bg-secondary/80">
            Main conclusion
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-border bg-background">
        <div className="relative flex items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && query && onProcess({ query })}
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
            placeholder="Ask a question about your document..."
          />
          <button
            onClick={() => onProcess({ query })}
            disabled={!query}
            className="absolute right-2 p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
