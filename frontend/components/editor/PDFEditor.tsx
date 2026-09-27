"use client";

import React, { useState, useEffect } from "react";
import { EditorProvider, useEditor } from "@/lib/editor/EditorContext";
import { PDFEditorHeader } from "./PDFEditorHeader";
import { PDFEditorToolbar } from "./PDFEditorToolbar";
import { PDFEditorProperties } from "./PDFEditorProperties";
import { PDFEditorThumbnails } from "./PDFEditorThumbnails";
import { PDFEditorBottomBar } from "./PDFEditorBottomBar";
import { EditorViewport } from "./viewport/EditorViewport";

export interface IPDFEditorProps {
  fileId?: string;
  file?: File;
  fileBytes?: ArrayBuffer;
  fileName?: string;
  onSaveDraft?: () => void;
  onExportPdf?: () => void;
  isExporting?: boolean;
}

function PDFEditorLayout({
  onSaveDraft,
  onExportPdf,
  isExporting,
}: Pick<IPDFEditorProps, "onSaveDraft" | "onExportPdf" | "isExporting">) {
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(false);
  const {
    undo,
    redo,
    deleteSelection,
    activeTool,
    setActiveTool,
    scrollToPage,
    currentPageIndex,
    numPages,
    zoomIn,
    zoomOut,
    resetZoom,
    rotateViewClockwise,
  } = useEditor();

  // Global Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input or textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Page Navigation shortcuts
      if (e.key === "PageDown") {
        e.preventDefault();
        scrollToPage(currentPageIndex + 1, "smooth");
        return;
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        scrollToPage(currentPageIndex - 1, "smooth");
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        scrollToPage(0, "smooth");
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        scrollToPage(numPages - 1, "smooth");
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Delete / Backspace: Delete active selection
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelection();
        return;
      }

      // Zoom In: Cmd/Ctrl + Plus or Equal
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomIn();
        return;
      }

      // Zoom Out: Cmd/Ctrl + Minus or Underscore
      if ((e.ctrlKey || e.metaKey) && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        zoomOut();
        return;
      }

      // Reset Zoom: Cmd/Ctrl + 0
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        resetZoom();
        return;
      }

      // Rotate View Clockwise: Shift + R
      if (e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        rotateViewClockwise();
        return;
      }

      // Single-key tool shortcuts
      switch (e.key.toLowerCase()) {
        case "v":
          setActiveTool("select");
          break;
        case "h":
          setActiveTool("hand");
          break;
        case "t":
          setActiveTool("text");
          break;
        case "r":
          setActiveTool("rectangle");
          break;
        case "o":
          setActiveTool("circle");
          break;
        case "p":
          setActiveTool("pen");
          break;
        case "e":
          setActiveTool("eraser");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    undo,
    redo,
    deleteSelection,
    setActiveTool,
    scrollToPage,
    currentPageIndex,
    numPages,
    zoomIn,
    zoomOut,
    resetZoom,
    rotateViewClockwise,
  ]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden font-sans">
      {/* 1. Header Bar */}
      <PDFEditorHeader
        onSaveDraft={onSaveDraft}
        onExportPdf={onExportPdf}
        isExporting={isExporting}
      />

      {/* 2. Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Leftmost Tool Palette */}
        <PDFEditorToolbar />

        {/* Collapsible Page Thumbnails Sidebar */}
        <PDFEditorThumbnails
          isOpen={isThumbnailsOpen}
          onToggle={() => setIsThumbnailsOpen((prev) => !prev)}
        />

        {/* Center Viewport */}
        <EditorViewport />

        {/* Right Properties Inspector */}
        <PDFEditorProperties />
      </div>

      {/* 3. Bottom Status & Navigation Bar */}
      <PDFEditorBottomBar />
    </div>
  );
}

function PDFEditorInitializer({
  fileId,
  file,
  fileBytes,
  fileName,
}: Pick<IPDFEditorProps, "fileId" | "file" | "fileBytes" | "fileName">) {
  const { loadFromBytes, loadFromFile, loadFromFileId, isDocumentLoaded, isLoading } = useEditor();

  useEffect(() => {
    if (isDocumentLoaded || isLoading) return;

    if (fileBytes) {
      loadFromBytes(fileBytes, fileName || "document.pdf", fileId);
    } else if (file) {
      loadFromFile(file);
    } else if (fileId) {
      loadFromFileId(fileId, fileName);
    }
  }, [
    fileId,
    file,
    fileBytes,
    fileName,
    isDocumentLoaded,
    isLoading,
    loadFromBytes,
    loadFromFile,
    loadFromFileId,
  ]);

  return null;
}

export function PDFEditor({
  fileId,
  file,
  fileBytes,
  fileName,
  onSaveDraft,
  onExportPdf,
  isExporting,
}: IPDFEditorProps) {
  return (
    <EditorProvider>
      <PDFEditorInitializer
        fileId={fileId}
        file={file}
        fileBytes={fileBytes}
        fileName={fileName}
      />
      <PDFEditorLayout
        onSaveDraft={onSaveDraft}
        onExportPdf={onExportPdf}
        isExporting={isExporting}
      />
    </EditorProvider>
  );
}
