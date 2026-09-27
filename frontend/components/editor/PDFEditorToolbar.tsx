"use client";

import React from "react";
import { useEditor } from "@/lib/editor/EditorContext";
import { EditorToolType } from "@/types/editor";
import {
  MousePointer,
  Hand,
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  PenLine,
  Highlighter,
  Eraser,
  FileSignature,
} from "lucide-react";

interface IToolDefinition {
  id: EditorToolType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  category?: "pointer" | "content" | "shape" | "annotation";
}

const TOOLS: IToolDefinition[] = [
  { id: "select", label: "Select (V)", icon: MousePointer, shortcut: "V", category: "pointer" },
  { id: "hand", label: "Pan / Hand (H)", icon: Hand, shortcut: "H", category: "pointer" },
  { id: "text", label: "Add Text (T)", icon: Type, shortcut: "T", category: "content" },
  { id: "image", label: "Insert Image", icon: ImageIcon, category: "content" },
  { id: "rectangle", label: "Rectangle (R)", icon: Square, shortcut: "R", category: "shape" },
  { id: "circle", label: "Circle (O)", icon: Circle, shortcut: "O", category: "shape" },
  { id: "line", label: "Line (L)", icon: Minus, shortcut: "L", category: "shape" },
  { id: "arrow", label: "Arrow (A)", icon: MoveUpRight, shortcut: "A", category: "shape" },
  { id: "pen", label: "Freehand Pen (P)", icon: PenLine, shortcut: "P", category: "annotation" },
  { id: "highlighter", label: "Highlighter", icon: Highlighter, category: "annotation" },
  { id: "eraser", label: "Eraser (E)", icon: Eraser, shortcut: "E", category: "annotation" },
];

export function PDFEditorToolbar() {
  const { activeTool, setActiveTool } = useEditor();

  return (
    <aside className="w-14 border-r border-border bg-card/60 backdrop-blur-md flex flex-col items-center py-3 gap-1 z-20 select-none">
      {TOOLS.map((tool, idx) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;

        // Render subtle dividers between tool categories
        const prevCategory = idx > 0 ? TOOLS[idx - 1].category : null;
        const isNewCategory = prevCategory && prevCategory !== tool.category;

        return (
          <React.Fragment key={tool.id}>
            {isNewCategory && <div className="w-6 h-px bg-border/80 my-1" />}
            <button
              onClick={() => setActiveTool(tool.id)}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
              title={tool.label}
              aria-label={tool.label}
            >
              <Icon className="w-5 h-5" />
              {isActive && (
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full bg-primary" />
              )}
            </button>
          </React.Fragment>
        );
      })}
    </aside>
  );
}
