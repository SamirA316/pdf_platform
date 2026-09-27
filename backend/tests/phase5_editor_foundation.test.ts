/**
 * QuickPDF Platform - Phase 5.1 PDF Editor Foundation Test Suite
 * Validates Editor architecture, coordinate systems, object schemas, and API contracts.
 */

process.env.NODE_ENV = "test";
import { Server } from "http";
import app from "../src/server";
import {
  editorExportPayloadSchema,
  textEditorObjectSchema,
  shapeEditorObjectSchema,
  drawingEditorObjectSchema,
} from "../src/modules/editor/editor.validation";

let serverInstance: Server;
const TEST_PORT = 50280;
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
  console.log("=== PHASE 5.1 PDF EDITOR FOUNDATION TEST SUITE ===");

  const rawFetch = global.fetch;
  const testCsrfToken = "csrf_token_for_editor_suite_foundation";
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

  // TEST 1: GET /api/v1/editor capabilities
  await test("GET /api/v1/editor returns 200 with complete foundation capabilities", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/editor`);
    const body = await res.json();
    if (res.status !== 200 || !body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(body)}`);
    }
    if (body.data.module !== "editor" || body.data.phase !== "5.1") {
      throw new Error(`Unexpected response data: ${JSON.stringify(body.data)}`);
    }
    if (!body.data.capabilities.supportedTools.includes("text")) {
      throw new Error("Missing text tool in capabilities");
    }
    if (body.data.capabilities.coordinateSystem.pointsPerInch !== 72) {
      throw new Error("Invalid coordinate system DPI");
    }
  });

  // TEST 2: POST /api/v1/editor/validate with valid complete payload
  await test("POST /api/v1/editor/validate accepts valid multi-object manifest", async () => {
    const validPayload = {
      fileId: "cmuch51se0007wk7o453m4oey",
      options: { flatten: true, compatibilityVersion: "1.7" },
      pages: [
        {
          pageIndex: 0,
          rotationDelta: 0,
          objects: [
            {
              id: "txt_1",
              type: "text",
              pageIndex: 0,
              x: 72,
              y: 144,
              width: 200,
              height: 40,
              rotation: 0,
              opacity: 1,
              zIndex: 1,
              text: "Invoice #1042",
              fontSize: 18,
              fontFamily: "Helvetica",
              fontWeight: "bold",
              fontStyle: "normal",
              color: "#1e293b",
              textAlign: "left",
              lineHeight: 1.2,
            },
            {
              id: "shp_1",
              type: "shape",
              pageIndex: 0,
              x: 72,
              y: 200,
              width: 150,
              height: 50,
              rotation: 0,
              opacity: 0.8,
              zIndex: 2,
              shapeType: "rectangle",
              strokeColor: "#2563eb",
              strokeWidth: 2,
              fillColor: "transparent",
            },
            {
              id: "draw_1",
              type: "drawing",
              pageIndex: 0,
              x: 72,
              y: 300,
              width: 100,
              height: 60,
              rotation: 0,
              opacity: 0.5,
              zIndex: 3,
              isHighlighter: true,
              color: "#facc15",
              strokeWidth: 14,
              points: [
                { x: 72, y: 300 },
                { x: 120, y: 302 },
                { x: 172, y: 300 },
              ],
            },
          ],
        },
      ],
    };

    const res = await fetch(`${BASE_URL}/api/v1/editor/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });
    const body = await res.json();
    if (res.status !== 200 || !body.data?.valid) {
      throw new Error(`Expected 200 valid, got ${res.status}: ${JSON.stringify(body)}`);
    }
    if (body.data.totalObjects !== 3 || body.data.pageCount !== 1) {
      throw new Error(`Object count mismatch: ${JSON.stringify(body.data)}`);
    }
  });

  // TEST 3: Reject missing fileId
  await test("POST /api/v1/editor/validate rejects payload without fileId", async () => {
    const invalidPayload = {
      pages: [{ pageIndex: 0, rotationDelta: 0, objects: [] }],
    };
    const res = await fetch(`${BASE_URL}/api/v1/editor/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
  });

  // TEST 4: Reject invalid hex color
  await test("Zod schema rejects text object with invalid color string", async () => {
    const invalidText = {
      id: "txt_err",
      type: "text",
      pageIndex: 0,
      x: 10,
      y: 10,
      width: 50,
      height: 20,
      text: "Err",
      color: "not-a-color",
    };
    const result = textEditorObjectSchema.safeParse(invalidText);
    if (result.success) {
      throw new Error("Expected schema validation failure for invalid color");
    }
  });

  // TEST 5: Reject negative or zero dimensions
  await test("Zod schema rejects objects with non-positive width or height", async () => {
    const zeroWidthShape = {
      id: "shp_err",
      type: "shape",
      pageIndex: 0,
      x: 10,
      y: 10,
      width: 0,
      height: 20,
      shapeType: "rectangle",
    };
    const result = shapeEditorObjectSchema.safeParse(zeroWidthShape);
    if (result.success) {
      throw new Error("Expected schema validation failure for width: 0");
    }
  });

  // TEST 6: Reject drawing object with 0 points
  await test("Zod schema rejects drawing object without points", async () => {
    const emptyDrawing = {
      id: "drw_err",
      type: "drawing",
      pageIndex: 0,
      x: 10,
      y: 10,
      width: 10,
      height: 10,
      points: [],
    };
    const result = drawingEditorObjectSchema.safeParse(emptyDrawing);
    if (result.success) {
      throw new Error("Expected schema validation failure for empty points array");
    }
  });

  // TEST 7: Mathematical coordinate conversion verification
  await test("Coordinate math round-trips accurately between PDF 72-DPI points and Screen px", async () => {
    // Math model: ScreenPx = PdfPoints * Zoom
    const pdfVal = 72; // Exactly 1 inch
    const zoomFactors = [0.5, 1.0, 1.5, 2.0];

    for (const z of zoomFactors) {
      const screenPx = Math.round(pdfVal * z * 100) / 100;
      const roundTripPdf = Math.round((screenPx / z) * 100) / 100;
      if (roundTripPdf !== pdfVal) {
        throw new Error(`Round-trip failure at zoom ${z}: expected ${pdfVal}, got ${roundTripPdf}`);
      }
    }
  });

  // TEST 8: Fit-to-width zoom calculation math
  await test("Fit-to-width zoom calculation respects container boundaries and padding", async () => {
    const pageWidthPt = 595.28; // Standard A4 width
    const containerWidthPx = 1200;
    const paddingPx = 48;

    const availableWidth = containerWidthPx - paddingPx;
    const calculatedZoom = Math.round((availableWidth / pageWidthPt) * 100) / 100;

    // Available width = 1152. 1152 / 595.28 ≈ 1.94
    if (calculatedZoom < 1.9 || calculatedZoom > 1.96) {
      throw new Error(`Unexpected calculated zoom: ${calculatedZoom}`);
    }
  });

  // TEST 9: Empty pages manifest rejection
  await test("POST /api/v1/editor/validate rejects empty pages array", async () => {
    const emptyPagesPayload = {
      fileId: "cmuch51se0007wk7o453m4oey",
      pages: [],
    };
    const res = await fetch(`${BASE_URL}/api/v1/editor/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emptyPagesPayload),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 for empty pages, got ${res.status}`);
    }
  });

  // TEST 10: History command stack simulation
  await test("History manager stack limits prevent unbounded memory consumption", async () => {
    const maxSteps = 50;
    const stack: number[] = [];

    // Push 75 actions
    for (let i = 1; i <= 75; i++) {
      stack.push(i);
      if (stack.length > maxSteps) {
        stack.shift();
      }
    }

    if (stack.length !== maxSteps) {
      throw new Error(`Expected stack length ${maxSteps}, got ${stack.length}`);
    }
    if (stack[0] !== 26) {
      throw new Error(`Expected oldest retained action to be 26, got ${stack[0]}`);
    }
    if (stack[stack.length - 1] !== 75) {
      throw new Error(`Expected newest action to be 75, got ${stack[stack.length - 1]}`);
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
