"use client";

/**
 * QuickPDF Platform - PDF Editor Central React Context & State Hook
 * Phase 5.2 - Live PDF.js Viewer & Document Lifecycle Integration
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  EditorObject,
  EditorToolType,
  IEditorActiveProperties,
  IPageDimension,
  IEditorExportPayload,
} from "@/types/editor";
import { EditorHistoryManager } from "./history";
import {
  clamp,
  MIN_ZOOM,
  MAX_ZOOM,
  getNextZoomIn,
  getNextZoomOut,
  ViewportRotation,
  IRect,
  IPoint,
} from "./coordinates";
import type { PDFDocumentProxy } from "./pdf/pdfTypes";
import {
  loadPdfDocument,
  extractDocumentDimensions,
  destroyPdfDocument,
} from "./pdf/pdfDocument";

export const DEFAULT_ACTIVE_PROPERTIES: IEditorActiveProperties = {
  color: "#1e293b",
  fillColor: "transparent",
  fontSize: 16,
  fontFamily: "Helvetica",
  fontWeight: "normal",
  fontStyle: "normal",
  textDecoration: "none",
  textAlign: "left",
  lineHeight: 1.2,
  strokeWidth: 2,
  opacity: 1.0,
};

interface IEditorContextValue {
  // Document Context
  fileId: string | null;
  fileName: string;
  numPages: number;
  currentPageIndex: number;
  pageDimensions: IPageDimension[];
  isDocumentLoaded: boolean;
  isLoading: boolean;
  loadingProgress: number;
  error: string | null;
  pdfDocument: PDFDocumentProxy | null;

  // Document Loaders
  loadFromBytes: (bytes: ArrayBuffer, fileName: string, fileId?: string) => Promise<void>;
  loadFromFile: (file: File) => Promise<void>;
  loadFromFileId: (fileId: string, fileName?: string) => Promise<void>;

  // Viewport
  zoom: number;
  fitMode: "custom" | "width" | "page";
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setFitMode: (mode: "custom" | "width" | "page") => void;
  setCurrentPageIndex: (pageIndex: number) => void;
  scrollToPage: (pageIndex: number, behavior?: ScrollBehavior) => void;
  isProgrammaticScroll: React.MutableRefObject<boolean>;

  // Viewport Rotation & Pan
  viewportRotation: ViewportRotation;
  rotateViewClockwise: () => void;
  rotateViewCounterClockwise: () => void;
  resetViewRotation: () => void;
  isPanning: boolean;
  setIsPanning: (panning: boolean) => void;

  // Tools & Properties
  activeTool: EditorToolType;
  setActiveTool: (tool: EditorToolType) => void;
  activeProperties: IEditorActiveProperties;
  updateActiveProperties: (props: Partial<IEditorActiveProperties>) => void;

  // Selection
  selectedObjectIds: string[];
  editingObjectId: string | null;
  selectObject: (id: string, multi?: boolean) => void;
  setEditingObjectId: (id: string | null) => void;
  clearSelection: () => void;
  getSelectedObjects: () => EditorObject[];

  // Object Store (Keyed by pageIndex)
  objectsByPage: Record<number, EditorObject[]>;
  addObject: (pageIndex: number, object: EditorObject) => void;
  updateObject: (id: string, updates: Partial<EditorObject>, addToHistory?: boolean) => void;
  commitResize: (id: string, origRect: IRect, finalRect: IRect) => void;
  commitMove: (id: string, origPos: IPoint, finalPos: IPoint) => void;
  commitRotate: (id: string, origRotation: number, finalRotation: number) => void;
  deleteObject: (id: string) => void;
  deleteSelection: () => void;

  // History Stack
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Persistence / Export
  isDirty: boolean;
  getExportPayload: () => IEditorExportPayload | null;
  initializeDocument: (fileId: string, fileName: string, pages: IPageDimension[]) => void;
}

const EditorContext = createContext<IEditorContextValue | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  // Document state
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("document.pdf");
  const [pageDimensions, setPageDimensions] = useState<IPageDimension[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);

  // Viewport state
  const [zoom, setZoomState] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<"custom" | "width" | "page">("width");
  const [viewportRotation, setViewportRotation] = useState<ViewportRotation>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  // Tool state
  const [activeTool, setActiveTool] = useState<EditorToolType>("select");
  const [activeProperties, setActiveProperties] =
    useState<IEditorActiveProperties>(DEFAULT_ACTIVE_PROPERTIES);

  // Selection
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);

  // Objects by page
  const [objectsByPage, setObjectsByPage] = useState<Record<number, EditorObject[]>>({});
  const objectsByPageRef = useRef<Record<number, EditorObject[]>>(objectsByPage);
  useEffect(() => {
    objectsByPageRef.current = objectsByPage;
  }, [objectsByPage]);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // History Manager
  const [historyStateVersion, setHistoryStateVersion] = useState<number>(0);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const historyManagerRef = useRef<EditorHistoryManager | null>(null);
  if (historyManagerRef.current == null) {
    const manager = new EditorHistoryManager(() => {
      setCanUndo(manager.canUndo());
      setCanRedo(manager.canRedo());
      setHistoryStateVersion((v) => v + 1);
    });
    historyManagerRef.current = manager;
  }

  const numPages = pageDimensions.length;

  // Clean up PDF.js document on unmount
  useEffect(() => {
    return () => {
      if (pdfDocument) {
        destroyPdfDocument(pdfDocument);
      }
    };
  }, [pdfDocument]);

  // Viewport Rotation helpers
  const rotateViewClockwise = useCallback(() => {
    setViewportRotation((prev) => ((prev + 90) % 360) as ViewportRotation);
  }, []);

  const rotateViewCounterClockwise = useCallback(() => {
    setViewportRotation((prev) => ((prev + 270) % 360) as ViewportRotation);
  }, []);

  const resetViewRotation = useCallback(() => {
    setViewportRotation(0);
  }, []);

  // Zoom helpers
  const setZoom = useCallback((newZoom: number) => {
    setZoomState(clamp(Math.round(newZoom * 100) / 100, MIN_ZOOM, MAX_ZOOM));
    setFitMode("custom");
  }, []);

  const zoomIn = useCallback(() => {
    setZoomState((prev) => getNextZoomIn(prev));
    setFitMode("custom");
  }, []);

  const zoomOut = useCallback(() => {
    setZoomState((prev) => getNextZoomOut(prev));
    setFitMode("custom");
  }, []);

  const resetZoom = useCallback(() => {
    setZoomState(1.0);
    setFitMode("custom");
  }, []);

  const updateActiveProperties = useCallback((props: Partial<IEditorActiveProperties>) => {
    setActiveProperties((prev) => ({ ...prev, ...props }));
  }, []);

  // Selection helpers
  const selectObject = useCallback((id: string, multi = false) => {
    setSelectedObjectIds((prev) => {
      if (multi) {
        return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      }
      return [id];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedObjectIds([]);
    setEditingObjectId(null);
  }, []);

  const getSelectedObjects = useCallback((): EditorObject[] => {
    const list: EditorObject[] = [];
    const allObjects = Object.values(objectsByPage).flat();
    for (const obj of allObjects) {
      if (selectedObjectIds.includes(obj.id)) {
        list.push(obj);
      }
    }
    return list;
  }, [objectsByPage, selectedObjectIds]);

  // Object Mutations with Undo/Redo tracking
  const addObject = useCallback((pageIndex: number, object: EditorObject) => {
    setObjectsByPage((prev) => {
      const pageObjs = prev[pageIndex] || [];
      return {
        ...prev,
        [pageIndex]: [...pageObjs, object],
      };
    });
    setIsDirty(true);

    // Push action
    historyManagerRef.current?.push({
      id: `add_${object.id}`,
      type: "ADD_OBJECT",
      description: `Add ${object.type}`,
      timestamp: Date.now(),
      undo: () => {
        setObjectsByPage((prev) => ({
          ...prev,
          [pageIndex]: (prev[pageIndex] || []).filter((o) => o.id !== object.id),
        }));
        setSelectedObjectIds((prev) => prev.filter((id) => id !== object.id));
      },
      redo: () => {
        setObjectsByPage((prev) => ({
          ...prev,
          [pageIndex]: [...(prev[pageIndex] || []), object],
        }));
      },
    });
  }, []);

  const updateObject = useCallback(
    (id: string, updates: Partial<EditorObject>, addToHistory = true) => {
      let targetPageIndex = -1;
      let prevObject: EditorObject | null = null;

      for (const [pageKey, objs] of Object.entries(objectsByPageRef.current)) {
        const found = objs.find((o) => o.id === id);
        if (found) {
          targetPageIndex = Number(pageKey);
          prevObject = found;
          break;
        }
      }

      if (!prevObject || targetPageIndex === -1) {
        return;
      }

      // Avoid no-op updates and duplicate history entries
      const hasChange = Object.entries(updates).some(
        ([key, val]) => (prevObject as any)[key] !== val
      );
      if (!hasChange) {
        return;
      }

      const oldObj = prevObject;
      const nextObj = { ...oldObj, ...updates } as EditorObject;

      setObjectsByPage((prev) => {
        const list = prev[targetPageIndex] || [];
        return {
          ...prev,
          [targetPageIndex]: list.map((o) => (o.id === id ? nextObj : o)),
        };
      });

      setIsDirty(true);

      if (addToHistory) {
        historyManagerRef.current?.push({
          id: `update_${id}_${Date.now()}`,
          type: "UPDATE_OBJECT",
          description: `Update ${oldObj.type}`,
          timestamp: Date.now(),
          undo: () => {
            setObjectsByPage((prev) => {
              const list = prev[targetPageIndex] || [];
              return {
                ...prev,
                [targetPageIndex]: list.map((o) => (o.id === id ? oldObj : o)),
              };
            });
          },
          redo: () => {
            setObjectsByPage((prev) => {
              const list = prev[targetPageIndex] || [];
              return {
                ...prev,
                [targetPageIndex]: list.map((o) => (o.id === id ? nextObj : o)),
              };
            });
          },
        });
      }
    },
    []
  );

  const commitResize = useCallback(
    (id: string, origRect: IRect, finalRect: IRect) => {
      if (
        origRect.x === finalRect.x &&
        origRect.y === finalRect.y &&
        origRect.width === finalRect.width &&
        origRect.height === finalRect.height
      ) {
        return;
      }

      let targetPageIndex = -1;
      for (const [pageKey, objs] of Object.entries(objectsByPage)) {
        if (objs.some((o) => o.id === id)) {
          targetPageIndex = Number(pageKey);
          break;
        }
      }

      if (targetPageIndex === -1) return;

      historyManagerRef.current?.push({
        id: `resize_${id}_${Date.now()}`,
        type: "RESIZE_OBJECT",
        description: "Resize text box",
        timestamp: Date.now(),
        undo: () => {
          setObjectsByPage((prev) => {
            const list = prev[targetPageIndex] || [];
            return {
              ...prev,
              [targetPageIndex]: list.map((o) => (o.id === id ? { ...o, ...origRect } : o)),
            };
          });
        },
        redo: () => {
          setObjectsByPage((prev) => {
            const list = prev[targetPageIndex] || [];
            return {
              ...prev,
              [targetPageIndex]: list.map((o) => (o.id === id ? { ...o, ...finalRect } : o)),
            };
          });
        },
      });
      setIsDirty(true);
    },
    [objectsByPage]
  );

  const commitMove = useCallback(
    (id: string, origPos: IPoint, finalPos: IPoint) => {
      if (origPos.x === finalPos.x && origPos.y === finalPos.y) {
        return;
      }

      let targetPageIndex = -1;
      for (const [pageKey, objs] of Object.entries(objectsByPage)) {
        if (objs.some((o) => o.id === id)) {
          targetPageIndex = Number(pageKey);
          break;
        }
      }

      if (targetPageIndex === -1) return;

      historyManagerRef.current?.push({
        id: `move_${id}_${Date.now()}`,
        type: "MOVE_OBJECTS",
        description: "Move text box",
        timestamp: Date.now(),
        undo: () => {
          setObjectsByPage((prev) => {
            const list = prev[targetPageIndex] || [];
            return {
              ...prev,
              [targetPageIndex]: list.map((o) => (o.id === id ? { ...o, x: origPos.x, y: origPos.y } : o)),
            };
          });
        },
        redo: () => {
          setObjectsByPage((prev) => {
            const list = prev[targetPageIndex] || [];
            return {
              ...prev,
              [targetPageIndex]: list.map((o) => (o.id === id ? { ...o, x: finalPos.x, y: finalPos.y } : o)),
            };
          });
        },
      });
      setIsDirty(true);
    },
    [objectsByPage]
  );

  const commitRotate = useCallback(
    (id: string, origRotation: number, finalRotation: number) => {
      if (origRotation === finalRotation) {
        return;
      }

      let targetPageIndex = -1;
      for (const [pageKey, objs] of Object.entries(objectsByPageRef.current)) {
        if (objs.some((o) => o.id === id)) {
          targetPageIndex = Number(pageKey);
          break;
        }
      }

      if (targetPageIndex === -1) return;

      historyManagerRef.current?.push({
        id: `rotate_${id}_${Date.now()}`,
        type: "ROTATE_OBJECT",
        description: "Rotate text box",
        timestamp: Date.now(),
        undo: () => {
          setObjectsByPage((prev) => {
            const list = prev[targetPageIndex] || [];
            return {
              ...prev,
              [targetPageIndex]: list.map((o) =>
                o.id === id ? { ...o, rotation: origRotation } : o
              ),
            };
          });
        },
        redo: () => {
          setObjectsByPage((prev) => {
            const list = prev[targetPageIndex] || [];
            return {
              ...prev,
              [targetPageIndex]: list.map((o) =>
                o.id === id ? { ...o, rotation: finalRotation } : o
              ),
            };
          });
        },
      });
      setIsDirty(true);
    },
    []
  );

  const deleteObject = useCallback((id: string) => {
    let targetPageIndex = -1;
    let deletedObj: EditorObject | null = null;

    setObjectsByPage((prev) => {
      const next = { ...prev };
      for (const [pageKey, objs] of Object.entries(next)) {
        const pIdx = Number(pageKey);
        const found = objs.find((o) => o.id === id);
        if (found) {
          targetPageIndex = pIdx;
          deletedObj = found;
          next[pIdx] = objs.filter((o) => o.id !== id);
          break;
        }
      }
      return next;
    });

    setSelectedObjectIds((prev) => prev.filter((item) => item !== id));
    setEditingObjectId((prev) => (prev === id ? null : prev));
    setIsDirty(true);

    if (deletedObj && targetPageIndex !== -1) {
      const objToRestore = deletedObj as EditorObject;
      historyManagerRef.current?.push({
        id: `delete_${id}`,
        type: "REMOVE_OBJECT",
        description: `Delete ${objToRestore.type}`,
        timestamp: Date.now(),
        undo: () => {
          setObjectsByPage((prev) => ({
            ...prev,
            [targetPageIndex]: [...(prev[targetPageIndex] || []), objToRestore],
          }));
        },
        redo: () => {
          setObjectsByPage((prev) => ({
            ...prev,
            [targetPageIndex]: (prev[targetPageIndex] || []).filter((o) => o.id !== id),
          }));
        },
      });
    }
  }, []);

  const deleteSelection = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    for (const id of selectedObjectIds) {
      deleteObject(id);
    }
    clearSelection();
  }, [selectedObjectIds, deleteObject, clearSelection]);

  // Undo / Redo
  const undo = useCallback(() => {
    historyManagerRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    historyManagerRef.current?.redo();
  }, []);

  // Export Payload
  const getExportPayload = useCallback((): IEditorExportPayload | null => {
    if (!fileId) return null;

    const pages = pageDimensions.map((page) => ({
      pageIndex: page.pageIndex,
      rotationDelta: 0,
      objects: objectsByPage[page.pageIndex] || [],
    }));

    return {
      fileId,
      options: {
        flatten: true,
      },
      pages,
    };
  }, [fileId, pageDimensions, objectsByPage]);

  // Initialize Raw Dimensions
  const initializeDocument = useCallback(
    (newFileId: string, newFileName: string, pages: IPageDimension[]) => {
      setFileId(newFileId);
      setFileName(newFileName);
      setPageDimensions(pages);
      setCurrentPageIndex(0);
      setIsDocumentLoaded(true);
      setIsLoading(false);
      setError(null);
      setViewportRotation(0);
      setIsPanning(false);
      setObjectsByPage({});
      setSelectedObjectIds([]);
      setEditingObjectId(null);
      historyManagerRef.current?.clear();
      setIsDirty(false);
    },
    []
  );

  // Load document from ArrayBuffer
  const loadFromBytes = useCallback(
    async (bytes: ArrayBuffer, docFileName: string, docFileId?: string) => {
      setIsLoading(true);
      setLoadingProgress(10);
      setError(null);

      // Clean up previous proxy
      if (pdfDocument) {
        await destroyPdfDocument(pdfDocument);
        setPdfDocument(null);
      }

      try {
        const doc = await loadPdfDocument(bytes, {
          onProgress: (pct) => setLoadingProgress(Math.min(90, Math.max(10, pct))),
        });

        const dimensions = await extractDocumentDimensions(doc);
        setLoadingProgress(95);

        const assignedId = docFileId || `file_${Date.now()}`;
        initializeDocument(assignedId, docFileName, dimensions);
        setPdfDocument(doc);
        setLoadingProgress(100);
      } catch (err: any) {
        console.error("[EditorContext] Failed to load PDF from bytes:", err);
        setError(err.message || "Failed to parse PDF document");
        setIsLoading(false);
      }
    },
    [pdfDocument, initializeDocument]
  );

  // Load document from File object
  const loadFromFile = useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer();
        await loadFromBytes(buffer, file.name);
      } catch (err: any) {
        setError("Failed to read file from disk");
      }
    },
    [loadFromBytes]
  );

  // Programmatic scroll lock ref to prevent observer loop
  const isProgrammaticScrollRef = useRef(false);

  // Scroll to a specific page and smoothly sync viewport
  const scrollToPage = useCallback(
    (pageIndex: number, behavior: ScrollBehavior = "smooth") => {
      const targetIndex = clamp(pageIndex, 0, Math.max(0, numPages - 1));
      setCurrentPageIndex(targetIndex);

      if (typeof document !== "undefined") {
        const targetEl = document.getElementById(`editor-page-${targetIndex}`);
        if (targetEl) {
          isProgrammaticScrollRef.current = true;
          targetEl.scrollIntoView({ behavior, block: "start" });
          setTimeout(() => {
            isProgrammaticScrollRef.current = false;
          }, 800);
        }
      }
    },
    [numPages]
  );

  // Load document from backend File ID with strict Content-Type & status validation
  const loadFromFileId = useCallback(
    async (targetFileId: string, targetFileName?: string) => {
      setIsLoading(true);
      setLoadingProgress(15);
      setError(null);

      try {
        const response = await fetch(`/api/v1/files/${targetFileId}/download`);

        // Handle non-200 responses
        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const errJson = await response.json().catch(() => null);
            throw new Error(errJson?.error?.message || `Server error (HTTP ${response.status})`);
          }
          throw new Error(`Failed to download PDF (HTTP ${response.status})`);
        }

        // Validate Content-Type
        const contentType = response.headers.get("content-type") || "";
        if (
          !contentType.includes("application/pdf") &&
          !contentType.includes("application/octet-stream")
        ) {
          if (contentType.includes("application/json")) {
            const errJson = await response.json().catch(() => null);
            throw new Error(errJson?.error?.message || "Server returned an error response instead of a PDF file");
          }
          throw new Error(`Invalid response format: ${contentType || "unknown"}. Expected PDF document.`);
        }

        // Validate Content-Length if available
        const contentLength = response.headers.get("content-length");
        if (contentLength === "0") {
          throw new Error("Downloaded PDF is empty (0 bytes)");
        }

        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0) {
          throw new Error("Downloaded PDF buffer is empty (0 bytes)");
        }

        await loadFromBytes(buffer, targetFileName || `${targetFileId}.pdf`, targetFileId);
      } catch (err: any) {
        console.error("[EditorContext] Error loading file from ID:", err);
        setError(err.message || "Failed to load document from server");
        setIsLoading(false);
      }
    },
    [loadFromBytes]
  );

  const value = useMemo<IEditorContextValue>(
    () => ({
      fileId,
      fileName,
      numPages,
      currentPageIndex,
      pageDimensions,
      isDocumentLoaded,
      isLoading,
      loadingProgress,
      error,
      pdfDocument,
      loadFromBytes,
      loadFromFile,
      loadFromFileId,
      zoom,
      fitMode,
      setZoom,
      zoomIn,
      zoomOut,
      resetZoom,
      setFitMode,
      setCurrentPageIndex,
      scrollToPage,
      isProgrammaticScroll: isProgrammaticScrollRef,
      viewportRotation,
      rotateViewClockwise,
      rotateViewCounterClockwise,
      resetViewRotation,
      isPanning,
      setIsPanning,
      activeTool,
      setActiveTool,
      activeProperties,
      updateActiveProperties,
      selectedObjectIds,
      editingObjectId,
      selectObject,
      setEditingObjectId,
      clearSelection,
      getSelectedObjects,
      objectsByPage,
      addObject,
      updateObject,
      commitResize,
      commitMove,
      commitRotate,
      deleteObject,
      deleteSelection,
      canUndo,
      canRedo,
      undo,
      redo,
      isDirty,
      getExportPayload,
      initializeDocument,
    }),
    [
      fileId,
      fileName,
      numPages,
      currentPageIndex,
      pageDimensions,
      isDocumentLoaded,
      isLoading,
      loadingProgress,
      error,
      pdfDocument,
      loadFromBytes,
      loadFromFile,
      loadFromFileId,
      zoom,
      fitMode,
      setZoom,
      zoomIn,
      zoomOut,
      resetZoom,
      setFitMode,
      setCurrentPageIndex,
      scrollToPage,
      viewportRotation,
      rotateViewClockwise,
      rotateViewCounterClockwise,
      resetViewRotation,
      isPanning,
      setIsPanning,
      activeTool,
      setActiveTool,
      activeProperties,
      updateActiveProperties,
      selectedObjectIds,
      editingObjectId,
      selectObject,
      setEditingObjectId,
      clearSelection,
      getSelectedObjects,
      objectsByPage,
      addObject,
      updateObject,
      commitResize,
      commitMove,
      commitRotate,
      deleteObject,
      deleteSelection,
      canUndo,
      canRedo,
      undo,
      redo,
      isDirty,
      getExportPayload,
      initializeDocument,
      historyStateVersion,
    ]
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): IEditorContextValue {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return context;
}
