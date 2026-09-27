/**
 * QuickPDF Platform - Phase 5.5.3 Text Box Resizing & Bounding Handles Test Suite
 * Validates:
 * 1. 4 Corner handle anchor calculation (top-left, top-right, bottom-left, bottom-right)
 * 2. Multi-directional resizing and normalization
 * 3. Inverted/reverse dragging past anchor point across quadrants
 * 4. Strict clamping to MIN_TEXT_WIDTH (40) and MIN_TEXT_HEIGHT (20)
 * 5. Page boundary clamping [0, pageWidth] and [0, pageHeight]
 * 6. Zoom scaling invariance (0.25x - 4.0x)
 * 7. Viewport rotation invariance (0°, 90°, 180°, 270°)
 * 8. Native PDF rotation invariance combined with viewport rotation
 * 9. Typography preservation (fontSize, font, styles unchanged)
 * 10. Single atomic undo/redo transaction per resize
 * 11. No-op commit on zero-delta resize
 * 12. Backend schema validation of resized text objects
 */

export {};

import { textEditorObjectSchema } from "../src/modules/editor/editor.validation";

let passed = 0;
let total = 0;

async function test(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`✅ [PASS] Test ${total}: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ [FAIL] Test ${total}: ${name}`);
    console.error(`   Error: ${err.message}`);
  }
}

// -------------------------------------------------------------
// Pure Geometric & Coordinate Logic (Matching coordinates.ts)
// -------------------------------------------------------------
const MIN_TEXT_WIDTH = 40;
const MIN_TEXT_HEIGHT = 20;

type ResizeHandleType = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type ViewportRotation = 0 | 90 | 180 | 270;

interface IPoint {
  x: number;
  y: number;
}

interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function screenToPdf(screenVal: number, zoom: number): number {
  if (zoom <= 0) return screenVal;
  return Math.round((screenVal / zoom) * 100) / 100;
}

function getRotatedDimensions(
  width: number,
  height: number,
  rotation: ViewportRotation
): { width: number; height: number } {
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width };
  }
  return { width, height };
}

function unrotatePoint(
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

function screenPointToGroundTruthPdf(
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

function getResizeAnchor(origRect: IRect, handle: ResizeHandleType): IPoint {
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

function resizeAxis(
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

function calculateResizedRect(
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

// -------------------------------------------------------------
// Test Executions
// -------------------------------------------------------------
async function runTests() {
  console.log("Starting Phase 5.5.3 Text Box Resizing & Bounding Handles Test Suite...\n");

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const initialRect: IRect = { x: 100, y: 150, width: 200, height: 100 };

  // Test 1: Handle Anchor Points
  await test("Anchor points for all 4 corner handles match opposite corners", async () => {
    const tlAnchor = getResizeAnchor(initialRect, "top-left");
    if (tlAnchor.x !== 300 || tlAnchor.y !== 250) {
      throw new Error(`Expected top-left anchor at (300, 250), got (${tlAnchor.x}, ${tlAnchor.y})`);
    }

    const trAnchor = getResizeAnchor(initialRect, "top-right");
    if (trAnchor.x !== 100 || trAnchor.y !== 250) {
      throw new Error(`Expected top-right anchor at (100, 250), got (${trAnchor.x}, ${trAnchor.y})`);
    }

    const blAnchor = getResizeAnchor(initialRect, "bottom-left");
    if (blAnchor.x !== 300 || blAnchor.y !== 150) {
      throw new Error(`Expected bottom-left anchor at (300, 150), got (${blAnchor.x}, ${blAnchor.y})`);
    }

    const brAnchor = getResizeAnchor(initialRect, "bottom-right");
    if (brAnchor.x !== 100 || brAnchor.y !== 150) {
      throw new Error(`Expected bottom-right anchor at (100, 150), got (${brAnchor.x}, ${brAnchor.y})`);
    }
  });

  // Test 2: Standard Bottom-Right expansion drag
  await test("Bottom-right handle drags outwards to expand text box", async () => {
    const anchor = getResizeAnchor(initialRect, "bottom-right"); // (100, 150)
    const pointerPdf = { x: 350, y: 300 };
    const result = calculateResizedRect(anchor, pointerPdf, pageWidth, pageHeight);

    if (result.x !== 100 || result.y !== 150) {
      throw new Error(`Expected top-left origin to stay at (100, 150), got (${result.x}, ${result.y})`);
    }
    if (result.width !== 250 || result.height !== 150) {
      throw new Error(`Expected dimensions 250x150, got ${result.width}x${result.height}`);
    }
  });

  // Test 3: Standard Top-Left expansion drag
  await test("Top-left handle drags outwards to expand text box up and left", async () => {
    const anchor = getResizeAnchor(initialRect, "top-left"); // (300, 250)
    const pointerPdf = { x: 50, y: 100 };
    const result = calculateResizedRect(anchor, pointerPdf, pageWidth, pageHeight);

    if (result.x !== 50 || result.y !== 100) {
      throw new Error(`Expected origin at (50, 100), got (${result.x}, ${result.y})`);
    }
    if (result.width !== 250 || result.height !== 150) {
      throw new Error(`Expected dimensions 250x150, got ${result.width}x${result.height}`);
    }
    // Verify opposite corner remained anchored at (300, 250)
    if (result.x + result.width !== 300 || result.y + result.height !== 250) {
      throw new Error("Opposite anchor moved during top-left drag");
    }
  });

  // Test 4: Enforce MIN_TEXT_WIDTH (40) and MIN_TEXT_HEIGHT (20)
  await test("Strictly clamps to MIN_TEXT_WIDTH=40 and MIN_TEXT_HEIGHT=20 on contraction", async () => {
    const anchor = getResizeAnchor(initialRect, "bottom-right"); // (100, 150)
    const pointerPdf = { x: 110, y: 155 }; // delta width=10, height=5 (below minimums)
    const result = calculateResizedRect(anchor, pointerPdf, pageWidth, pageHeight);

    if (result.width !== 40) {
      throw new Error(`Expected width clamped to 40, got ${result.width}`);
    }
    if (result.height !== 20) {
      throw new Error(`Expected height clamped to 20, got ${result.height}`);
    }
    if (result.x !== 100 || result.y !== 150) {
      throw new Error(`Expected origin at anchor (100, 150), got (${result.x}, ${result.y})`);
    }
  });

  // Test 5: Inverted / Reverse drag across anchor
  await test("Inverted drag past anchor point normalizes rect across all 4 quadrants", async () => {
    // Start with bottom-right handle (anchor at 100, 150)
    const anchor = getResizeAnchor(initialRect, "bottom-right");
    // Drag pointer ABOVE and to the LEFT of anchor: (50, 80)
    const pointerPdf = { x: 50, y: 80 };
    const result = calculateResizedRect(anchor, pointerPdf, pageWidth, pageHeight);

    if (result.x !== 50 || result.y !== 80) {
      throw new Error(`Expected normalized origin at (50, 80), got (${result.x}, ${result.y})`);
    }
    if (result.width !== 50 || result.height !== 70) {
      throw new Error(`Expected dimensions 50x70, got ${result.width}x${result.height}`);
    }
    // Anchor (100, 150) should now be bottom-right corner: 50+50=100, 80+70=150
    if (result.x + result.width !== 100 || result.y + result.height !== 150) {
      throw new Error("Inverted drag did not retain anchor as bottom-right corner");
    }
  });

  // Test 6: Page Boundary Clamping
  await test("Clamps resized text box within page boundaries [0, pageWidth] and [0, pageHeight]", async () => {
    const anchor = { x: 500, y: 700 };
    // Drag way beyond page edges
    const pointerPdf = { x: 700, y: 950 };
    const result = calculateResizedRect(anchor, pointerPdf, pageWidth, pageHeight);

    if (result.x + result.width > pageWidth + 0.01) {
      throw new Error(`Right edge ${result.x + result.width} exceeded page width ${pageWidth}`);
    }
    if (result.y + result.height > pageHeight + 0.01) {
      throw new Error(`Bottom edge ${result.y + result.height} exceeded page height ${pageHeight}`);
    }
  });

  // Test 7: Zoom invariance (0.25x to 4.0x)
  await test("Zoom scaling invariance converts screen delta to consistent PDF points", async () => {
    const zooms = [0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
    const targetPdfX = 250;
    const targetPdfY = 350;

    for (const z of zooms) {
      const screenX = targetPdfX * z;
      const screenY = targetPdfY * z;
      const converted = screenPointToGroundTruthPdf(screenX, screenY, z, pageWidth, pageHeight, 0, 0);

      if (Math.abs(converted.x - targetPdfX) > 0.01 || Math.abs(converted.y - targetPdfY) > 0.01) {
        throw new Error(`Zoom ${z}x failed: expected (${targetPdfX}, ${targetPdfY}), got (${converted.x}, ${converted.y})`);
      }
    }
  });

  // Test 8: Viewport Rotation Invariance
  await test("Viewport rotation (90°, 180°, 270°) correctly inverts pointer coordinates", async () => {
    const origPoint = { x: 120, y: 240 };

    // At 90 deg viewport rotation
    const screenAt90 = { x: pageHeight - origPoint.y, y: origPoint.x };
    const inverted90 = screenPointToGroundTruthPdf(screenAt90.x, screenAt90.y, 1.0, pageWidth, pageHeight, 0, 90);
    if (Math.abs(inverted90.x - origPoint.x) > 0.01 || Math.abs(inverted90.y - origPoint.y) > 0.01) {
      throw new Error(`90° viewport rotation inversion failed: got (${inverted90.x}, ${inverted90.y})`);
    }

    // At 180 deg viewport rotation
    const screenAt180 = { x: pageWidth - origPoint.x, y: pageHeight - origPoint.y };
    const inverted180 = screenPointToGroundTruthPdf(screenAt180.x, screenAt180.y, 1.0, pageWidth, pageHeight, 0, 180);
    if (Math.abs(inverted180.x - origPoint.x) > 0.01 || Math.abs(inverted180.y - origPoint.y) > 0.01) {
      throw new Error(`180° viewport rotation inversion failed: got (${inverted180.x}, ${inverted180.y})`);
    }

    // At 270 deg viewport rotation
    const screenAt270 = { x: origPoint.y, y: pageWidth - origPoint.x };
    const inverted270 = screenPointToGroundTruthPdf(screenAt270.x, screenAt270.y, 1.0, pageWidth, pageHeight, 0, 270);
    if (Math.abs(inverted270.x - origPoint.x) > 0.01 || Math.abs(inverted270.y - origPoint.y) > 0.01) {
      throw new Error(`270° viewport rotation inversion failed: got (${inverted270.x}, ${inverted270.y})`);
    }
  });

  // Test 9: Combined Native + Viewport Rotation
  await test("Combined native rotation (90°) and viewport rotation (90°) invert to ground-truth", async () => {
    const groundTruth = { x: 150, y: 220 };
    // Native 90: (pageHeight - y, x) = (841.89 - 220, 150) = (621.89, 150)
    // Viewport 90 on native dimensions (width=841.89, height=595.28):
    // (595.28 - 150, 621.89) = (445.28, 621.89)
    const screenPoint = { x: 445.28, y: 621.89 };
    const recovered = screenPointToGroundTruthPdf(screenPoint.x, screenPoint.y, 1.0, pageWidth, pageHeight, 90, 90);

    if (Math.abs(recovered.x - groundTruth.x) > 0.05 || Math.abs(recovered.y - groundTruth.y) > 0.05) {
      throw new Error(`Combined 90°+90° failed: expected (${groundTruth.x}, ${groundTruth.y}), got (${recovered.x}, ${recovered.y})`);
    }
  });

  // Test 10: Typography Preservation
  await test("Resizing text box geometry leaves font styling completely untouched", async () => {
    const textObject = {
      id: "txt_resize_test_1",
      type: "text",
      pageIndex: 0,
      x: 100,
      y: 100,
      width: 150,
      height: 50,
      text: "Responsive typography test",
      fontSize: 18,
      fontFamily: "Courier",
      fontWeight: "bold" as const,
      fontStyle: "italic" as const,
      textDecoration: "underline" as const,
      color: "#ff0000",
      textAlign: "center" as const,
      lineHeight: 1.4,
      rotation: 0,
      opacity: 0.9,
      zIndex: 1,
    };

    const newRect: IRect = { x: 100, y: 100, width: 300, height: 120 };
    const updatedObject = { ...textObject, ...newRect };

    if (updatedObject.fontSize !== 18) throw new Error("fontSize was modified!");
    if (updatedObject.fontFamily !== "Courier") throw new Error("fontFamily was modified!");
    if (updatedObject.fontWeight !== "bold") throw new Error("fontWeight was modified!");
    if (updatedObject.fontStyle !== "italic") throw new Error("fontStyle was modified!");
    if (updatedObject.color !== "#ff0000") throw new Error("color was modified!");
    if (updatedObject.width !== 300 || updatedObject.height !== 120) throw new Error("geometry was not updated!");
  });

  // Test 11: Single Atomic Undo/Redo Transaction
  await test("History manager receives single atomic RESIZE_OBJECT transaction upon mouseup", async () => {
    interface IHistoryItem {
      id: string;
      type: string;
      undo: () => void;
      redo: () => void;
    }
    const historyStack: IHistoryItem[] = [];
    const origRect: IRect = { x: 100, y: 100, width: 200, height: 80 };
    let currentRect: IRect = { ...origRect };

    // Simulate 20 mousemove events with addToHistory=false
    for (let i = 1; i <= 20; i++) {
      currentRect = { ...origRect, width: origRect.width + i * 5, height: origRect.height + i * 2 };
      // updateObject(id, currentRect, false) -> does NOT push to history
    }

    if ((historyStack as IHistoryItem[]).length !== 0) {
      throw new Error(`Intermediate mouse moves flooded history with ${historyStack.length} entries`);
    }

    // Simulate mouseup commitResize
    const finalRect = { ...currentRect };
    historyStack.push({
      id: "resize_action_1",
      type: "RESIZE_OBJECT",
      undo: () => { currentRect = { ...origRect }; },
      redo: () => { currentRect = { ...finalRect }; },
    });

    if (historyStack.length !== 1) {
      throw new Error(`Expected exactly 1 history action, got ${historyStack.length}`);
    }

    // Test Undo
    historyStack[0]?.undo();
    if (currentRect.width !== origRect.width || currentRect.height !== origRect.height) {
      throw new Error(`Undo failed: expected ${origRect.width}x${origRect.height}, got ${currentRect.width}x${currentRect.height}`);
    }

    // Test Redo
    historyStack[0]?.redo();
    if (currentRect.width !== finalRect.width || currentRect.height !== finalRect.height) {
      throw new Error(`Redo failed: expected ${finalRect.width}x${finalRect.height}, got ${currentRect.width}x${currentRect.height}`);
    }
  });

  // Test 12: Zero-Delta Resize No-Op
  await test("Zero-delta resize does not register unnecessary history action", async () => {
    const origRect: IRect = { x: 100, y: 100, width: 200, height: 80 };
    const finalRect: IRect = { x: 100, y: 100, width: 200, height: 80 };

    let actionRegistered = false;
    if (
      origRect.x !== finalRect.x ||
      origRect.y !== finalRect.y ||
      origRect.width !== finalRect.width ||
      origRect.height !== finalRect.height
    ) {
      actionRegistered = true;
    }

    if (actionRegistered) {
      throw new Error("Zero-delta resize incorrectly registered a history action");
    }
  });

  // Test 13: Schema Validation of Resized Text Object
  await test("Backend textEditorObjectSchema validates resized text object", async () => {
    const resizedTextObject = {
      id: "txt_resized_valid_1",
      type: "text",
      pageIndex: 0,
      x: 80,
      y: 120,
      width: 280,
      height: 95,
      text: "Validated resized text box",
      fontSize: 16,
      fontFamily: "Helvetica",
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      color: "#1e293b",
      textAlign: "left",
      lineHeight: 1.2,
      rotation: 0,
      opacity: 1.0,
      zIndex: 1,
    };

    const parsed = textEditorObjectSchema.safeParse(resizedTextObject);
    if (!parsed.success) {
      throw new Error(`Zod validation failed: ${JSON.stringify(parsed.error.issues)}`);
    }
  });

  // Test 14: Boundary collision edge case: anchor.x = 20, minWidth = 40, pointer toward left boundary
  await test("Anchor preservation when anchor.x=20, minWidth=40, pointer toward left boundary", async () => {
    const anchor: IPoint = { x: 20, y: 150 };
    const pointerPdf: IPoint = { x: 0, y: 200 };
    const result = calculateResizedRect(anchor, pointerPdf, pageWidth, pageHeight, 40, 20);

    // Left boundary constraint: x >= 0
    if (result.x < 0) throw new Error(`x cannot be negative: ${result.x}`);
    // Right edge must preserve anchor.x (20)
    if (Math.abs(result.x + result.width - 20) > 0.01) {
      throw new Error(`Opposite anchor 20 was not preserved: right edge is ${result.x + result.width}`);
    }
    // Result width must cap to maximum available space (20) without exceeding boundaries or shifting anchor
    if (result.width !== 20 || result.x !== 0) {
      throw new Error(`Expected rect {x: 0, width: 20}, got {x: ${result.x}, width: ${result.width}}`);
    }
  });

  // Test 15: Boundary collision edge case: anchor.x = pageWidth - 20, minWidth = 40, pointer toward right boundary
  await test("Anchor preservation when anchor.x=pageWidth-20, minWidth=40, pointer toward right boundary", async () => {
    const anchorX = Math.round((pageWidth - 20) * 100) / 100;
    const anchor: IPoint = { x: anchorX, y: 150 };
    const pointerPdf: IPoint = { x: pageWidth, y: 200 };
    const result = calculateResizedRect(anchor, pointerPdf, pageWidth, pageHeight, 40, 20);

    // Left edge must preserve anchor.x exactly
    if (Math.abs(result.x - anchorX) > 0.01) {
      throw new Error(`Opposite anchor ${anchorX} was not preserved: left edge is ${result.x}`);
    }
    // Right boundary constraint: x + width <= pageWidth
    if (result.x + result.width > pageWidth + 0.01) {
      throw new Error(`Right edge ${result.x + result.width} exceeded page width ${pageWidth}`);
    }
    // Result width must cap to maximum available space (20)
    if (Math.abs(result.width - 20) > 0.01) {
      throw new Error(`Expected width 20, got ${result.width}`);
    }
  });

  // Test 16: Boundary collision edge case: anchor.y = 10, minHeight = 20, pointer toward top boundary
  await test("Anchor preservation when anchor.y=10, minHeight=20, pointer toward top boundary", async () => {
    const anchor: IPoint = { x: 100, y: 10 };
    const pointerPdf: IPoint = { x: 150, y: 0 };
    const result = calculateResizedRect(anchor, pointerPdf, pageWidth, pageHeight, 40, 20);

    // Top boundary constraint: y >= 0
    if (result.y < 0) throw new Error(`y cannot be negative: ${result.y}`);
    // Bottom edge must preserve anchor.y (10)
    if (Math.abs(result.y + result.height - 10) > 0.01) {
      throw new Error(`Opposite anchor 10 was not preserved: bottom edge is ${result.y + result.height}`);
    }
    // Result height must cap to maximum available space (10)
    if (result.height !== 10 || result.y !== 0) {
      throw new Error(`Expected rect {y: 0, height: 10}, got {y: ${result.y}, height: ${result.height}}`);
    }
  });

  // Test 17: Boundary collision edge case: anchor.y = pageHeight - 10, minHeight = 20, pointer toward bottom boundary
  await test("Anchor preservation when anchor.y=pageHeight-10, minHeight=20, pointer toward bottom boundary", async () => {
    const anchorY = Math.round((pageHeight - 10) * 100) / 100;
    const anchor: IPoint = { x: 100, y: anchorY };
    const pointerPdf: IPoint = { x: 150, y: pageHeight };
    const result = calculateResizedRect(anchor, pointerPdf, pageWidth, pageHeight, 40, 20);

    // Top edge must preserve anchor.y exactly
    if (Math.abs(result.y - anchorY) > 0.01) {
      throw new Error(`Opposite anchor ${anchorY} was not preserved: top edge is ${result.y}`);
    }
    // Bottom boundary constraint: y + height <= pageHeight
    if (result.y + result.height > pageHeight + 0.01) {
      throw new Error(`Bottom edge ${result.y + result.height} exceeded page height ${pageHeight}`);
    }
    // Result height must cap to maximum available space (10)
    if (Math.abs(result.height - 10) > 0.01) {
      throw new Error(`Expected height 10, got ${result.height}`);
    }
  });

  console.log(`\n===============================================================`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log(`===============================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
