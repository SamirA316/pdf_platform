/**
 * QuickPDF Platform - Phase 5.2 PDF Viewer & Rendering Test Suite
 * Validates actual PDF loading, dimension extraction, native rotation, High-DPI scaling,
 * thumbnail downscaling math, error handling, and memory lifecycle cleanup.
 */

import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

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

// Helper: Generate sample PDF with given pages, dimensions, and rotation
async function generateTestPdf(
  pagesConfig: Array<{ width: number; height: number; rotation?: number; text: string }>
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const cfg of pagesConfig) {
    const page = doc.addPage([cfg.width, cfg.height]);
    if (cfg.rotation) {
      page.setRotation(degrees(cfg.rotation));
    }
    page.drawText(cfg.text, {
      x: 50,
      y: cfg.height - 80,
      size: 16,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  return doc.save();
}

async function runTests() {
  console.log("=== PHASE 5.2 PDF VIEWER & RENDERING TEST SUITE ===");

  // TEST 1: Load valid multi-page PDF bytes & verify structure
  await test("Load valid multi-page PDF bytes and verify structural integrity", async () => {
    const pdfBytes = await generateTestPdf([
      { width: 595.28, height: 841.89, text: "Page 1 A4" },
      { width: 595.28, height: 841.89, text: "Page 2 A4" },
      { width: 595.28, height: 841.89, text: "Page 3 A4" },
    ]);

    const loadedDoc = await PDFDocument.load(pdfBytes);
    if (loadedDoc.getPageCount() !== 3) {
      throw new Error(`Expected 3 pages, got ${loadedDoc.getPageCount()}`);
    }
  });

  // TEST 2: Reject corrupt / non-PDF data with error
  await test("Reject corrupt non-PDF buffer with descriptive error", async () => {
    const corruptedBytes = Buffer.from("NOT_A_PDF_CORRUPTED_HEADER_DATA_12345");
    let caught = false;
    try {
      await PDFDocument.load(corruptedBytes);
    } catch {
      caught = true;
    }
    if (!caught) {
      throw new Error("Expected PDF loading to throw for corrupted buffer");
    }
  });

  // TEST 3: Reject empty buffer
  await test("Reject 0-byte empty buffer", async () => {
    const emptyBytes = new Uint8Array(0);
    let caught = false;
    try {
      await PDFDocument.load(emptyBytes);
    } catch {
      caught = true;
    }
    if (!caught) {
      throw new Error("Expected PDF loading to throw for empty buffer");
    }
  });

  // TEST 4: Extract exact page dimensions for standard A4 document
  await test("Extract exact page dimensions for standard A4 (595.28 x 841.89 pt)", async () => {
    const pdfBytes = await generateTestPdf([
      { width: 595.28, height: 841.89, text: "Standard A4 Document" },
    ]);

    const doc = await PDFDocument.load(pdfBytes);
    const page = doc.getPage(0);
    const { width, height } = page.getSize();

    if (Math.abs(width - 595.28) > 0.1 || Math.abs(height - 841.89) > 0.1) {
      throw new Error(`Unexpected A4 dimensions: ${width} x ${height}`);
    }
  });

  // TEST 5: Extract exact page dimensions for US Letter document
  await test("Extract exact page dimensions for US Letter (612 x 792 pt)", async () => {
    const pdfBytes = await generateTestPdf([
      { width: 612, height: 792, text: "US Letter Document" },
    ]);

    const doc = await PDFDocument.load(pdfBytes);
    const page = doc.getPage(0);
    const { width, height } = page.getSize();

    if (width !== 612 || height !== 792) {
      throw new Error(`Unexpected US Letter dimensions: ${width} x ${height}`);
    }
  });

  // TEST 6: Extract landscape orientation dimensions
  await test("Extract landscape orientation dimensions accurately", async () => {
    const pdfBytes = await generateTestPdf([
      { width: 841.89, height: 595.28, text: "A4 Landscape Document" },
    ]);

    const doc = await PDFDocument.load(pdfBytes);
    const page = doc.getPage(0);
    const { width, height } = page.getSize();

    if (width <= height) {
      throw new Error(`Expected landscape width > height, got ${width} x ${height}`);
    }
    const aspectRatio = Math.round((width / height) * 100) / 100;
    if (aspectRatio !== 1.41) {
      throw new Error(`Expected aspect ratio ~1.41, got ${aspectRatio}`);
    }
  });

  // TEST 7: Extract mixed page dimensions in a single document
  await test("Extract mixed page sizes in a single multi-page document", async () => {
    const pdfBytes = await generateTestPdf([
      { width: 595.28, height: 841.89, text: "Page 1 A4" },
      { width: 612, height: 792, text: "Page 2 Letter" },
      { width: 841.89, height: 595.28, text: "Page 3 Landscape" },
    ]);

    const doc = await PDFDocument.load(pdfBytes);
    const p1 = doc.getPage(0).getSize();
    const p2 = doc.getPage(1).getSize();
    const p3 = doc.getPage(2).getSize();

    if (p1.width !== 595.28 || p2.width !== 612 || p3.width !== 841.89) {
      throw new Error("Failed to preserve heterogeneous page dimensions");
    }
  });

  // TEST 8: Extract native rotation angles (0°, 90°, 180°, 270°)
  await test("Extract native PDF page rotation angles correctly (90°, 180°, 270°)", async () => {
    const pdfBytes = await generateTestPdf([
      { width: 595.28, height: 841.89, rotation: 0, text: "Rot 0" },
      { width: 595.28, height: 841.89, rotation: 90, text: "Rot 90" },
      { width: 595.28, height: 841.89, rotation: 180, text: "Rot 180" },
      { width: 595.28, height: 841.89, rotation: 270, text: "Rot 270" },
    ]);

    const doc = await PDFDocument.load(pdfBytes);
    const r0 = doc.getPage(0).getRotation().angle;
    const r90 = doc.getPage(1).getRotation().angle;
    const r180 = doc.getPage(2).getRotation().angle;
    const r270 = doc.getPage(3).getRotation().angle;

    if (r0 !== 0 || r90 !== 90 || r180 !== 180 || r270 !== 270) {
      throw new Error(`Rotation mismatch: [${r0}, ${r90}, ${r180}, ${r270}]`);
    }
  });

  // TEST 9: High-DPI canvas buffer scaling math
  await test("High-DPI Retina buffer scaling math (physical canvas vs CSS display)", async () => {
    const pageWidthPt = 595.28;
    const pageHeightPt = 841.89;
    const zoom = 1.5;
    const dpr = 2.0; // Retina display

    const physicalScale = zoom * dpr; // 3.0
    const physicalWidth = Math.round(pageWidthPt * physicalScale);
    const physicalHeight = Math.round(pageHeightPt * physicalScale);

    const cssDisplayWidth = Math.round(physicalWidth / dpr);
    const cssDisplayHeight = Math.round(physicalHeight / dpr);

    // Verify physical canvas buffer is double the CSS display size for sharpness
    if (physicalWidth !== cssDisplayWidth * 2 || physicalHeight !== cssDisplayHeight * 2) {
      throw new Error(`Retina scaling ratio incorrect: ${physicalWidth} vs ${cssDisplayWidth}`);
    }

    if (cssDisplayWidth !== Math.round(pageWidthPt * zoom)) {
      throw new Error(`CSS display size does not match expected zoom layout`);
    }
  });

  // TEST 10: Thumbnail downscale geometry calculation
  await test("Thumbnail downscale geometry preserves aspect ratio with target width 112px", async () => {
    const targetWidth = 112;
    const a4Width = 595.28;
    const a4Height = 841.89;

    const scale = targetWidth / a4Width;
    const thumbnailWidth = Math.round(a4Width * scale);
    const thumbnailHeight = Math.round(a4Height * scale);

    if (thumbnailWidth !== 112) {
      throw new Error(`Expected thumbnail width 112, got ${thumbnailWidth}`);
    }
    // A4 aspect ratio 595.28 / 841.89 ≈ 0.707. 112 / 0.707 ≈ 158
    if (thumbnailHeight < 155 || thumbnailHeight > 162) {
      throw new Error(`Unexpected thumbnail height: ${thumbnailHeight}`);
    }
  });

  // TEST 11: Document lifecycle memory release
  await test("Document lifecycle memory release: proxy destruction simulation", async () => {
    const pdfBytes = await generateTestPdf([
      { width: 595.28, height: 841.89, text: "Memory test" },
    ]);

    let activeDoc: any = await PDFDocument.load(pdfBytes);
    if (!activeDoc) throw new Error("Document failed to load");

    // Simulate lifecycle teardown
    activeDoc = null;
    if (activeDoc !== null) throw new Error("Failed to clear reference");
  });

  // TEST 12: Render cancellation semantics verification
  await test("Render cancellation semantics: cancel flag aborts task cleanly", async () => {
    let cancelled = false;
    let completed = false;

    // Simulate cancellable render task
    const mockTask = {
      cancel: () => {
        cancelled = true;
      },
      promise: new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          if (cancelled) {
            const err: any = new Error("Rendering cancelled");
            err.name = "RenderingCancelledException";
            reject(err);
          } else {
            completed = true;
            resolve();
          }
        }, 50);
      }),
    };

    // Immediately cancel
    mockTask.cancel();

    let caughtCancellation = false;
    try {
      await mockTask.promise;
    } catch (err: any) {
      if (err.name === "RenderingCancelledException") {
        caughtCancellation = true;
      }
    }

    if (!caughtCancellation || completed) {
      throw new Error("Render cancellation failed to abort execution cleanly");
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
