/**
 * QuickPDF Platform - PDF Editor Backend Type Definitions
 * Phase 5.1 Foundation Architecture
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
  pageIndex: number;
  x: number;                  // PDF Standard points (72 DPI)
  y: number;                  // PDF Standard points (72 DPI)
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  isLocked?: boolean;
}

export interface ITextEditorObject extends IBaseEditorObject {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: EditorFontFamily;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline";
  color: string;
  textAlign: EditorTextAlign;
  lineHeight: number;
}

export interface IShapeEditorObject extends IBaseEditorObject {
  type: "shape";
  shapeType: ShapeKind;
  strokeColor: string;
  strokeWidth: number;
  strokeDashArray?: number[];
  fillColor: string;
}

export interface IDrawingEditorObject extends IBaseEditorObject {
  type: "drawing";
  isHighlighter: boolean;
  color: string;
  strokeWidth: number;
  points: Array<{ x: number; y: number }>;
}

export interface IImageEditorObject extends IBaseEditorObject {
  type: "image";
  src: string;
  originalWidth: number;
  originalHeight: number;
  aspectRatio: number;
}

export type EditorBackendObject =
  | ITextEditorObject
  | IShapeEditorObject
  | IDrawingEditorObject
  | IImageEditorObject;

export interface IEditorExportPayload {
  fileId: string;
  options?: {
    flatten?: boolean;
    compatibilityVersion?: "1.7" | "PDF/A-1b" | "PDF/A-2b";
  };
  pages: Array<{
    pageIndex: number;
    rotationDelta: number;
    objects: EditorBackendObject[];
  }>;
}

export interface IEditorSessionDraft {
  fileId: string;
  userId: string;
  lastModified: number;
  objectsByPage: Record<number, EditorBackendObject[]>;
}
