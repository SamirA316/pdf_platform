/**
 * QuickPDF Platform - PDF Editor Coordinate System Engine
 * Phase 5.1 Foundation
 * 
 * Manages mathematical conversions between:
 * - PDF Ground Truth: 72 DPI points (standard ISO 32000 PDF dimensions)
 * - Viewport Screen Pixels: CSS display pixels at current zoom level
 */

export interface IPoint {
  x: number;
  y: number;
}

export interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeHandleType =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "rotate";

export const PDF_POINTS_PER_INCH = 72;
export const MIN_ZOOM = 0.25; // 25%
export const MAX_ZOOM = 4.0;  // 400%
export const ZOOM_STEP = 0.1; // 10%
export const ZOOM_PRESETS: number[] = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];

/**
 * Returns the next higher zoom level from standard presets.
 */
export function getNextZoomIn(currentZoom: number): number {
  const rounded = Math.round(currentZoom * 100) / 100;
  for (const preset of ZOOM_PRESETS) {
    if (preset > rounded + 0.01) {
      return preset;
    }
  }
  return MAX_ZOOM;
}

/**
 * Returns the next lower zoom level from standard presets.
 */
export function getNextZoomOut(currentZoom: number): number {
  const rounded = Math.round(currentZoom * 100) / 100;
  for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
    if (ZOOM_PRESETS[i] < rounded - 0.01) {
      return ZOOM_PRESETS[i];
    }
  }
  return MIN_ZOOM;
}

/**
 * Converts a PDF point value to screen CSS pixels at the given zoom level.
 */
export function pdfToScreen(pdfVal: number, zoom: number): number {
  return Math.round(pdfVal * zoom * 100) / 100;
}

/**
 * Converts screen CSS pixels back to PDF points at the given zoom level.
 */
export function screenToPdf(screenVal: number, zoom: number): number {
  if (zoom <= 0) return screenVal;
  return Math.round((screenVal / zoom) * 100) / 100;
}

/**
 * Converts a 2D point from PDF space to Screen space.
 */
export function pdfPointToScreen(point: IPoint, zoom: number): IPoint {
  return {
    x: pdfToScreen(point.x, zoom),
    y: pdfToScreen(point.y, zoom),
  };
}

/**
 * Converts a 2D point from Screen space to PDF space.
 */
export function screenPointToPdf(point: IPoint, zoom: number): IPoint {
  return {
    x: screenToPdf(point.x, zoom),
    y: screenToPdf(point.y, zoom),
  };
}

/**
 * Converts a rectangle from PDF space to Screen space.
 */
export function pdfRectToScreen(rect: IRect, zoom: number): IRect {
  return {
    x: pdfToScreen(rect.x, zoom),
    y: pdfToScreen(rect.y, zoom),
    width: pdfToScreen(rect.width, zoom),
    height: pdfToScreen(rect.height, zoom),
  };
}

/**
 * Converts a rectangle from Screen space to PDF space.
 */
export function screenRectToPdf(rect: IRect, zoom: number): IRect {
  return {
    x: screenToPdf(rect.x, zoom),
    y: screenToPdf(rect.y, zoom),
    width: screenToPdf(rect.width, zoom),
    height: screenToPdf(rect.height, zoom),
  };
}

/**
 * Calculates the optimal zoom factor to fit a page to container width or container page size.
 */
export function calculateFitZoom(
  pageWidthPt: number,
  pageHeightPt: number,
  containerWidthPx: number,
  containerHeightPx: number,
  mode: "width" | "page",
  paddingPx = 48
): number {
  const availableWidth = Math.max(containerWidthPx - paddingPx, 100);
  const availableHeight = Math.max(containerHeightPx - paddingPx, 100);

  if (mode === "width") {
    const calculated = availableWidth / pageWidthPt;
    return clamp(calculated, MIN_ZOOM, MAX_ZOOM);
  }

  const widthRatio = availableWidth / pageWidthPt;
  const heightRatio = availableHeight / pageHeightPt;
  const calculated = Math.min(widthRatio, heightRatio);
  return clamp(calculated, MIN_ZOOM, MAX_ZOOM);
}

/**
 * Restricts a numeric value to a [min, max] range.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Checks if a point lies inside a rectangular boundary.
 */
export function isPointInsideRect(point: IPoint, rect: IRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Returns positions of the 8 bounding box resize handles plus the rotation handle in screen pixels.
 */
export function getSelectionHandles(screenRect: IRect): Record<ResizeHandleType, IPoint> {
  const { x, y, width, height } = screenRect;
  const cx = x + width / 2;
  const cy = y + height / 2;

  return {
    "top-left": { x, y },
    "top-center": { x: cx, y },
    "top-right": { x: x + width, y },
    "middle-left": { x, y: cy },
    "middle-right": { x: x + width, y: cy },
    "bottom-left": { x, y: y + height },
    "bottom-center": { x: cx, y: y + height },
    "bottom-right": { x: x + width, y: y + height },
    "rotate": { x: cx, y: y - 24 }, // 24px above top center
  };
}

export type ViewportRotation = 0 | 90 | 180 | 270;

/**
 * Calculates swapped display dimensions if rotation is 90° or 270°.
 */
export function getRotatedDimensions(
  width: number,
  height: number,
  rotation: ViewportRotation
): { width: number; height: number } {
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width };
  }
  return { width, height };
}

/**
 * Transforms a point from unrotated page coordinates to viewport rotated coordinates.
 */
export function rotatePoint(
  point: IPoint,
  rotation: ViewportRotation,
  pageWidth: number,
  pageHeight: number
): IPoint {
  switch (rotation) {
    case 90:
      return { x: pageHeight - point.y, y: point.x };
    case 180:
      return { x: pageWidth - point.x, y: pageHeight - point.y };
    case 270:
      return { x: point.y, y: pageWidth - point.x };
    case 0:
    default:
      return { x: point.x, y: point.y };
  }
}

/**
 * Transforms a point from viewport rotated coordinates back to unrotated page coordinates.
 */
export function unrotatePoint(
  rotatedPoint: IPoint,
  rotation: ViewportRotation,
  pageWidth: number,
  pageHeight: number
): IPoint {
  switch (rotation) {
    case 90:
      return { x: rotatedPoint.y, y: pageHeight - rotatedPoint.x };
    case 180:
      return { x: pageWidth - rotatedPoint.x, y: pageHeight - rotatedPoint.y };
    case 270:
      return { x: pageWidth - rotatedPoint.y, y: rotatedPoint.x };
    case 0:
    default:
      return { x: rotatedPoint.x, y: rotatedPoint.y };
  }
}

/**
 * Transforms screen display pixels relative to the page container into Ground-Truth PDF Points (72 DPI)
 * by sequentially inverting Viewport Rotation and Native Page Rotation.
 */
export function screenPointToGroundTruthPdf(
  screenX: number,
  screenY: number,
  zoom: number,
  pageWidth: number,
  pageHeight: number,
  nativeRotation: ViewportRotation = 0,
  viewportRotation: ViewportRotation = 0
): IPoint {
  const rawPdfX = screenToPdf(screenX, zoom);
  const rawPdfY = screenToPdf(screenY, zoom);

  const nativeDim = getRotatedDimensions(pageWidth, pageHeight, nativeRotation);
  const afterViewportInverse = unrotatePoint(
    { x: rawPdfX, y: rawPdfY },
    viewportRotation,
    nativeDim.width,
    nativeDim.height
  );

  const groundTruth = unrotatePoint(
    afterViewportInverse,
    nativeRotation,
    pageWidth,
    pageHeight
  );

  return groundTruth;
}

export const MIN_TEXT_WIDTH = 40;
export const MIN_TEXT_HEIGHT = 20;

/**
 * Returns the fixed anchor point (opposite corner) in PDF space for a given resize handle.
 */
export function getResizeAnchor(origRect: IRect, handle: ResizeHandleType): IPoint {
  switch (handle) {
    case "top-left":
      return { x: origRect.x + origRect.width, y: origRect.y + origRect.height };
    case "top-right":
      return { x: origRect.x, y: origRect.y + origRect.height };
    case "bottom-left":
      return { x: origRect.x + origRect.width, y: origRect.y };
    case "bottom-right":
    default:
      return { x: origRect.x, y: origRect.y };
  }
}

/**
 * Calculates deterministic 1D position and size for an axis given a fixed anchor,
 * pointer position, page boundary, and minimum size constraint.
 *
 * Rules:
 * 1. The opposite anchor is preserved whenever mathematically possible:
 *    - Dragging positive (pointer >= anchor): pos = clampedAnchor
 *    - Dragging negative (pointer < anchor): pos + size = clampedAnchor
 * 2. Bounds constraint: pos >= 0 and pos + size <= pageSize at all times.
 * 3. Minimum size constraint (minSize) is respected whenever available space >= minSize.
 * 4. Boundary collision determinism: When available space between anchor and page edge
 *    is strictly less than minSize, the fixed anchor is strictly preserved, the page boundary
 *    is maintained, and the size is capped to the maximum feasible space (available).
 */
export function resizeAxis(
  anchor: number,
  pointer: number,
  pageSize: number,
  minSize: number
): { pos: number; size: number } {
  const clampedAnchor = Math.max(0, Math.min(pageSize, anchor));
  const clampedPointer = Math.max(0, Math.min(pageSize, pointer));

  if (clampedPointer >= clampedAnchor) {
    const available = pageSize - clampedAnchor;
    const effectiveMin = Math.min(minSize, available);
    const rawSpan = clampedPointer - clampedAnchor;
    const size = Math.min(available, Math.max(effectiveMin, rawSpan));
    return { pos: clampedAnchor, size };
  } else {
    const available = clampedAnchor;
    const effectiveMin = Math.min(minSize, available);
    const rawSpan = clampedAnchor - clampedPointer;
    const size = Math.min(available, Math.max(effectiveMin, rawSpan));
    return { pos: clampedAnchor - size, size };
  }
}

/**
 * Calculates the new bounding box given an anchor corner and the pointer's position in PDF points.
 * Ensures the rect satisfies minimum width/height and remains clamped to page boundaries.
 * Supports inverted/reverse dragging across all 4 quadrants while strictly preserving the opposite anchor.
 */
export function calculateResizedRect(
  anchor: IPoint,
  pointerPdf: IPoint,
  pageWidth: number,
  pageHeight: number,
  minWidth = MIN_TEXT_WIDTH,
  minHeight = MIN_TEXT_HEIGHT
): IRect {
  const xRes = resizeAxis(anchor.x, pointerPdf.x, pageWidth, minWidth);
  const yRes = resizeAxis(anchor.y, pointerPdf.y, pageHeight, minHeight);

  return {
    x: Math.round(xRes.pos * 100) / 100,
    y: Math.round(yRes.pos * 100) / 100,
    width: Math.round(xRes.size * 100) / 100,
    height: Math.round(yRes.size * 100) / 100,
  };
}

/**
 * Calculates the clamped (x, y) position for moving an object while preserving grab offset
 * and staying strictly within page boundaries [0, pageWidth] and [0, pageHeight].
 */
export function calculateMovedPosition(
  pointerPdf: IPoint,
  grabOffset: IPoint,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number
): IPoint {
  const targetX = pointerPdf.x - grabOffset.x;
  const targetY = pointerPdf.y - grabOffset.y;

  const maxX = Math.max(0, pageWidth - width);
  const maxY = Math.max(0, pageHeight - height);

  const clampedX = Math.max(0, Math.min(maxX, targetX));
  const clampedY = Math.max(0, Math.min(maxY, targetY));

  return {
    x: Math.round(clampedX * 100) / 100,
    y: Math.round(clampedY * 100) / 100,
  };
}

/**
 * Normalizes an angle in degrees to the standard range [0, 360).
 * Handles negative degrees and arbitrary multiples of 360:
 * -10° -> 350°
 * 360° -> 0°
 * 370° -> 10°
 * 720° -> 0°
 */
export function normalizeAngle(degrees: number): number {
  let normalized = degrees % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  if (Object.is(normalized, -0) || Math.abs(normalized - 360) < 1e-9) {
    normalized = 0;
  }
  return Math.round(normalized * 100) / 100;
}

/**
 * Calculates the visual rotation angle in degrees [0, 360) for an object
 * around its center given the current pointer position in PDF points.
 * 0° points straight upward (towards the top of the unrotated page).
 */
export function calculateRotationAngle(center: IPoint, pointer: IPoint): number {
  const dx = pointer.x - center.x;
  const dy = pointer.y - center.y;

  // In PDF/Screen coords where Y increases downwards, straight up (dx=0, dy < 0) is 0°
  const rad = Math.atan2(dy, dx) + Math.PI / 2;
  const degrees = (rad * 180) / Math.PI;
  return Math.round(normalizeAngle(degrees)) % 360;
}



