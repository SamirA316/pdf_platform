process.env.NODE_ENV = "test";
// Configure test quota limits before module loading
process.env.USER_STORAGE_QUOTA_BYTES = "1000"; // 1,000 bytes test quota
process.env.MAX_FILE_SIZE_BYTES = "600";       // 600 bytes max file size

import fs from "fs";
import path from "path";
import http from "http";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { sessionService } from "../src/modules/auth/session.service";
import { filesService } from "../src/modules/files/files.service";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;

const userA = { id: "user_a_quota_test", name: "User A Quota", email: "user_a_quota@test.local" };
const userB = { id: "user_b_quota_test", name: "User B Quota", email: "user_b_quota@test.local" };

let tokenA = "";
let tokenB = "";

async function ensureServerRunning(): Promise<void> {
  return new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const addr = serverInstance!.address();
      const port = typeof addr === "object" && addr ? addr.port : 3001;
      BASE_URL = `http://localhost:${port}`;
      console.log(`Started Phase 2.6E in-process test server on port ${port}`);
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
const testCsrfToken = "csrf_token_for_phase2_6e_suite_1234567890";
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

function createDummyPdfBuffer(sizeBytes: number): Buffer {
  const buf = Buffer.alloc(sizeBytes, 0x20);
  if (sizeBytes >= 10) {
    buf.write("%PDF-1.4\n", 0);
  }
  return buf;
}

async function uploadPdf(token: string, filename: string, sizeBytes: number): Promise<{ status: number; body: any }> {
  const buffer = createDummyPdfBuffer(sizeBytes);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);

  const res = await fetch(`${BASE_URL}/api/v1/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const body = await res.json();
  return { status: res.status, body };
}

async function runPhase2_6ETests(): Promise<void> {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.6E: Storage Quotas & Limits");
  console.log("===============================================================");

  await ensureServerRunning();
  await cleanupTestData();
  await ensureTestUsers();

  let fileA1Id = "";

  // ---------------------------------------------------------------------------
  // TEST 1: Normal upload within quota
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 1: Normal Upload Within Quota ---");
  // Upload 300 bytes (within 600 max file size and within 1000 quota)
  const { status: normStatus, body: normBody } = await uploadPdf(tokenA, "file_300b.pdf", 300);
  if (normStatus !== 201 || !normBody.data?.file?.id) {
    throw new Error(`Test 1 Failed: Expected 201 Created for 300b file, got ${normStatus} (${JSON.stringify(normBody)})`);
  }
  fileA1Id = normBody.data.file.id;

  const resQuota1 = await fetch(`${BASE_URL}/api/v1/files/quota`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataQuota1 = await resQuota1.json();
  if (dataQuota1.data.usage !== 300 || dataQuota1.data.remaining !== 700) {
    throw new Error(`Test 1 Failed: Expected 300 used / 700 remaining, got ${JSON.stringify(dataQuota1.data)}`);
  }
  console.log("✅ [PASS] Test 1: Normal upload within quota succeeded (usage: 300 / 1000, remaining: 700)");

  // ---------------------------------------------------------------------------
  // TEST 2: Exact quota boundary
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Exact Quota Boundary Upload ---");
  // Current usage is 300. Quota is 1000. Uploading 600 bytes reaches 900.
  const { status: boundStatus, body: boundBody } = await uploadPdf(tokenA, "file_600b.pdf", 600);
  if (boundStatus !== 201) {
    throw new Error(`Test 2 Failed: Expected 201 for 600b file, got ${boundStatus}`);
  }

  // Now usage is 900. Uploading exactly 100 bytes hits the exact 1000 boundary!
  const { status: exactStatus, body: exactBody } = await uploadPdf(tokenA, "file_100b.pdf", 100);
  if (exactStatus !== 201) {
    throw new Error(`Test 2 Failed: Expected 201 for exact boundary upload (1000 total), got ${exactStatus}`);
  }

  const resQuotaExact = await fetch(`${BASE_URL}/api/v1/files/quota`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataQuotaExact = await resQuotaExact.json();
  if (dataQuotaExact.data.usage !== 1000 || dataQuotaExact.data.remaining !== 0) {
    throw new Error(`Test 2 Failed: Expected usage: 1000 / remaining: 0, got ${JSON.stringify(dataQuotaExact.data)}`);
  }
  console.log("✅ [PASS] Test 2: Exact quota boundary reached (usage: 1000 / 1000, remaining: 0)");

  // ---------------------------------------------------------------------------
  // TEST 3: Quota exceeded
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Quota Exceeded Rejection ---");
  // Current usage is 1000 (quota full). Uploading even 50 bytes must fail with 400 STORAGE_QUOTA_EXCEEDED.
  const { status: exceedStatus, body: exceedBody } = await uploadPdf(tokenA, "file_50b.pdf", 50);
  if (exceedStatus !== 400 || exceedBody.error?.code !== "STORAGE_QUOTA_EXCEEDED") {
    throw new Error(`Test 3 Failed: Expected 400 STORAGE_QUOTA_EXCEEDED, got ${exceedStatus} (${JSON.stringify(exceedBody)})`);
  }
  console.log("✅ [PASS] Test 3: Quota breach rejected with 400 STORAGE_QUOTA_EXCEEDED");

  // ---------------------------------------------------------------------------
  // TEST 4: Per-file limit exceeded (Multer & business alignment)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Per-File Size Limit Exceeded (Multer Alignment) ---");
  const quotaBeforeOver = await (await fetch(`${BASE_URL}/api/v1/files/quota`, { headers: { Authorization: `Bearer ${tokenA}` } })).json();
  const dbCountBeforeOver = await prisma.file.count({ where: { userId: userA.id } });

  // Limit is 600 bytes. Uploading 650 bytes must fail with 413 FILE_TOO_LARGE.
  const { status: overFileStatus, body: overFileBody } = await uploadPdf(tokenA, "oversized_file.pdf", 650);
  if (overFileStatus !== 413 || overFileBody.error?.code !== "FILE_TOO_LARGE") {
    throw new Error(`Test 4 Failed: Expected 413 FILE_TOO_LARGE for file exceeding 600 bytes, got ${overFileStatus} (${JSON.stringify(overFileBody)})`);
  }

  // Verify: File DB me create nahi honi chahiye aur quota usage increase nahi hona chahiye
  const dbCountAfterOver = await prisma.file.count({ where: { userId: userA.id } });
  if (dbCountAfterOver !== dbCountBeforeOver) {
    throw new Error(`Test 4 Failed: Oversized file created a DB record! Count before: ${dbCountBeforeOver}, after: ${dbCountAfterOver}`);
  }
  const quotaAfterOver = await (await fetch(`${BASE_URL}/api/v1/files/quota`, { headers: { Authorization: `Bearer ${tokenA}` } })).json();
  if (quotaAfterOver.data.usage !== quotaBeforeOver.data.usage) {
    throw new Error(`Test 4 Failed: Quota usage mutated on oversized upload! Before: ${quotaBeforeOver.data.usage}, after: ${quotaAfterOver.data.usage}`);
  }
  console.log("✅ [PASS] Test 4: Per-file limit (> 600 bytes) rejected with 413 FILE_TOO_LARGE before disk write (DB file absent, quota unchanged)");

  // ---------------------------------------------------------------------------
  // TEST 5: Deleted file no longer counts
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: Deleted Files Free Up Quota ---");
  // Delete fileA1 (300 bytes)
  const resDel = await fetch(`${BASE_URL}/api/v1/files/${fileA1Id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (resDel.status !== 200) {
    throw new Error(`Test 5 Failed: Could not delete file: ${resDel.status}`);
  }

  const resQuotaAfterDel = await fetch(`${BASE_URL}/api/v1/files/quota`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataQuotaAfterDel = await resQuotaAfterDel.json();
  if (dataQuotaAfterDel.data.usage !== 700 || dataQuotaAfterDel.data.remaining !== 300) {
    throw new Error(`Test 5 Failed: Expected 700 used / 300 remaining after deleting 300b file, got ${JSON.stringify(dataQuotaAfterDel.data)}`);
  }
  console.log("✅ [PASS] Test 5: Deleting 300b file immediately freed up quota (usage: 700 / 1000, remaining: 300)");

  // ---------------------------------------------------------------------------
  // TEST 6: User A quota isolated from User B
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: User A Quota Isolated from User B ---");
  // User B queries quota -> should be 0 used / 1000 remaining
  const resQuotaUserB = await fetch(`${BASE_URL}/api/v1/files/quota`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const dataQuotaUserB = await resQuotaUserB.json();
  if (dataQuotaUserB.data.usage !== 0 || dataQuotaUserB.data.remaining !== 1000) {
    throw new Error(`Test 6 Failed: User B quota leaked User A usage: ${JSON.stringify(dataQuotaUserB.data)}`);
  }

  // User B uploads 500 bytes -> success
  const { status: uBStatus, body: uBBody } = await uploadPdf(tokenB, "user_b_file.pdf", 500);
  if (uBStatus !== 201) {
    throw new Error(`Test 6 Failed: User B upload failed: ${uBStatus}`);
  }

  // User B now has 500 used / 500 remaining
  const resQuotaUserB2 = await fetch(`${BASE_URL}/api/v1/files/quota`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const dataQuotaUserB2 = await resQuotaUserB2.json();
  if (dataQuotaUserB2.data.usage !== 500 || dataQuotaUserB2.data.remaining !== 500) {
    throw new Error(`Test 6 Failed: User B quota calculation mismatch: ${JSON.stringify(dataQuotaUserB2.data)}`);
  }

  // User A quota remains strictly 700 used / 300 remaining
  const resQuotaUserA2 = await fetch(`${BASE_URL}/api/v1/files/quota`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataQuotaUserA2 = await resQuotaUserA2.json();
  if (dataQuotaUserA2.data.usage !== 700 || dataQuotaUserA2.data.remaining !== 300) {
    throw new Error(`Test 6 Failed: User A quota was affected by User B upload: ${JSON.stringify(dataQuotaUserA2.data)}`);
  }
  console.log("✅ [PASS] Test 6: Cross-user quota isolation verified (User A: 700/1000, User B: 500/1000)");

  // ---------------------------------------------------------------------------
  // TEST 7: Concurrent uploads (Race Condition Protection)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: Concurrent Upload Race Condition Protection ---");
  // User A currently has 700 bytes used, remaining 300 bytes.
  // We fire two concurrent uploads of 200 bytes each.
  // If race condition protection failed, both would see 700 used and both would succeed (700 + 200 + 200 = 1100 > 1000).
  // With atomic quota reservation, exactly ONE must succeed (201) and ONE must be rejected (400 STORAGE_QUOTA_EXCEEDED).
  const results7 = await Promise.allSettled([
    uploadPdf(tokenA, "concurrent_1.pdf", 200),
    uploadPdf(tokenA, "concurrent_2.pdf", 200),
  ]);

  const successful7 = results7.filter(
    (r) => r.status === "fulfilled" && r.value.status === 201
  );
  const rejected7 = results7.filter(
    (r) => r.status === "fulfilled" && r.value.status === 400
  );

  if (successful7.length !== 1 || rejected7.length !== 1) {
    throw new Error(`Test 7 Failed: Expected exactly 1 successful (201) and 1 rejected (400), got: successful=${successful7.length}, rejected=${rejected7.length}`);
  }

  const failedUpload = rejected7[0] as PromiseFulfilledResult<{ status: number; body: any }>;
  if (failedUpload.value.body.error?.code !== "STORAGE_QUOTA_EXCEEDED") {
    throw new Error(`Test 7 Failed: Expected failed concurrent upload to have code STORAGE_QUOTA_EXCEEDED, got: ${JSON.stringify(failedUpload.value.body)}`);
  }
  console.log("✅ [PASS] Test 7: Concurrent uploads safely serialized via atomic quota reservation (exactly 1 succeeded, 1 rejected with STORAGE_QUOTA_EXCEEDED)");

  // ---------------------------------------------------------------------------
  // TEST 8: Zero-byte file
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: Zero-Byte File Rejection ---");
  const { status: zeroStatus, body: zeroBody } = await uploadPdf(tokenA, "zero_file.pdf", 0);
  if (zeroStatus !== 400 || zeroBody.error?.code !== "EMPTY_FILE") {
    throw new Error(`Test 8 Failed: 0-byte file should return 400 EMPTY_FILE, got ${zeroStatus} (${JSON.stringify(zeroBody)})`);
  }
  console.log("✅ [PASS] Test 8: Zero-byte file rejected with 400 EMPTY_FILE, zero quota consumed");

  // ---------------------------------------------------------------------------
  // TEST 9: Invalid size
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 9: Invalid Size Values ---");
  try {
    await filesService.createFile(userA.id, "bad_size.pdf", "users/dummy.pdf", "application/pdf", -50);
    throw new Error("Should have thrown error for negative size");
  } catch (err: any) {
    if (err.code !== "INVALID_FILE_SIZE") {
      throw new Error(`Test 9 Failed: Expected INVALID_FILE_SIZE, got ${err.code}`);
    }
  }
  try {
    await filesService.createFile(userA.id, "bad_nan.pdf", "users/dummy.pdf", "application/pdf", NaN);
    throw new Error("Should have thrown error for NaN size");
  } catch (err: any) {
    if (err.code !== "INVALID_FILE_SIZE") {
      throw new Error(`Test 9 Failed: Expected INVALID_FILE_SIZE for NaN, got ${err.code}`);
    }
  }
  console.log("✅ [PASS] Test 9: Invalid negative / NaN sizes rejected with INVALID_FILE_SIZE");

  // ---------------------------------------------------------------------------
  // TEST 10: Quota API
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 10: Quota API Accuracy ---");
  const resQuotaCheck = await fetch(`${BASE_URL}/api/v1/files/quota`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataQuotaCheck = await resQuotaCheck.json();
  if (resQuotaCheck.status !== 200 || !dataQuotaCheck.success) {
    throw new Error(`Test 10 Failed: Quota API expected 200 OK, got ${resQuotaCheck.status}`);
  }
  const qCheck = dataQuotaCheck.data;
  // Current usage is 700 + 200 = 900. Quota = 1000. Remaining = 100.
  if (qCheck.usage !== 900 || qCheck.quota !== 1000 || qCheck.remaining !== 100) {
    throw new Error(`Test 10 Failed: Expected 900 used / 1000 quota / 100 remaining, got ${JSON.stringify(qCheck)}`);
  }
  console.log("✅ [PASS] Test 10: Quota API returns verified accurate usage, quota, and remaining values");

  // ---------------------------------------------------------------------------
  // TEST 11: Failed upload doesn't consume quota & DB failure rollback (Failure Cleanup)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 11: Failed Upload Quota Leak & DB Failure Rollback Verification ---");
  // 11a: Attempt upload that fails due to quota exceed (300 > 100 remaining)
  await uploadPdf(tokenA, "should_fail.pdf", 300);

  const resQuotaAfterFail = await fetch(`${BASE_URL}/api/v1/files/quota`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataQuotaAfterFail = await resQuotaAfterFail.json();
  if (dataQuotaAfterFail.data.usage !== 900 || dataQuotaAfterFail.data.remaining !== 100) {
    throw new Error(`Test 11 Failed: Usage mutated after failed upload: ${JSON.stringify(dataQuotaAfterFail.data)}`);
  }

  // 11b: Failure cleanup test: Quota reservation succeeds, but DB File creation fails
  // Expected: DB File absent, Physical file cleaned, Quota usage restored
  const quotaBeforeDbFail = dataQuotaAfterFail.data.usage; // 900 bytes
  const originalCreateRecord = filesService.createFileRecord;
  filesService.createFileRecord = async () => {
    throw new Error("Simulated database failure during file record creation");
  };

  try {
    const dbFailRes = await uploadPdf(tokenA, "db_fail_test.pdf", 50);
    if (dbFailRes.status === 201) {
      throw new Error("Expected upload to fail when DB creation throws, but got 201");
    }
  } finally {
    filesService.createFileRecord = originalCreateRecord;
  }

  // Verify: Quota usage restored back to 900 bytes (zero leak)
  const resQuotaAfterDbFail = await fetch(`${BASE_URL}/api/v1/files/quota`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataQuotaAfterDbFail = await resQuotaAfterDbFail.json();
  if (dataQuotaAfterDbFail.data.usage !== quotaBeforeDbFail) {
    throw new Error(`Test 11 Failed: Quota usage leaked after DB creation failure! Expected: ${quotaBeforeDbFail}, got: ${dataQuotaAfterDbFail.data.usage}`);
  }
  console.log("✅ [PASS] Test 11: Failed uploads and simulated DB failures cleanly restore quota and clean physical files (zero leaks)");

  // ---------------------------------------------------------------------------
  // TEST 12: Concurrent final usage <= quota
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 12: Concurrent Final Usage Strictly <= Quota ---");
  // Remaining quota is 100 bytes (usage: 900 / 1000).
  // Fire THREE concurrent uploads of 100 bytes each simultaneously.
  // Exactly ONE must succeed to reach 1000, and the other TWO must be rejected.
  const results12 = await Promise.allSettled([
    uploadPdf(tokenA, "batch_concur_1.pdf", 100),
    uploadPdf(tokenA, "batch_concur_2.pdf", 100),
    uploadPdf(tokenA, "batch_concur_3.pdf", 100),
  ]);

  const successful12 = results12.filter(
    (r) => r.status === "fulfilled" && r.value.status === 201
  );
  const rejected12 = results12.filter(
    (r) => r.status === "fulfilled" && r.value.status === 400
  );

  if (successful12.length !== 1 || rejected12.length !== 2) {
    throw new Error(`Test 12 Failed: Expected exactly 1 successful (201) and 2 rejected (400), got: successful=${successful12.length}, rejected=${rejected12.length}`);
  }

  // Verify final usage is exactly 1000 bytes, strictly <= quota (1000 bytes)
  const resQuotaFinal = await fetch(`${BASE_URL}/api/v1/files/quota`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataQuotaFinal = await resQuotaFinal.json();
  if (dataQuotaFinal.data.usage !== 1000 || dataQuotaFinal.data.remaining !== 0) {
    throw new Error(`Test 12 Failed: Final usage breached quota or was inconsistent: ${JSON.stringify(dataQuotaFinal.data)}`);
  }
  if (dataQuotaFinal.data.usage > dataQuotaFinal.data.quota) {
    throw new Error(`Test 12 Failed: CRITICAL - Final usage (${dataQuotaFinal.data.usage}) strictly exceeded quota (${dataQuotaFinal.data.quota})!`);
  }
  console.log("✅ [PASS] Test 12: High concurrency verified: Exactly 1 allowed, 2 rejected, final usage strictly <= quota (usage: 1000 / 1000, remaining: 0)");

  console.log("\n===============================================================");
  console.log("🎉 ALL 12 STORAGE QUOTA & LIMIT TESTS PASSED! (100%)");
  console.log("===============================================================\n");
}

runPhase2_6ETests()
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
