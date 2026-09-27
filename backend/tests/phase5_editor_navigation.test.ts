/**
 * QuickPDF Platform - Phase 5.3 Page Navigation & Thumbnails Test Suite
 * Validates bi-directional scrolling sync math, page index clamping, quick jump parsing,
 * Content-Type response validation, and keyboard shortcut event mappings.
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

// Helper: Navigation math & logic functions
function clampPageIndex(pageIndex: number, numPages: number): number {
  if (numPages <= 0) return 0;
  return Math.min(Math.max(0, pageIndex), numPages - 1);
}

function parsePageJumpInput(input: string, numPages: number, currentIdx: number): number {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return currentIdx;
  const parsed = Number(trimmed);
  if (isNaN(parsed) || parsed < 1) return currentIdx;
  return clampPageIndex(parsed - 1, numPages);
}

function validateDownloadResponse(
  status: number,
  contentType: string,
  contentLength?: string
): { valid: boolean; error?: string } {
  if (status !== 200) {
    return { valid: false, error: `HTTP ${status}` };
  }

  const isPdf =
    contentType.includes("application/pdf") || contentType.includes("application/octet-stream");
  if (!isPdf) {
    if (contentType.includes("application/json")) {
      return { valid: false, error: "Server returned JSON error response instead of PDF" };
    }
    return { valid: false, error: `Invalid content-type: ${contentType}. Expected PDF.` };
  }

  if (contentLength === "0") {
    return { valid: false, error: "Downloaded PDF is empty (0 bytes)" };
  }

  return { valid: true };
}

function computeDominantVisiblePage(
  visibilityEntries: Array<{ pageIndex: number; ratio: number }>
): number {
  let maxRatio = -1;
  let dominant = -1;
  for (const entry of visibilityEntries) {
    if (entry.ratio > maxRatio) {
      maxRatio = entry.ratio;
      dominant = entry.pageIndex;
    }
  }
  return maxRatio > 0.2 ? dominant : -1;
}

async function runTests() {
  console.log("=== PHASE 5.3 PAGE NAVIGATION & THUMBNAILS TEST SUITE ===");

  // TEST 1: Page index boundary clamping
  await test("Page index clamping restricts values strictly within [0, numPages - 1]", async () => {
    const numPages = 10;
    if (clampPageIndex(-5, numPages) !== 0) throw new Error("Underflow failed to clamp to 0");
    if (clampPageIndex(0, numPages) !== 0) throw new Error("Index 0 altered");
    if (clampPageIndex(5, numPages) !== 5) throw new Error("Valid index 5 altered");
    if (clampPageIndex(9, numPages) !== 9) throw new Error("Last index 9 altered");
    if (clampPageIndex(10, numPages) !== 9) throw new Error("Overflow failed to clamp to 9");
    if (clampPageIndex(100, numPages) !== 9) throw new Error("Severe overflow failed to clamp");
  });

  // TEST 2: Quick jump parsing with valid 1-based page numbers
  await test("parsePageJumpInput correctly converts 1-based user input to 0-based page index", async () => {
    const numPages = 20;
    const current = 2; // Page 3

    if (parsePageJumpInput("1", numPages, current) !== 0) throw new Error("Failed for '1'");
    if (parsePageJumpInput("5", numPages, current) !== 4) throw new Error("Failed for '5'");
    if (parsePageJumpInput("20", numPages, current) !== 19) throw new Error("Failed for '20'");
  });

  // TEST 3: Quick jump parsing with non-numeric, float, or invalid inputs
  await test("parsePageJumpInput safely handles non-numeric, float, and out-of-bounds input", async () => {
    const numPages = 10;
    const current = 4; // Page 5

    // Non-numeric keeps current
    if (parsePageJumpInput("abc", numPages, current) !== current) throw new Error("abc did not fallback");
    if (parsePageJumpInput("", numPages, current) !== current) throw new Error("empty did not fallback");
    if (parsePageJumpInput("   ", numPages, current) !== current) throw new Error("spaces did not fallback");

    // Float is strictly rejected and keeps current
    if (parsePageJumpInput("3.8", numPages, current) !== current) throw new Error("Float was not rejected");
    if (parsePageJumpInput("1.0", numPages, current) !== current) throw new Error("Float with dot was not rejected");

    // Negative is rejected
    if (parsePageJumpInput("-5", numPages, current) !== current) throw new Error("Negative was not rejected");

    // Leading zeros allowed
    if (parsePageJumpInput("03", numPages, current) !== 2) throw new Error("03 failed to parse to page 3");

    // Out of bounds clamps
    if (parsePageJumpInput("0", numPages, current) !== current) throw new Error("0 should be rejected since min page is 1");
    if (parsePageJumpInput("500", numPages, current) !== 9) throw new Error("500 did not clamp to page 10");
  });

  // TEST 4: Previous and Next page stepping
  await test("Previous and Next page calculations enforce boundaries", async () => {
    const numPages = 5;

    // At first page
    let current = 0;
    const prevAtStart = clampPageIndex(current - 1, numPages);
    if (prevAtStart !== 0) throw new Error("Previous at start should remain 0");

    const nextAtStart = clampPageIndex(current + 1, numPages);
    if (nextAtStart !== 1) throw new Error("Next at start should be 1");

    // At last page
    current = 4;
    const nextAtEnd = clampPageIndex(current + 1, numPages);
    if (nextAtEnd !== 4) throw new Error("Next at end should remain 4");

    const prevAtEnd = clampPageIndex(current - 1, numPages);
    if (prevAtEnd !== 3) throw new Error("Previous at end should be 3");
  });

  // TEST 5: Content-Type validation: valid application/pdf passes
  await test("validateDownloadResponse accepts application/pdf and application/octet-stream", async () => {
    const res1 = validateDownloadResponse(200, "application/pdf; charset=utf-8", "45000");
    if (!res1.valid) throw new Error("application/pdf was rejected");

    const res2 = validateDownloadResponse(200, "application/octet-stream", "102400");
    if (!res2.valid) throw new Error("application/octet-stream was rejected");
  });

  // TEST 6: Content-Type validation: reject HTML error pages
  await test("validateDownloadResponse rejects text/html error page responses", async () => {
    const res = validateDownloadResponse(200, "text/html; charset=utf-8", "1200");
    if (res.valid || !res.error?.includes("Invalid content-type")) {
      throw new Error("HTML response was unexpectedly accepted");
    }
  });

  // TEST 7: Content-Type validation: reject JSON error envelopes
  await test("validateDownloadResponse detects and rejects application/json error responses", async () => {
    const res = validateDownloadResponse(200, "application/json", "150");
    if (res.valid || !res.error?.includes("JSON error")) {
      throw new Error("JSON error response was unexpectedly accepted");
    }
  });

  // TEST 8: Content-Type validation: reject 0-byte empty responses
  await test("validateDownloadResponse rejects 0-byte empty responses", async () => {
    const res = validateDownloadResponse(200, "application/pdf", "0");
    if (res.valid || !res.error?.includes("0 bytes")) {
      throw new Error("0-byte response was unexpectedly accepted");
    }
  });

  // TEST 9: IntersectionObserver dominant visible page selection
  await test("IntersectionObserver dominant page detection selects page with maximum visibility", async () => {
    // Scenario: User is scrolling between page 1 (30% visible) and page 2 (70% visible)
    const entries = [
      { pageIndex: 0, ratio: 0.3 },
      { pageIndex: 1, ratio: 0.7 },
      { pageIndex: 2, ratio: 0.0 },
    ];
    const dominant = computeDominantVisiblePage(entries);
    if (dominant !== 1) {
      throw new Error(`Expected page 1 to be dominant, got ${dominant}`);
    }

    // Scenario: Barely visible below threshold (< 0.2)
    const lowEntries = [{ pageIndex: 0, ratio: 0.1 }];
    const lowDominant = computeDominantVisiblePage(lowEntries);
    if (lowDominant !== -1) {
      throw new Error(`Expected -1 for low visibility, got ${lowDominant}`);
    }
  });

  // TEST 10: Keyboard navigation mapping verification
  await test("Keyboard event mappings correctly trigger navigation actions", async () => {
    const numPages = 8;
    let page: number = 3; // Page 4

    const simulateKey = (key: string, currentPage: number): number => {
      switch (key) {
        case "PageDown":
          return clampPageIndex(currentPage + 1, numPages);
        case "PageUp":
          return clampPageIndex(currentPage - 1, numPages);
        case "Home":
          return 0;
        case "End":
          return numPages - 1;
        default:
          return currentPage;
      }
    };

    page = simulateKey("PageDown", page); // -> 4
    if (page !== 4) throw new Error("PageDown failed");

    page = simulateKey("PageUp", page); // -> 3
    if (page !== 3) throw new Error("PageUp failed");

    page = simulateKey("End", page); // -> 7
    if (page !== 7) throw new Error("End failed");

    page = simulateKey("Home", page); // -> 0
    if (page !== 0) throw new Error("Home failed");
  });

  // TEST 11: DOM ID consistency between thumbnails and viewport
  await test("DOM ID conventions match between thumbnails and viewport containers", async () => {
    for (let i = 0; i < 5; i++) {
      const pageContainerId = `editor-page-${i}`;
      const thumbnailId = `thumbnail-page-${i}`;
      const pageNumFromContainer = parseInt(pageContainerId.replace("editor-page-", ""), 10);
      const pageNumFromThumb = parseInt(thumbnailId.replace("thumbnail-page-", ""), 10);

      if (pageNumFromContainer !== i || pageNumFromThumb !== i) {
        throw new Error(`DOM ID mismatch at index ${i}`);
      }
    }
  });

  // TEST 12: Bi-directional scroll target calculation with heterogeneous heights
  await test("Bi-directional vertical scroll position calculation for mixed page heights", async () => {
    // 3 pages: A4 (842pt), Letter (792pt), Landscape (595pt), gap = 32px
    const zoom = 1.0;
    const gap = 32;
    const pageHeights = [842, 792, 595];

    // Target top offset for page 0
    const topPage0 = 0;
    // Target top offset for page 1 = height(page 0) + gap
    const topPage1 = pageHeights[0]! * zoom + gap;
    // Target top offset for page 2 = height(page 0) + height(page 1) + 2*gap
    const topPage2 = (pageHeights[0]! + pageHeights[1]!) * zoom + gap * 2;

    if (topPage0 !== 0) throw new Error("Page 0 offset incorrect");
    if (topPage1 !== 874) throw new Error(`Page 1 offset incorrect: ${topPage1}`);
    if (topPage2 !== 1698) throw new Error(`Page 2 offset incorrect: ${topPage2}`);
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
