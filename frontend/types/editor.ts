/**
 * QuickPDF Platform - PDF Editor Core Type Definitions
 * Phase 5.1 Foundation Architecture
 * 
 * Strict Rule: All spatial coordinates (x, y, width, height, fontSize, strokeWidth)
 * are stored in absolute PDF Standard Points (72 DPI, 1 pt = 1/72 inch).
 */

export type EditorToolType =
  | "select"
  | "hand"
  | "text"
  | "image"
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "pen"
  | "highlighter"
  | "eraser"
  | "signature";

export type EditorFontFamily = "Helvetica" | "Times" | "Courier" | "Inter" | "Roboto" | "Arial";

export type EditorTextAlign = "left" | "center" | "right";

export type ShapeKind = "rectangle" | "circle" | "line" | "arrow";

export interface IBaseEditorObject {
  id: string;
  pageIndex: number;          // 0-indexed page index
  x: number;                  // PDF points from top-left
  y: number;                  // PDF points from top-left
  width: number;              // PDF points
  height: number;             // PDF points
  rotation: number;           // 0, 90, 180, 270 (or arbitrary degrees)
  opacity: number;            // 0.0 to 1.0
  zIndex: number;             // Rendering stack order
  isLocked?: boolean;         // Prevents user interaction when true
}

export interface ITextObject extends IBaseEditorObject {
  type: "text";
  text: string;
  fontSize: number;           // in points (e.g., 12, 16, 24)
  fontFamily: EditorFontFamily;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline";
  color: string;              // Hex string "#000000"
  textAlign: EditorTextAlign;
  lineHeight: number;         // Multiplier, default 1.2
}

export interface IShapeObject extends IBaseEditorObject {
  type: "shape";
  shapeType: ShapeKind;
  strokeColor: string;        // Hex string "#000000"
  strokeWidth: number;        // in points
  strokeDashArray?: number[]; // [dashLength, gapLength]
  fillColor: string;          // Hex string or "transparent"
}

export interface IDrawingPoint {
  x: number;                  // PDF points
  y: number;                  // PDF points
}

export interface IDrawingObject extends IBaseEditorObject {
  type: "drawing";
  isHighlighter: boolean;     // If true, rendered with multiply blend mode & fixed opacity
  color: string;              // Hex string
  strokeWidth: number;        // in points
  points: IDrawingPoint[];    // Ordered stream of points
}

export interface IImageObject extends IBaseEditorObject {
  type: "image";
  src: string;                // Data URL or asset storage key/URL
  originalWidth: number;      // Original pixel width
  originalHeight: number;     // Original pixel height
  aspectRatio: number;        // width / height
}

export type EditorObject = ITextObject | IShapeObject | IDrawingObject | IImageObject;

export interface IPageDimension {
  pageIndex: number;
  width: number;              // Width in PDF points (e.g. 595.28 for A4)
  height: number;             // Height in PDF points (e.g. 841.89 for A4)
  rotation: number;           // Native page rotation (0, 90, 180, 270)
}

export interface IEditorActiveProperties {
  color: string;
  fillColor: string;
  fontSize: number;
  fontFamily: EditorFontFamily;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline";
  textAlign: EditorTextAlign;
  lineHeight: number;
  strokeWidth: number;
  opacity: number;
}

export const MIN_TEXT_WIDTH = 40;   // 40 PDF points minimum width
export const MIN_TEXT_HEIGHT = 20;  // 20 PDF points minimum height
export const DEFAULT_TEXT_CONTENT = "Type here...";

export type EditorActionType =
  | "ADD_OBJECT"
  | "REMOVE_OBJECT"
  | "UPDATE_OBJECT"
  | "MOVE_OBJECTS"
  | "RESIZE_OBJECT"
  | "ROTATE_OBJECT"
  | "REORDER_OBJECTS"
  | "ROTATE_PAGE"
  | "DELETE_PAGE";

export interface IEditorAction {
  id: string;
  type: EditorActionType;
  description: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}

export interface IEditorState {
  // Document Context
  fileId: string | null;
  fileName: string;
  fileSize: number;
  numPages: number;
  currentPageIndex: number;   // 0-indexed
  pageDimensions: IPageDimension[];
  isDocumentLoaded: boolean;
  isLoading: boolean;
  loadingProgress: number;     // 0 - 100
  error: string | null;

  // Viewport Settings
  zoom: number;               // 1.0 = 100%, range 0.25 to 5.0
  fitMode: "custom" | "width" | "page";
  panOffset: { x: number; y: number };

  // Tool & Properties
  activeTool: EditorToolType;
  activeProperties: IEditorActiveProperties;

  // Selection
  selectedObjectIds: string[];
  editingObjectId: string | null;

  // Document Objects (Keyed by pageIndex)
  objectsByPage: Record<number, EditorObject[]>;

  // History / Undo / Redo
  canUndo: boolean;
  canRedo: boolean;

  // Persistence Status
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
}

/**
 * Payload manifest serialized to backend for vector burn-in PDF generation.
 */
export interface IEditorExportPayload {
  fileId: string;
  options?: {
    flatten?: boolean;
    compatibilityVersion?: "1.7" | "PDF/A-1b" | "PDF/A-2b";
  };
  pages: Array<{
    pageIndex: number;
    rotationDelta: number;    // Additional rotation applied by editor
    objects: EditorObject[];
  }>;
}
