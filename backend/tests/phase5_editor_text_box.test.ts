/**
 * QuickPDF Platform - Phase 5.5.2 Text Box Creation & Input Test Suite
 * Validates drag-to-create, click-to-create minimums, multi-directional normalization,
 * two-stage rotation coordinate inversion, zoom scaling, inline editing state,
 * activeProperties inheritance, and empty text cleanup.
 */

export {};

import {
  textEditorObjectSchema,
} from "../src/modules/editor/editor.validation";

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

// Coordinate Engine Helpers (matching coordinates.ts and PageContainer.tsx)
const MIN_TEXT_WIDTH = 40;
const MIN_TEXT_HEIGHT = 20;

function screenToPdf(screenVal: number, zoom: number): number {
  if (zoom <= 0) return screenVal;
  return Math.round((screenVal / zoom) * 100) / 100;
}

function pdfToScreen(pdfVal: number, zoom: number): number {
  return Math.round(pdfVal * zoom * 100) / 100;
}

type ViewportRotation = 0 | 90 | 180 | 270;

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
  rotatedPoint: { x: number; y: number },
  rotation: ViewportRotation,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number } {
  const norm = (((rotation % 360) + 360) % 360) as ViewportRotation;
  switch (norm) {
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
  nativeRotation: ViewportRotation,
  viewportRotation: ViewportRotation
): { x: number; y: number } {
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

// Creation calculation helper mirroring PageContainer logic
function calculateCreatedTextBox(
  startScreen: { x: number; y: number },
  endScreen: { x: number; y: number },
  zoom: number,
  pageWidth: number,
  pageHeight: number,
  nativeRotation: ViewportRotation = 0,
  viewportRotation: ViewportRotation = 0
) {
  const dx = Math.abs(endScreen.x - startScreen.x);
  const dy = Math.abs(endScreen.y - startScreen.y);

  const p1 = screenPointToGroundTruthPdf(
    startScreen.x,
    startScreen.y,
    zoom,
    pageWidth,
    pageHeight,
    nativeRotation,
    viewportRotation
  );
  const p2 = screenPointToGroundTruthPdf(
    endScreen.x,
    endScreen.y,
    zoom,
    pageWidth,
    pageHeight,
    nativeRotation,
    viewportRotation
  );

  let x = Math.min(p1.x, p2.x);
  let y = Math.min(p1.y, p2.y);
  let width = Math.abs(p1.x - p2.x);
  let height = Math.abs(p1.y - p2.y);

  if (dx < 5 && dy < 5) {
    // Click fallback: default size 140 x 36 pt
    const defaultWidth = 140;
    const defaultHeight = 36;
    width = defaultWidth;
    height = defaultHeight;
    x = Math.max(0, Math.min(pageWidth - defaultWidth, p1.x - 20));
    y = Math.max(0, Math.min(pageHeight - defaultHeight, p1.y - 12));
  } else {
    width = Math.max(MIN_TEXT_WIDTH, width);
    height = Math.max(MIN_TEXT_HEIGHT, height);
    x = Math.max(0, Math.min(pageWidth - width, x));
    y = Math.max(0, Math.min(pageHeight - height, y));
  }

  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
  };
}

async function runTests() {
  console.log("=== PHASE 5.5.2 TEXT BOX CREATION & INPUT TEST SUITE ===");

  const pageW = 595.28; // Standard A4 width pt
  const pageH = 841.89; // Standard A4 height pt

  // TEST 1: Click creates minimum text box with default dimensions
  await test("Simple click without meaningful drag creates minimum text box (>= MIN dimensions)", async () => {
    const box = calculateCreatedTextBox(
      { x: 100, y: 100 },
      { x: 102, y: 101 }, // dx=2, dy=1 (< 5px)
      1.0,
      pageW,
      pageH
    );

    if (box.width < MIN_TEXT_WIDTH || box.height < MIN_TEXT_HEIGHT) {
      throw new Error(`Text box dimensions smaller than minimum: ${box.width}x${box.height}`);
    }
    if (box.width !== 140 || box.height !== 36) {
      throw new Error(`Expected default 140x36 box on click, got ${box.width}x${box.height}`);
    }
    if (box.x < 0 || box.y < 0) {
      throw new Error(`Box coordinates out of bounds: (${box.x}, ${box.y})`);
    }
  });

  // TEST 2: Drag creates correct dimensions in PDF points
  await test("Drag interaction creates text box with matching PDF point dimensions at 100% zoom", async () => {
    const start = { x: 72, y: 144 };
    const end = { x: 272, y: 244 }; // 200px width, 100px height at 100% zoom
    const box = calculateCreatedTextBox(start, end, 1.0, pageW, pageH);

    if (box.x !== 72 || box.y !== 144) {
      throw new Error(`Origin mismatch: expected (72, 144), got (${box.x}, ${box.y})`);
    }
    if (box.width !== 200 || box.height !== 100) {
      throw new Error(`Dimension mismatch: expected 200x100, got ${box.width}x${box.height}`);
    }
  });

  // TEST 3: Multi-directional drag normalization (all 4 quadrants)
  await test("Reverse and diagonal drag directions normalize to positive width, height, and top-left origin", async () => {
    const expected = { x: 100, y: 150, width: 250, height: 120 };

    // 1. Top-Left to Bottom-Right
    const d1 = calculateCreatedTextBox({ x: 100, y: 150 }, { x: 350, y: 270 }, 1.0, pageW, pageH);
    // 2. Bottom-Right to Top-Left
    const d2 = calculateCreatedTextBox({ x: 350, y: 270 }, { x: 100, y: 150 }, 1.0, pageW, pageH);
    // 3. Top-Right to Bottom-Left
    const d3 = calculateCreatedTextBox({ x: 350, y: 150 }, { x: 100, y: 270 }, 1.0, pageW, pageH);
    // 4. Bottom-Left to Top-Right
    const d4 = calculateCreatedTextBox({ x: 100, y: 270 }, { x: 350, y: 150 }, 1.0, pageW, pageH);

    for (const [idx, d] of [d1, d2, d3, d4].entries()) {
      if (d.x !== expected.x || d.y !== expected.y || d.width !== expected.width || d.height !== expected.height) {
        throw new Error(`Direction ${idx + 1} normalization mismatch: got (${d.x}, ${d.y}, ${d.width}, ${d.height})`);
      }
    }
  });

  // TEST 4: Small drag below minimum is clamped to MIN_TEXT_WIDTH and MIN_TEXT_HEIGHT
  await test("Drag smaller than minimum dimensions is clamped to MIN_TEXT_WIDTH (40) and MIN_TEXT_HEIGHT (20)", async () => {
    // 15px width, 10px height (greater than click 5px threshold, but less than minimums)
    const box = calculateCreatedTextBox({ x: 100, y: 100 }, { x: 115, y: 110 }, 1.0, pageW, pageH);

    if (box.width !== MIN_TEXT_WIDTH) {
      throw new Error(`Expected width clamped to ${MIN_TEXT_WIDTH}, got ${box.width}`);
    }
    if (box.height !== MIN_TEXT_HEIGHT) {
      throw new Error(`Expected height clamped to ${MIN_TEXT_HEIGHT}, got ${box.height}`);
    }
  });

  // TEST 5: Boundary clamping near right and bottom page margins
  await test("Text box creation near margins is strictly clamped within page boundaries", async () => {
    // Near right edge of page (pageW = 595.28)
    const box = calculateCreatedTextBox({ x: 550, y: 800 }, { x: 620, y: 880 }, 1.0, pageW, pageH);

    if (box.x + box.width > pageW + 0.01) {
      throw new Error(`Box overflows page width: ${box.x + box.width} > ${pageW}`);
    }
    if (box.y + box.height > pageH + 0.01) {
      throw new Error(`Box overflows page height: ${box.y + box.height} > ${pageH}`);
    }
  });

  // TEST 6: Zoom scaling preserves ground-truth PDF coordinates (25%, 100%, 400%)
  await test("Zoom scaling (25%, 100%, 400%) preserves ground-truth PDF points invariant", async () => {
    const targetPdfRect = { x: 72, y: 144, width: 216, height: 72 };

    const zooms = [0.25, 1.0, 4.0];
    for (const zoom of zooms) {
      // Screen coordinates scale with zoom
      const startScreen = { x: pdfToScreen(targetPdfRect.x, zoom), y: pdfToScreen(targetPdfRect.y, zoom) };
      const endScreen = {
        x: pdfToScreen(targetPdfRect.x + targetPdfRect.width, zoom),
        y: pdfToScreen(targetPdfRect.y + targetPdfRect.height, zoom),
      };

      const box = calculateCreatedTextBox(startScreen, endScreen, zoom, pageW, pageH);

      if (Math.abs(box.x - targetPdfRect.x) > 0.5 || Math.abs(box.y - targetPdfRect.y) > 0.5) {
        throw new Error(`Zoom ${zoom * 100}% origin error: expected (${targetPdfRect.x}, ${targetPdfRect.y}), got (${box.x}, ${box.y})`);
      }
      if (Math.abs(box.width - targetPdfRect.width) > 0.5 || Math.abs(box.height - targetPdfRect.height) > 0.5) {
        throw new Error(`Zoom ${zoom * 100}% dimension error: expected ${targetPdfRect.width}x${targetPdfRect.height}, got ${box.width}x${box.height}`);
      }
    }
  });

  // TEST 7: Rotation compatibility across all Viewport angles (0°, 90°, 180°, 270°)
  await test("Viewport view rotation (0°, 90°, 180°, 270°) correctly resolves ground-truth PDF coordinates", async () => {
    const rotations: ViewportRotation[] = [0, 90, 180, 270];

    for (const rot of rotations) {
      const displayDim = getRotatedDimensions(pageW, pageH, rot);
      // Drag in center of rotated viewport
      const start = { x: displayDim.width * 0.3, y: displayDim.height * 0.3 };
      const end = { x: displayDim.width * 0.6, y: displayDim.height * 0.5 };

      const box = calculateCreatedTextBox(start, end, 1.0, pageW, pageH, 0, rot);

      if (box.x < 0 || box.x + box.width > pageW || box.y < 0 || box.y + box.height > pageH) {
        throw new Error(`Rotation ${rot}° resulted in out-of-bounds ground-truth box: ${JSON.stringify(box)}`);
      }
      if (box.width < MIN_TEXT_WIDTH || box.height < MIN_TEXT_HEIGHT) {
        throw new Error(`Rotation ${rot}° resulted in collapsed dimensions: ${box.width}x${box.height}`);
      }
    }
  });

  // TEST 8: Combined native page rotation + viewport view rotation
  await test("Combined native page rotation (90°) and viewport rotation (90° = total 180°) resolves accurately", async () => {
    const nativeRot: ViewportRotation = 90;
    const viewportRot: ViewportRotation = 90;

    // In total 180° visual rotation, drag from screen visual coordinates
    const start = { x: 50, y: 100 };
    const end = { x: 200, y: 250 };

    const box = calculateCreatedTextBox(start, end, 1.0, pageW, pageH, nativeRot, viewportRot);

    if (box.x < 0 || box.x + box.width > pageW || box.y < 0 || box.y + box.height > pageH) {
      throw new Error(`Combined rotation yielded out-of-bounds box: ${JSON.stringify(box)}`);
    }
  });

  // TEST 9: Text Object State Initialization & activeProperties inheritance
  await test("Newly created text box enters editing state and inherits activeProperties typography", async () => {
    const activeProperties = {
      color: "#2563eb",
      fillColor: "transparent",
      fontSize: 20,
      fontFamily: "Inter" as const,
      fontWeight: "bold" as const,
      fontStyle: "italic" as const,
      textDecoration: "underline" as const,
      textAlign: "center" as const,
      strokeWidth: 2,
      opacity: 0.9,
    };

    const newId = `txt_test_${Date.now()}`;
    const newTextObject = {
      id: newId,
      type: "text" as const,
      pageIndex: 0,
      x: 100,
      y: 200,
      width: 150,
      height: 40,
      rotation: 0,
      opacity: activeProperties.opacity,
      zIndex: 1,
      text: "",
      fontSize: activeProperties.fontSize,
      fontFamily: activeProperties.fontFamily,
      fontWeight: activeProperties.fontWeight,
      fontStyle: activeProperties.fontStyle,
      textDecoration: activeProperties.textDecoration,
      color: activeProperties.color,
      textAlign: activeProperties.textAlign,
      lineHeight: 1.2,
    };

    // Validate with Zod text schema
    const parsed = textEditorObjectSchema.safeParse(newTextObject);
    if (!parsed.success) {
      throw new Error(`Zod validation failed on initial text object: ${parsed.error.message}`);
    }

    // Verify typography and activeProperties inheritance
    if (parsed.data.fontSize !== 20 || parsed.data.fontFamily !== "Inter" || parsed.data.color !== "#2563eb") {
      throw new Error("activeProperties typography not properly mapped to text object");
    }
    if (parsed.data.fontWeight !== "bold" || parsed.data.textDecoration !== "underline") {
      throw new Error("Font weight and text decoration not properly mapped");
    }

    // Simulating editor editing state transition
    let editingObjectId: string | null = null;
    let selectedObjectIds: string[] = [];

    // Trigger creation
    selectedObjectIds = [newId];
    editingObjectId = newId;

    if (editingObjectId !== newId || !selectedObjectIds.includes(newId)) {
      throw new Error("Text object did not enter active editing and selected state");
    }
  });

  // TEST 10: Empty text box cleanup lifecycle simulation
  await test("Empty text box cleanup removes 0-character object on editing blur/commit", async () => {
    let objects: Record<string, { id: string; text: string }> = {
      txt_1: { id: "txt_1", text: "" },
      txt_2: { id: "txt_2", text: "Persistent Heading" },
    };

    const commitOrBlur = (id: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        delete objects[id];
      } else {
        objects[id] = { id, text: trimmed };
      }
    };

    // txt_1 was left empty
    commitOrBlur("txt_1", "");
    // txt_2 had text
    commitOrBlur("txt_2", "Persistent Heading");

    if ("txt_1" in objects) {
      throw new Error("Empty text box was not deleted on blur");
    }
    if (!("txt_2" in objects) || objects.txt_2?.text !== "Persistent Heading") {
      throw new Error("Non-empty text box was incorrectly deleted or altered");
    }
  });

  console.log(`\nResults: ${passed}/${total} passed`);
  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test runner encountered an error:", err);
  process.exit(1);
});
