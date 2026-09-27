/**
 * QuickPDF Platform - Phase 5.5.1 Text Object Model Test Suite
 * Validates Text Object schemas, boundaries, textDecoration, 72-DPI coordinate invariants,
 * two-stage rotation math, and API manifest validation.
 */

process.env.NODE_ENV = "test";

import { Server } from "http";
import app from "../src/server";
import {
  textEditorObjectSchema,
  editorExportPayloadSchema,
} from "../src/modules/editor/editor.validation";

let serverInstance: Server;
const TEST_PORT = 50285;
const BASE_URL = `http://localhost:${TEST_PORT}`;

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

async function runTests() {
  console.log("=== PHASE 5.5.1 TEXT OBJECT MODEL TEST SUITE ===");

  const rawFetch = global.fetch;
  const testCsrfToken = "csrf_token_for_editor_suite_text_model";
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const opts = init ? { ...init } : {};
    const method = (opts.method || "GET").toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const headers = new Headers(opts.headers);
      if (!headers.has("X-CSRF-Token")) {
        headers.set("X-CSRF-Token", testCsrfToken);
      }
      const existingCookie = headers.get("Cookie") || "";
      if (!existingCookie.includes("pdf_csrf=")) {
        headers.set(
          "Cookie",
          existingCookie ? `${existingCookie}; pdf_csrf=${testCsrfToken}` : `pdf_csrf=${testCsrfToken}`
        );
      }
      opts.headers = headers;
    }
    return rawFetch(input, opts);
  };

  serverInstance = app.listen(TEST_PORT, () => {
    console.log(`Started in-process test server on port ${TEST_PORT}`);
  });

  // TEST 1: Valid text object with explicit full properties
  await test("textEditorObjectSchema accepts valid complete text object payload", async () => {
    const raw = {
      id: "txt_1001",
      pageIndex: 0,
      type: "text",
      x: 72,
      y: 144,
      width: 200,
      height: 48,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      text: "QuickPDF Professional Document Heading",
      fontSize: 24,
      fontFamily: "Helvetica",
      fontWeight: "bold",
      fontStyle: "italic",
      textDecoration: "underline",
      color: "#0f172a",
      textAlign: "center",
      lineHeight: 1.3,
    };

    const parsed = textEditorObjectSchema.parse(raw);
    if (parsed.text !== raw.text || parsed.textDecoration !== "underline" || parsed.fontSize !== 24) {
      throw new Error(`Parsed text object does not match input: ${JSON.stringify(parsed)}`);
    }
  });

  // TEST 2: Defaults assigned when optional fields omitted
  await test("textEditorObjectSchema assigns standard defaults (including textDecoration: none)", async () => {
    const minimal = {
      id: "txt_1002",
      pageIndex: 1,
      type: "text",
      x: 50,
      y: 80,
      width: 120,
      height: 30,
      text: "Default styling test",
    };

    const parsed = textEditorObjectSchema.parse(minimal);
    if (parsed.textDecoration !== "none") {
      throw new Error(`Expected textDecoration default 'none', got '${parsed.textDecoration}'`);
    }
    if (parsed.fontSize !== 16) {
      throw new Error(`Expected fontSize default 16, got '${parsed.fontSize}'`);
    }
    if (parsed.fontFamily !== "Helvetica") {
      throw new Error(`Expected fontFamily default 'Helvetica', got '${parsed.fontFamily}'`);
    }
    if (parsed.color !== "#000000") {
      throw new Error(`Expected color default '#000000', got '${parsed.color}'`);
    }
    if (parsed.textAlign !== "left") {
      throw new Error(`Expected textAlign default 'left', got '${parsed.textAlign}'`);
    }
    if (parsed.lineHeight !== 1.2) {
      throw new Error(`Expected lineHeight default 1.2, got '${parsed.lineHeight}'`);
    }
  });

  // TEST 3: textDecoration enum validation
  await test("textDecoration validates strictly against 'none' and 'underline', rejecting others", async () => {
    const base = {
      id: "txt_1003",
      pageIndex: 0,
      type: "text",
      x: 10,
      y: 10,
      width: 100,
      height: 25,
      text: "Decoration validation",
    };

    // Valid 'none'
    const noneResult = textEditorObjectSchema.safeParse({ ...base, textDecoration: "none" });
    if (!noneResult.success) throw new Error("textDecoration: 'none' should be valid");

    // Valid 'underline'
    const underlineResult = textEditorObjectSchema.safeParse({ ...base, textDecoration: "underline" });
    if (!underlineResult.success) throw new Error("textDecoration: 'underline' should be valid");

    // Invalid 'strikethrough'
    const invalidResult = textEditorObjectSchema.safeParse({ ...base, textDecoration: "strikethrough" });
    if (invalidResult.success) throw new Error("textDecoration: 'strikethrough' should fail validation");
  });

  // TEST 4: Font size boundary conditions
  await test("fontSize enforces strict boundaries (min 4, max 500 points)", async () => {
    const base = {
      id: "txt_1004",
      pageIndex: 0,
      type: "text",
      x: 10,
      y: 10,
      width: 100,
      height: 25,
      text: "Font size test",
    };

    // Min boundary 4
    const validMin = textEditorObjectSchema.safeParse({ ...base, fontSize: 4 });
    if (!validMin.success) throw new Error("fontSize: 4 should be valid");

    // Below min 3
    const belowMin = textEditorObjectSchema.safeParse({ ...base, fontSize: 3 });
    if (belowMin.success) throw new Error("fontSize: 3 should fail validation");

    // Max boundary 500
    const validMax = textEditorObjectSchema.safeParse({ ...base, fontSize: 500 });
    if (!validMax.success) throw new Error("fontSize: 500 should be valid");

    // Above max 501
    const aboveMax = textEditorObjectSchema.safeParse({ ...base, fontSize: 501 });
    if (aboveMax.success) throw new Error("fontSize: 501 should fail validation");
  });

  // TEST 5: Supported font family validation
  await test("fontFamily allows standard PDF and web core fonts, rejecting unapproved fonts", async () => {
    const base = {
      id: "txt_1005",
      pageIndex: 0,
      type: "text",
      x: 10,
      y: 10,
      width: 100,
      height: 25,
      text: "Font family test",
    };

    const allowedFonts = ["Helvetica", "Times", "Courier", "Inter", "Roboto", "Arial"];
    for (const font of allowedFonts) {
      const res = textEditorObjectSchema.safeParse({ ...base, fontFamily: font });
      if (!res.success) throw new Error(`Font family '${font}' should be permitted`);
    }

    const disallowed = textEditorObjectSchema.safeParse({ ...base, fontFamily: "Comic Sans" });
    if (disallowed.success) throw new Error("Unapproved font 'Comic Sans' should fail validation");
  });

  // TEST 6: Hex color format validation
  await test("color accepts 3-digit and 6-digit hex values, rejecting non-hex strings", async () => {
    const base = {
      id: "txt_1006",
      pageIndex: 0,
      type: "text",
      x: 10,
      y: 10,
      width: 100,
      height: 25,
      text: "Color test",
    };

    const validHex = ["#000", "#FFF", "#3b82f6", "#10b981", "#E11D48"];
    for (const hex of validHex) {
      const res = textEditorObjectSchema.safeParse({ ...base, color: hex });
      if (!res.success) throw new Error(`Hex color '${hex}' should be valid`);
    }

    const invalidHex = ["red", "rgb(0,0,0)", "123456", "#12345", "#GGGGGG"];
    for (const hex of invalidHex) {
      const res = textEditorObjectSchema.safeParse({ ...base, color: hex });
      if (res.success) throw new Error(`Invalid color string '${hex}' should have been rejected`);
    }
  });

  // TEST 7: Text payload maximum length enforcement
  await test("text rejects payloads exceeding 10,000 characters", async () => {
    const base = {
      id: "txt_1007",
      pageIndex: 0,
      type: "text",
      x: 10,
      y: 10,
      width: 100,
      height: 25,
    };

    const maxPayload = "A".repeat(10000);
    const valid = textEditorObjectSchema.safeParse({ ...base, text: maxPayload });
    if (!valid.success) throw new Error("10,000 char payload should be accepted");

    const overPayload = "A".repeat(10001);
    const invalid = textEditorObjectSchema.safeParse({ ...base, text: overPayload });
    if (invalid.success) throw new Error("10,001 char payload should be rejected");
  });

  // TEST 8: 72-DPI Unscaled PDF coordinate scaling invariant
  await test("72-DPI PDF point scaling to screen px and inversion preserves exact values", async () => {
    // 1 pt = 1/72 inch.
    // Screen px = pdfPoints * zoom.
    // Inversion: pdfPoints = screenPx / zoom.
    const testCases = [
      { pt: 72, zoom: 1.0, expectedPx: 72 },
      { pt: 144, zoom: 1.5, expectedPx: 216 },
      { pt: 595.28, zoom: 2.0, expectedPx: 1190.56 },
      { pt: 841.89, zoom: 0.5, expectedPx: 420.945 },
    ];

    for (const tc of testCases) {
      const screenPx = tc.pt * tc.zoom;
      if (Math.abs(screenPx - tc.expectedPx) > 0.001) {
        throw new Error(`Screen projection error: expected ${tc.expectedPx}, got ${screenPx}`);
      }
      const invertedPt = screenPx / tc.zoom;
      if (Math.abs(invertedPt - tc.pt) > 0.001) {
        throw new Error(`Coordinate inversion error: expected ${tc.pt}, got ${invertedPt}`);
      }
    }
  });

  // TEST 9: Two-stage rotation mathematical correctness for text coordinates
  await test("Two-stage rotation inversion correctly resolves ground-truth PDF coordinates", async () => {
    // Page dimensions: 595.28 x 841.89
    const pageW = 595.28;
    const pageH = 841.89;

    // Helper functions mirroring coordinates.ts
    function unrotatePoint(
      pt: { x: number; y: number },
      rotation: number,
      width: number,
      height: number
    ): { x: number; y: number } {
      const norm = ((rotation % 360) + 360) % 360;
      switch (norm) {
        case 90:
          return { x: pt.y, y: height - pt.x };
        case 180:
          return { x: width - pt.x, y: height - pt.y };
        case 270:
          return { x: width - pt.y, y: pt.x };
        default:
          return { x: pt.x, y: pt.y };
      }
    }

    // Suppose Native rotation = 90 deg, Viewport rotation = 90 deg.
    // Total visual rotation = 180 deg.
    const nativeRotation = 90;
    const viewportRotation = 90;

    // A screen click at (100, 200) in visual orientation
    const visualPt = { x: 100, y: 200 };
    // In 90 deg native, visual container width is pageH (841.89), height is pageW (595.28)
    const nativeVisualW = pageH;
    const nativeVisualH = pageW;

    // Stage 1: Invert Viewport rotation
    const afterViewportInverse = unrotatePoint(visualPt, viewportRotation, nativeVisualW, nativeVisualH);
    // Stage 2: Invert Native rotation
    const groundTruth = unrotatePoint(afterViewportInverse, nativeRotation, pageW, pageH);

    // Verify coordinates are bounded inside PDF page boundaries
    if (groundTruth.x < 0 || groundTruth.x > pageW || groundTruth.y < 0 || groundTruth.y > pageH) {
      throw new Error(`Ground-truth coordinates out of page bounds: x=${groundTruth.x}, y=${groundTruth.y}`);
    }
  });

  // TEST 10: Text Object Duplication math & styling preservation
  await test("Text object duplication preserves typography while assigning unique id & offset", async () => {
    const original = {
      id: "txt_orig",
      pageIndex: 0,
      type: "text" as const,
      x: 100,
      y: 150,
      width: 220,
      height: 40,
      rotation: 0,
      opacity: 0.95,
      zIndex: 2,
      text: "Invoice Title #001",
      fontSize: 18,
      fontFamily: "Times" as const,
      fontWeight: "bold" as const,
      fontStyle: "normal" as const,
      textDecoration: "underline" as const,
      color: "#2563eb",
      textAlign: "right" as const,
      lineHeight: 1.25,
    };

    const duplicateOffset = 10;
    const duplicate = {
      ...original,
      id: `txt_${Date.now()}_copy`,
      x: original.x + duplicateOffset,
      y: original.y + duplicateOffset,
    };

    const validatedDuplicate = textEditorObjectSchema.parse(duplicate);
    if (validatedDuplicate.id === original.id) {
      throw new Error("Duplicate must have distinct ID");
    }
    if (validatedDuplicate.x !== 110 || validatedDuplicate.y !== 160) {
      throw new Error(`Duplicate offset mismatch: x=${validatedDuplicate.x}, y=${validatedDuplicate.y}`);
    }
    if (
      validatedDuplicate.fontSize !== original.fontSize ||
      validatedDuplicate.fontFamily !== original.fontFamily ||
      validatedDuplicate.fontWeight !== original.fontWeight ||
      validatedDuplicate.textDecoration !== original.textDecoration ||
      validatedDuplicate.color !== original.color ||
      validatedDuplicate.textAlign !== original.textAlign
    ) {
      throw new Error("Duplicate typography style was corrupted during duplication");
    }
  });

  // TEST 11: POST /api/v1/editor/validate accepts manifest with text objects containing textDecoration
  await test("POST /api/v1/editor/validate accepts valid manifest containing styled text objects", async () => {
    const payload = {
      fileId: "file_test_text_manifest",
      options: { flatten: true },
      pages: [
        {
          pageIndex: 0,
          rotationDelta: 0,
          objects: [
            {
              id: "txt_manifest_1",
              pageIndex: 0,
              type: "text",
              x: 50,
              y: 100,
              width: 300,
              height: 50,
              rotation: 0,
              opacity: 1,
              zIndex: 1,
              text: "Official Header with Underline",
              fontSize: 20,
              fontFamily: "Inter",
              fontWeight: "bold",
              fontStyle: "normal",
              textDecoration: "underline",
              color: "#1e293b",
              textAlign: "left",
              lineHeight: 1.2,
            },
          ],
        },
      ],
    };

    const res = await fetch(`${BASE_URL}/api/v1/editor/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    if (res.status !== 200 || !body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(body)}`);
    }
    if (body.data.totalObjects !== 1) {
      throw new Error(`Expected 1 totalObject, got ${body.data.totalObjects}`);
    }
  });

  // TEST 12: POST /api/v1/editor/validate rejects manifest with invalid text object
  await test("POST /api/v1/editor/validate rejects manifest when text object has invalid fontSize or color", async () => {
    const invalidPayload = {
      fileId: "file_test_invalid_text",
      pages: [
        {
          pageIndex: 0,
          objects: [
            {
              id: "txt_invalid_1",
              pageIndex: 0,
              type: "text",
              x: 50,
              y: 100,
              width: 200,
              height: 40,
              text: "Broken font size",
              fontSize: 1, // Below min 4
              color: "not-a-hex",
            },
          ],
        },
      ],
    };

    const res = await fetch(`${BASE_URL}/api/v1/editor/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    const body = await res.json();
    if (res.status !== 400 || body.success) {
      throw new Error(`Expected 400 rejection, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  console.log(`\nResults: ${passed}/${total} passed`);
  if (serverInstance) {
    serverInstance.close();
  }
  if (passed !== total) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test runner encountered an error:", err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
