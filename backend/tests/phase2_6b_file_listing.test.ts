process.env.NODE_ENV = "test";
import fs from "fs";
import path from "path";
import http from "http";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { sessionService } from "../src/modules/auth/session.service";
import { filesService } from "../src/modules/files/files.service";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;

const userA = { id: "user_a_listing_test", name: "User A Listing", email: "user_a_listing@test.local" };
const userB = { id: "user_b_listing_test", name: "User B Listing", email: "user_b_listing@test.local" };

let tokenA = "";
let tokenB = "";

async function ensureServerRunning(): Promise<void> {
  return new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const addr = serverInstance!.address();
      const port = typeof addr === "object" && addr ? addr.port : 3001;
      BASE_URL = `http://localhost:${port}`;
      console.log(`Started Phase 2.6B in-process test server on port ${port}`);
      resolve();
    });
  });
}

async function ensureTestUsers(): Promise<void> {
  for (const u of [userA, userB]) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: u.id,
          name: u.name,
          email: u.email,
          password: "hashed_test_password_12345",
          isVerified: true,
        },
      });
    }
    u.id = user.id;
  }

  const sessionA = await sessionService.createSession(userA.id);
  tokenA = sessionA.rawToken;
  const sessionB = await sessionService.createSession(userB.id);
  tokenB = sessionB.rawToken;
}

// Wrapper for global.fetch to inject CSRF token on POST/PUT/PATCH/DELETE
const rawFetch = global.fetch;
const testCsrfToken = "csrf_token_for_phase2_6b_suite_1234567890";
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

async function cleanupTestData(): Promise<void> {
  try {
    await prisma.file.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.session.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  } catch (err) {
    console.warn("Cleanup warning:", err);
  }
}

async function runPhase2_6BTests(): Promise<void> {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.6B: File Listing & Metadata");
  console.log("===============================================================");

  await ensureServerRunning();
  await cleanupTestData();
  await ensureTestUsers();

  const dummyPdfDir = path.resolve(process.cwd(), "scratch");
  if (!fs.existsSync(dummyPdfDir)) {
    fs.mkdirSync(dummyPdfDir, { recursive: true });
  }

  // ---------------------------------------------------------------------------
  // TEST 1 & 2: Authentication Gatekeeping (B1)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 1 & 2: Authentication Gatekeeping ---");

  // Test 1: Unauthenticated request -> 401 UNAUTHORIZED
  const res1 = await fetch(`${BASE_URL}/api/v1/files`);
  const data1 = await res1.json();
  if (res1.status !== 401 || data1.error?.code !== "UNAUTHORIZED") {
    throw new Error(`Test 1 Failed: Expected 401 UNAUTHORIZED, got ${res1.status} (${JSON.stringify(data1)})`);
  }
  console.log("✅ [PASS] Test 1: Unauthenticated request to /api/v1/files returns 401 UNAUTHORIZED");

  // Test 2: Forged/invalid session token -> 401 UNAUTHORIZED
  const res2 = await fetch(`${BASE_URL}/api/v1/files`, {
    headers: { Authorization: "Bearer invalid_or_forged_token_xyz" },
  });
  const data2 = await res2.json();
  if (res2.status !== 401 || data2.error?.code !== "UNAUTHORIZED") {
    throw new Error(`Test 2 Failed: Expected 401 UNAUTHORIZED for forged token, got ${res2.status}`);
  }
  console.log("✅ [PASS] Test 2: Forged session token returns 401 UNAUTHORIZED");

  // ---------------------------------------------------------------------------
  // TEST 3: Empty State (B5)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Empty State (B5) ---");
  const resEmpty = await fetch(`${BASE_URL}/api/v1/files`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const dataEmpty = await resEmpty.json();
  if (resEmpty.status !== 200 || !dataEmpty.success) {
    throw new Error(`Test 3 Failed: Empty state must return 200 OK, got ${resEmpty.status}`);
  }
  if (!Array.isArray(dataEmpty.data.files) || dataEmpty.data.files.length !== 0) {
    throw new Error(`Test 3 Failed: Empty state files must be empty array, got ${dataEmpty.data.files.length}`);
  }
  const pagEmpty = dataEmpty.data.pagination;
  if (pagEmpty.page !== 1 || pagEmpty.limit !== 20 || pagEmpty.total !== 0 || pagEmpty.totalPages !== 0) {
    throw new Error(`Test 3 Failed: Empty pagination metadata mismatch: ${JSON.stringify(pagEmpty)}`);
  }
  console.log("✅ [PASS] Test 3: Empty state returns 200 OK with total: 0 and totalPages: 0");

  // ---------------------------------------------------------------------------
  // SETUP: Upload 5 distinct test files for User A
  // ---------------------------------------------------------------------------
  console.log("\n--- Populating 5 test files for User A ---");
  const fileSpecs = [
    { name: "a_alpha.pdf", size: 100 },
    { name: "b_bravo.pdf", size: 300 },
    { name: "c_charlie.pdf", size: 200 },
    { name: "d_delta.pdf", size: 500 },
    { name: "e_echo.pdf", size: 400 },
  ];

  for (const spec of fileSpecs) {
    const tempFile = path.resolve(dummyPdfDir, spec.name);
    // Create dummy PDF buffer of exact size
    const buf = Buffer.alloc(spec.size, 0x20);
    buf.write("%PDF-1.4\n", 0);
    fs.writeFileSync(tempFile, buf);

    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(tempFile)], { type: "application/pdf" }), spec.name);
    const uploadRes = await fetch(`${BASE_URL}/api/v1/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: form,
    });
    const uploadJson = await uploadRes.json();
    if (uploadRes.status !== 201) {
      throw new Error(`Failed to upload ${spec.name}: ${JSON.stringify(uploadJson)}`);
    }
    // Small sleep to ensure distinct createdAt timestamps
    await new Promise((r) => setTimeout(r, 20));
  }
  console.log("✅ Successfully created 5 files for User A");

  // ---------------------------------------------------------------------------
  // TEST 4 & 5: Scoped Listing & User Isolation (B1)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4 & 5: Ownership & Cross-User Isolation (B1) ---");
  const resUserA = await fetch(`${BASE_URL}/api/v1/files`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataUserA = await resUserA.json();
  if (resUserA.status !== 200 || dataUserA.data.files.length !== 5 || dataUserA.data.pagination.total !== 5) {
    throw new Error(`Test 4 Failed: User A should see exactly 5 files, got ${dataUserA.data.files.length}`);
  }
  console.log("✅ [PASS] Test 4: User A sees only own 5 files");

  // User B query must return 0 files (no data leak)
  const resUserB = await fetch(`${BASE_URL}/api/v1/files`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const dataUserB = await resUserB.json();
  if (resUserB.status !== 200 || dataUserB.data.files.length !== 0 || dataUserB.data.pagination.total !== 0) {
    throw new Error(`Test 5 Failed: User B cross-user leak detected! Got ${dataUserB.data.files.length} files`);
  }
  console.log("✅ [PASS] Test 5: User B sees 0 files (zero cross-user leakage)");

  // ---------------------------------------------------------------------------
  // TEST 6: Default Pagination (B2)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: Default Pagination (B2) ---");
  const pag = dataUserA.data.pagination;
  if (pag.page !== 1 || pag.limit !== 20 || pag.total !== 5 || pag.totalPages !== 1) {
    throw new Error(`Test 6 Failed: Default pagination mismatch: ${JSON.stringify(pag)}`);
  }
  console.log("✅ [PASS] Test 6: Default pagination returns page=1, limit=20, total=5, totalPages=1");

  // ---------------------------------------------------------------------------
  // TEST 7 & 8: Custom Pagination & Page Boundaries (B2)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7 & 8: Custom Pagination & Page Boundaries (B2) ---");
  // Page 1, limit 2
  const resPage1 = await fetch(`${BASE_URL}/api/v1/files?page=1&limit=2`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataPage1 = await resPage1.json();
  if (dataPage1.data.files.length !== 2 || dataPage1.data.pagination.totalPages !== 3) {
    throw new Error(`Test 7 Failed: Page 1 with limit 2 expected 2 files and totalPages 3, got: ${JSON.stringify(dataPage1.data.pagination)}`);
  }

  // Page 2, limit 2
  const resPage2 = await fetch(`${BASE_URL}/api/v1/files?page=2&limit=2`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataPage2 = await resPage2.json();
  if (dataPage2.data.files.length !== 2 || dataPage2.data.pagination.page !== 2) {
    throw new Error(`Test 7b Failed: Page 2 with limit 2 expected 2 files`);
  }

  // Page 3, limit 2 (last remaining item)
  const resPage3 = await fetch(`${BASE_URL}/api/v1/files?page=3&limit=2`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataPage3 = await resPage3.json();
  if (dataPage3.data.files.length !== 1 || dataPage3.data.pagination.page !== 3) {
    throw new Error(`Test 7c Failed: Page 3 with limit 2 expected 1 file`);
  }

  // Page 4, limit 2 (beyond total items)
  const resPage4 = await fetch(`${BASE_URL}/api/v1/files?page=4&limit=2`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataPage4 = await resPage4.json();
  if (dataPage4.data.files.length !== 0 || dataPage4.data.pagination.page !== 4 || dataPage4.data.pagination.totalPages !== 3) {
    throw new Error(`Test 8 Failed: Out-of-bounds page should return empty files array`);
  }
  console.log("✅ [PASS] Test 7 & 8: Custom pagination across page 1, 2, 3, and out-of-bounds page 4 verified");

  // ---------------------------------------------------------------------------
  // TEST 9: Limit > 100 Rejection (B2, B7)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 9: Limit > 100 Rejection (B7) ---");
  const resOverLimit = await fetch(`${BASE_URL}/api/v1/files?limit=101`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataOverLimit = await resOverLimit.json();
  if (resOverLimit.status !== 400 || dataOverLimit.error?.code !== "LIMIT_EXCEEDED") {
    throw new Error(`Test 9 Failed: limit=101 should return 400 LIMIT_EXCEEDED, got ${resOverLimit.status} (${JSON.stringify(dataOverLimit)})`);
  }
  console.log("✅ [PASS] Test 9: Limit > 100 is rejected with 400 LIMIT_EXCEEDED");

  // ---------------------------------------------------------------------------
  // TEST 10: Invalid Page Validation (B7)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 10: Invalid Page Validation (B7) ---");
  const invalidPages = ["0", "-1", "abc", "1.5"];
  for (const badPage of invalidPages) {
    const resBad = await fetch(`${BASE_URL}/api/v1/files?page=${badPage}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataBad = await resBad.json();
    if (resBad.status !== 400 || dataBad.error?.code !== "INVALID_PAGE") {
      throw new Error(`Test 10 Failed: page=${badPage} should return 400 INVALID_PAGE, got ${resBad.status}`);
    }
  }
  console.log("✅ [PASS] Test 10: Invalid page values (0, -1, 'abc', 1.5) rejected with 400 INVALID_PAGE");

  // ---------------------------------------------------------------------------
  // TEST 11: Invalid Limit Validation (B7)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 11: Invalid Limit Validation (B7) ---");
  const invalidLimits = ["0", "-5", "xyz", "0.5"];
  for (const badLimit of invalidLimits) {
    const resBad = await fetch(`${BASE_URL}/api/v1/files?limit=${badLimit}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataBad = await resBad.json();
    if (resBad.status !== 400 || dataBad.error?.code !== "INVALID_LIMIT") {
      throw new Error(`Test 11 Failed: limit=${badLimit} should return 400 INVALID_LIMIT, got ${resBad.status}`);
    }
  }
  console.log("✅ [PASS] Test 11: Invalid limit values (0, -5, 'xyz') rejected with 400 INVALID_LIMIT");

  // ---------------------------------------------------------------------------
  // TEST 12: Valid Sorting (B3)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 12: Valid Sorting (B3) ---");

  // Sort by size ascending (100, 200, 300, 400, 500)
  const resSortSizeAsc = await fetch(`${BASE_URL}/api/v1/files?sortBy=size&sortOrder=asc`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataSortSizeAsc = await resSortSizeAsc.json();
  const sizesAsc = dataSortSizeAsc.data.files.map((f: any) => f.size);
  if (JSON.stringify(sizesAsc) !== JSON.stringify([100, 200, 300, 400, 500])) {
    throw new Error(`Test 12a Failed: Expected size asc [100,200,300,400,500], got ${JSON.stringify(sizesAsc)}`);
  }
  console.log("✅ [PASS] Test 12a: Sort by size asc verified: [100, 200, 300, 400, 500]");

  // Sort by size descending (500, 400, 300, 200, 100)
  const resSortSizeDesc = await fetch(`${BASE_URL}/api/v1/files?sortBy=size&sortOrder=desc`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataSortSizeDesc = await resSortSizeDesc.json();
  const sizesDesc = dataSortSizeDesc.data.files.map((f: any) => f.size);
  if (JSON.stringify(sizesDesc) !== JSON.stringify([500, 400, 300, 200, 100])) {
    throw new Error(`Test 12b Failed: Expected size desc [500,400,300,200,100], got ${JSON.stringify(sizesDesc)}`);
  }
  console.log("✅ [PASS] Test 12b: Sort by size desc verified: [500, 400, 300, 200, 100]");

  // Sort by filename ascending (a_alpha, b_bravo, c_charlie, d_delta, e_echo)
  const resSortNameAsc = await fetch(`${BASE_URL}/api/v1/files?sortBy=filename&sortOrder=asc`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataSortNameAsc = await resSortNameAsc.json();
  const namesAsc = dataSortNameAsc.data.files.map((f: any) => f.filename);
  if (JSON.stringify(namesAsc) !== JSON.stringify(["a_alpha.pdf", "b_bravo.pdf", "c_charlie.pdf", "d_delta.pdf", "e_echo.pdf"])) {
    throw new Error(`Test 12c Failed: Expected filename asc, got ${JSON.stringify(namesAsc)}`);
  }
  console.log("✅ [PASS] Test 12c: Sort by filename asc verified");

  // Sort by filename descending
  const resSortNameDesc = await fetch(`${BASE_URL}/api/v1/files?sortBy=filename&sortOrder=desc`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataSortNameDesc = await resSortNameDesc.json();
  const namesDesc = dataSortNameDesc.data.files.map((f: any) => f.filename);
  if (JSON.stringify(namesDesc) !== JSON.stringify(["e_echo.pdf", "d_delta.pdf", "c_charlie.pdf", "b_bravo.pdf", "a_alpha.pdf"])) {
    throw new Error(`Test 12d Failed: Expected filename desc, got ${JSON.stringify(namesDesc)}`);
  }
  console.log("✅ [PASS] Test 12d: Sort by filename desc verified");

  // Sort by createdAt desc
  const resSortCreatedDesc = await fetch(`${BASE_URL}/api/v1/files?sortBy=createdAt&sortOrder=desc`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataSortCreatedDesc = await resSortCreatedDesc.json();
  if (dataSortCreatedDesc.data.files[0].filename !== "e_echo.pdf") {
    throw new Error(`Test 12e Failed: Expected newest created file e_echo.pdf first`);
  }
  console.log("✅ [PASS] Test 12e: Sort by createdAt desc verified");

  // Sort by updatedAt
  const resSortUpdatedDesc = await fetch(`${BASE_URL}/api/v1/files?sortBy=updatedAt&sortOrder=desc`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (resSortUpdatedDesc.status !== 200) {
    throw new Error(`Test 12f Failed: Expected 200 OK for sortBy=updatedAt`);
  }
  console.log("✅ [PASS] Test 12f: Sort by updatedAt verified");

  // ---------------------------------------------------------------------------
  // TEST 13: Invalid sortBy Validation (B3, B7)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 13: Invalid sortBy Rejection (B7) ---");
  const badSortFields = ["storageKey", "userId", "password", "internalPath", "drop table"];
  for (const badSort of badSortFields) {
    const resBad = await fetch(`${BASE_URL}/api/v1/files?sortBy=${badSort}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataBad = await resBad.json();
    if (resBad.status !== 400 || dataBad.error?.code !== "INVALID_SORT_FIELD") {
      throw new Error(`Test 13 Failed: sortBy=${badSort} should return 400 INVALID_SORT_FIELD, got ${resBad.status}`);
    }
  }
  console.log("✅ [PASS] Test 13: Non-allowlisted sortBy fields rejected with 400 INVALID_SORT_FIELD");

  // ---------------------------------------------------------------------------
  // TEST 14: Invalid sortOrder Validation (B3, B7)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 14: Invalid sortOrder Rejection (B7) ---");
  const badOrders = ["up", "down", "side", "invalid", "123"];
  for (const badOrder of badOrders) {
    const resBad = await fetch(`${BASE_URL}/api/v1/files?sortOrder=${badOrder}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataBad = await resBad.json();
    if (resBad.status !== 400 || dataBad.error?.code !== "INVALID_SORT_ORDER") {
      throw new Error(`Test 14 Failed: sortOrder=${badOrder} should return 400 INVALID_SORT_ORDER, got ${resBad.status}`);
    }
  }
  console.log("✅ [PASS] Test 14: Invalid sortOrder rejected with 400 INVALID_SORT_ORDER");

  // ---------------------------------------------------------------------------
  // TEST 15: Public Metadata Consistency & Strict Leakage Check (B4)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 15: Public Metadata Consistency & Strict Leakage Check (B4) ---");
  for (const file of dataUserA.data.files) {
    // Required safe public attributes
    if (!file.id || typeof file.id !== "string") throw new Error("Missing or invalid 'id'");
    if (!file.filename || typeof file.filename !== "string") throw new Error("Missing or invalid 'filename'");
    if (!file.originalName || typeof file.originalName !== "string") throw new Error("Missing or invalid 'originalName'");
    if (typeof file.size !== "number") throw new Error("Missing or invalid 'size'");
    if (!file.mimeType || typeof file.mimeType !== "string") throw new Error("Missing or invalid 'mimeType'");
    if (!file.status || typeof file.status !== "string") throw new Error("Missing or invalid 'status'");
    if (!file.createdAt) throw new Error("Missing 'createdAt'");
    if (!file.updatedAt) throw new Error("Missing 'updatedAt'");

    // FORBIDDEN sensitive fields
    if ("userId" in file) throw new Error("Security Violation: 'userId' leaked in file listing DTO!");
    if ("storageKey" in file) throw new Error("Security Violation: 'storageKey' leaked in file listing DTO!");
    if ("path" in file) throw new Error("Security Violation: 'path' leaked in file listing DTO!");
    if ("physicalPath" in file) throw new Error("Security Violation: 'physicalPath' leaked in file listing DTO!");
    if ("internalPath" in file) throw new Error("Security Violation: 'internalPath' leaked in file listing DTO!");
    if ("user" in file) throw new Error("Security Violation: 'user' relation leaked in file listing DTO!");
    if ("sourceJob" in file) throw new Error("Security Violation: 'sourceJob' relation leaked in file listing DTO!");
  }
  console.log("✅ [PASS] Test 15: All files contain safe public metadata; zero sensitive fields leaked");

  // ---------------------------------------------------------------------------
  // TEST 16: Pagination Calculations (Total & TotalPages) (B2, B8)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 16: Pagination Calculations (Total & TotalPages) ---");
  const testLimits = [
    { limit: 1, expectedTotalPages: 5 },
    { limit: 2, expectedTotalPages: 3 },
    { limit: 3, expectedTotalPages: 2 },
    { limit: 5, expectedTotalPages: 1 },
    { limit: 10, expectedTotalPages: 1 },
    { limit: 20, expectedTotalPages: 1 },
  ];

  for (const t of testLimits) {
    const resPagCalc = await fetch(`${BASE_URL}/api/v1/files?limit=${t.limit}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataPagCalc = await resPagCalc.json();
    if (dataPagCalc.data.pagination.total !== 5) {
      throw new Error(`Test 16 Failed: total mismatch for limit ${t.limit}: got ${dataPagCalc.data.pagination.total}`);
    }
    if (dataPagCalc.data.pagination.totalPages !== t.expectedTotalPages) {
      throw new Error(`Test 16 Failed: totalPages mismatch for limit ${t.limit}: expected ${t.expectedTotalPages}, got ${dataPagCalc.data.pagination.totalPages}`);
    }
  }
  console.log("✅ [PASS] Test 16: Pagination calculations (total & totalPages) verified across all limits");

  console.log("\n===============================================================");
  console.log("🎉 ALL 16 FILE LISTING & METADATA TESTS PASSED! (100%)");
  console.log("===============================================================\n");
}

runPhase2_6BTests()
  .then(() => {
    cleanupTestData().finally(() => {
      if (serverInstance) {
        serverInstance.close();
      }
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    cleanupTestData().finally(() => {
      if (serverInstance) {
        serverInstance.close();
      }
      process.exit(1);
    });
  });
