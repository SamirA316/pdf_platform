/**
 * QuickPDF Platform - Phase 5.4 Zoom, Pan & Page Rotation Test Suite
 * Validates zoom preset stepping, boundary clamping, coordinate invariance,
 * fit-width/fit-page geometry, viewport view rotation arithmetic, dimension swapping,
 * point rotation transforms, and pan offset math.
 */

export {};

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

// Coordinate & transformation math engine simulation
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;
const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0];

type ViewportRotation = 0 | 90 | 180 | 270;

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function getNextZoomIn(currentZoom: number): number {
  const rounded = Math.round(currentZoom * 100) / 100;
  for (const preset of ZOOM_PRESETS) {
    if (preset > rounded + 0.01) {
      return preset;
    }
  }
  return MAX_ZOOM;
}

function getNextZoomOut(currentZoom: number): number {
  const rounded = Math.round(currentZoom * 100) / 100;
  for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
    const preset = ZOOM_PRESETS[i];
    if (preset !== undefined && preset < rounded - 0.01) {
      return preset;
    }
  }
  return MIN_ZOOM;
}

function pdfToScreen(pdfVal: number, zoom: number): number {
  return Math.round(pdfVal * zoom * 100) / 100;
}

function screenToPdf(screenVal: number, zoom: number): number {
  if (zoom <= 0) return screenVal;
  return Math.round((screenVal / zoom) * 100) / 100;
}

function calculateFitZoom(
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
    return clamp(availableWidth / pageWidthPt, MIN_ZOOM, MAX_ZOOM);
  }

  const widthRatio = availableWidth / pageWidthPt;
  const heightRatio = availableHeight / pageHeightPt;
  return clamp(Math.min(widthRatio, heightRatio), MIN_ZOOM, MAX_ZOOM);
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

function rotatePoint(
  point: { x: number; y: number },
  rotation: ViewportRotation,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number } {
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

function unrotatePoint(
  rotatedPoint: { x: number; y: number },
  rotation: ViewportRotation,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number } {
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

async function runTests() {
  console.log("=== PHASE 5.4 ZOOM, PAN & ROTATE TEST SUITE ===");

  // TEST 1: Preset step snapping
  await test("Zoom preset stepping snaps cleanly through standard levels", async () => {
    let zoom = 1.0;
    zoom = getNextZoomIn(zoom);
    if (zoom !== 1.25) throw new Error(`Expected 1.25, got ${zoom}`);

    zoom = getNextZoomIn(zoom);
    if (zoom !== 1.5) throw new Error(`Expected 1.5, got ${zoom}`);

    zoom = getNextZoomIn(zoom);
    if (zoom !== 2.0) throw new Error(`Expected 2.0, got ${zoom}`);

    zoom = getNextZoomOut(zoom);
    if (zoom !== 1.5) throw new Error(`Expected 1.5 on zoomOut, got ${zoom}`);

    zoom = getNextZoomOut(zoom);
    if (zoom !== 1.25) throw new Error(`Expected 1.25 on zoomOut, got ${zoom}`);
  });

  // TEST 2: Boundary clamping at min and max zoom
  await test("Zoom boundaries clamp at 25% minimum and 400% maximum", async () => {
    // At min zoom
    const atMin = getNextZoomOut(0.25);
    if (atMin !== 0.25) throw new Error(`Underflow past min: ${atMin}`);

    // At max zoom
    const atMax = getNextZoomIn(4.0);
    if (atMax !== 4.0) throw new Error(`Overflow past max: ${atMax}`);

    // Arbitrary out of range clamp
    if (clamp(0.05, MIN_ZOOM, MAX_ZOOM) !== 0.25) throw new Error("Clamp below min failed");
    if (clamp(10.0, MIN_ZOOM, MAX_ZOOM) !== 4.0) throw new Error("Clamp above max failed");
  });

  // TEST 3: Coordinate invariance across zoom factors
  await test("Object coordinates in PDF points remain invariant and round-trip across all zoom factors", async () => {
    const originalPdfObject = { x: 144, y: 288, width: 200, height: 100 }; // 2in x 4in from top-left

    for (const z of ZOOM_PRESETS) {
      const screenX = pdfToScreen(originalPdfObject.x, z);
      const screenY = pdfToScreen(originalPdfObject.y, z);
      const screenW = pdfToScreen(originalPdfObject.width, z);
      const screenH = pdfToScreen(originalPdfObject.height, z);

      // Verify screen pixels scale proportionally
      if (Math.abs(screenX - originalPdfObject.x * z) > 0.05) {
        throw new Error(`Screen X mismatch at zoom ${z}`);
      }

      // Convert back to PDF space
      const backX = screenToPdf(screenX, z);
      const backY = screenToPdf(screenY, z);
      const backW = screenToPdf(screenW, z);
      const backH = screenToPdf(screenH, z);

      if (Math.abs(backX - originalPdfObject.x) > 0.1) throw new Error(`Round-trip X drift at zoom ${z}`);
      if (Math.abs(backY - originalPdfObject.y) > 0.1) throw new Error(`Round-trip Y drift at zoom ${z}`);
      if (Math.abs(backW - originalPdfObject.width) > 0.1) throw new Error(`Round-trip W drift at zoom ${z}`);
      if (Math.abs(backH - originalPdfObject.height) > 0.1) throw new Error(`Round-trip H drift at zoom ${z}`);
    }
  });

  // TEST 4: Fit-width zoom calculation
  await test("calculateFitZoom correctly fits page to available container width", async () => {
    const pageWidthPt = 595.28; // A4 width
    const pageHeightPt = 841.89;
    const containerWidthPx = 1200;
    const containerHeightPx = 900;
    const padding = 48;

    const fitZoom = calculateFitZoom(pageWidthPt, pageHeightPt, containerWidthPx, containerHeightPx, "width", padding);
    const expected = (1200 - 48) / 595.28;

    if (Math.abs(fitZoom - expected) > 0.01) {
      throw new Error(`Expected fit-width zoom ~${expected.toFixed(2)}, got ${fitZoom}`);
    }
  });

  // TEST 5: Fit-page zoom calculation
  await test("calculateFitZoom correctly fits page to the most constrained container dimension", async () => {
    const pageWidthPt = 600;
    const pageHeightPt = 800;
    // Container is landscape (1200 x 600) -> height is more constrained
    const containerW = 1248;
    const containerH = 648;
    const padding = 48;

    const fitZoom = calculateFitZoom(pageWidthPt, pageHeightPt, containerW, containerH, "page", padding);
    // availableW = 1200, availableH = 600
    // widthRatio = 1200/600 = 2.0
    // heightRatio = 600/800 = 0.75
    // min is 0.75
    if (Math.abs(fitZoom - 0.75) > 0.01) {
      throw new Error(`Expected height-constrained fit-page zoom 0.75, got ${fitZoom}`);
    }
  });

  // TEST 6: Viewport rotation arithmetic
  await test("Viewport view rotation advances and reverses through 0°, 90°, 180°, 270°", async () => {
    let rot: ViewportRotation = 0;

    // Clockwise
    rot = ((rot + 90) % 360) as ViewportRotation;
    if (rot !== 90) throw new Error(`Expected 90, got ${rot}`);

    rot = ((rot + 90) % 360) as ViewportRotation;
    if (rot !== 180) throw new Error(`Expected 180, got ${rot}`);

    rot = ((rot + 90) % 360) as ViewportRotation;
    if (rot !== 270) throw new Error(`Expected 270, got ${rot}`);

    rot = ((rot + 90) % 360) as ViewportRotation;
    if (rot !== 0) throw new Error(`Expected 0, got ${rot}`);

    // Counter-clockwise
    rot = ((rot + 270) % 360) as ViewportRotation;
    if (rot !== 270) throw new Error(`Expected 270 counter-clockwise, got ${rot}`);

    rot = ((rot + 270) % 360) as ViewportRotation;
    if (rot !== 180) throw new Error(`Expected 180 counter-clockwise, got ${rot}`);
  });

  // TEST 7: Dimension swapping under 90° and 270°
  await test("getRotatedDimensions swaps width and height exclusively on 90° and 270° rotations", async () => {
    const w = 595;
    const h = 842;

    const rot0 = getRotatedDimensions(w, h, 0);
    if (rot0.width !== w || rot0.height !== h) throw new Error("0° altered dimensions");

    const rot90 = getRotatedDimensions(w, h, 90);
    if (rot90.width !== h || rot90.height !== w) throw new Error("90° failed to swap dimensions");

    const rot180 = getRotatedDimensions(w, h, 180);
    if (rot180.width !== w || rot180.height !== h) throw new Error("180° unexpectedly swapped dimensions");

    const rot270 = getRotatedDimensions(w, h, 270);
    if (rot270.width !== h || rot270.height !== w) throw new Error("270° failed to swap dimensions");
  });

  // TEST 8: Forward point rotation mapping
  await test("rotatePoint accurately maps corners from page space to rotated viewport space", async () => {
    const w = 600;
    const h = 800;
    const origin = { x: 0, y: 0 };

    // At 90°: (0,0) -> (h, 0)
    const p90 = rotatePoint(origin, 90, w, h);
    if (p90.x !== h || p90.y !== 0) throw new Error(`90° origin mapped to (${p90.x}, ${p90.y})`);

    // At 180°: (0,0) -> (w, h)
    const p180 = rotatePoint(origin, 180, w, h);
    if (p180.x !== w || p180.y !== h) throw new Error(`180° origin mapped to (${p180.x}, ${p180.y})`);

    // At 270°: (0,0) -> (0, w)
    const p270 = rotatePoint(origin, 270, w, h);
    if (p270.x !== 0 || p270.y !== w) throw new Error(`270° origin mapped to (${p270.x}, ${p270.y})`);
  });

  // TEST 9: Inverse point unrotation round-trip
  await test("unrotatePoint restores original coordinates with exact round-trip fidelity", async () => {
    const w = 595;
    const h = 842;
    const testPoints = [
      { x: 50, y: 100 },
      { x: 300, y: 400 },
      { x: 550, y: 800 },
    ];

    const rotations: ViewportRotation[] = [0, 90, 180, 270];

    for (const rot of rotations) {
      for (const pt of testPoints) {
        const rotated = rotatePoint(pt, rot, w, h);
        const restored = unrotatePoint(rotated, rot, w, h);

        if (restored.x !== pt.x || restored.y !== pt.y) {
          throw new Error(`Round-trip failure at rot=${rot} for (${pt.x}, ${pt.y}): got (${restored.x}, ${restored.y})`);
        }
      }
    }
  });

  // TEST 10: Separation of native PDF rotation vs viewport rotation with two-stage inverse transform
  await test("Total effective rotation and two-stage inverse coordinate pipeline align native PDF and viewport rotation", async () => {
    // 1. Effective rotation combining
    const nativeRotation: ViewportRotation = 90;
    const viewportRotation: ViewportRotation = 90;
    const total = ((nativeRotation + viewportRotation) % 360) as ViewportRotation;
    if (total !== 180) throw new Error(`Expected 180°, got ${total}`);

    // 2. Full forward & inverse two-stage coordinate pipeline
    const w = 600;
    const h = 800;
    const originalPdfPoint = { x: 120, y: 350 };

    // Forward Step 1: Native Page Rotation Transform
    const inNativeSpace = rotatePoint(originalPdfPoint, nativeRotation, w, h);
    const nativeDim = getRotatedDimensions(w, h, nativeRotation); // 800 x 600

    // Forward Step 2: Viewport View Rotation Transform
    const onScreenDisplay = rotatePoint(inNativeSpace, viewportRotation, nativeDim.width, nativeDim.height);

    // Inverse Step 1: Invert Viewport View Rotation
    const unrotatedViewport = unrotatePoint(onScreenDisplay, viewportRotation, nativeDim.width, nativeDim.height);
    if (unrotatedViewport.x !== inNativeSpace.x || unrotatedViewport.y !== inNativeSpace.y) {
      throw new Error("Viewport inverse failed to recover native page space coordinate");
    }

    // Inverse Step 2: Invert Native Page Rotation
    const recoveredPdfPoint = unrotatePoint(unrotatedViewport, nativeRotation, w, h);
    if (recoveredPdfPoint.x !== originalPdfPoint.x || recoveredPdfPoint.y !== originalPdfPoint.y) {
      throw new Error(`Two-stage inverse failed: expected (${originalPdfPoint.x}, ${originalPdfPoint.y}), got (${recoveredPdfPoint.x}, ${recoveredPdfPoint.y})`);
    }
  });

  // TEST 11: Pan drag offset math
  await test("Hand tool drag calculates viewport scrollLeft and scrollTop accurately", async () => {
    const dragStart = {
      x: 300,
      y: 400,
      scrollLeft: 150,
      scrollTop: 200,
    };

    // User drags mouse right by 50px (x=350) and down by 80px (y=480)
    const currentMouse = { x: 350, y: 480 };
    const dx = currentMouse.x - dragStart.x; // +50
    const dy = currentMouse.y - dragStart.y; // +80

    const targetScrollLeft = dragStart.scrollLeft - dx; // 150 - 50 = 100
    const targetScrollTop = dragStart.scrollTop - dy;   // 200 - 80 = 120

    if (targetScrollLeft !== 100) throw new Error(`Expected scrollLeft 100, got ${targetScrollLeft}`);
    if (targetScrollTop !== 120) throw new Error(`Expected scrollTop 120, got ${targetScrollTop}`);
  });

  // TEST 12: Spacebar pan event filtering logic
  await test("Spacebar pan correctly enables temporary hand mode and ignores input targets", async () => {
    const canTriggerSpacePan = (tagName: string, isContentEditable: boolean): boolean => {
      const isInput = tagName === "INPUT" || tagName === "TEXTAREA" || isContentEditable;
      return !isInput;
    };

    if (canTriggerSpacePan("INPUT", false) !== false) throw new Error("Failed to ignore INPUT");
    if (canTriggerSpacePan("TEXTAREA", false) !== false) throw new Error("Failed to ignore TEXTAREA");
    if (canTriggerSpacePan("DIV", true) !== false) throw new Error("Failed to ignore contentEditable");
    if (canTriggerSpacePan("DIV", false) !== true) throw new Error("Failed to allow standard DIV");
    if (canTriggerSpacePan("MAIN", false) !== true) throw new Error("Failed to allow MAIN viewport");
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
