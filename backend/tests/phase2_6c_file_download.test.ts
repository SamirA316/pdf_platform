process.env.NODE_ENV = "test";
import fs from "fs";
import path from "path";
import http from "http";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { sessionService } from "../src/modules/auth/session.service";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;

const userA = { id: "user_a_download_test", name: "User A Download", email: "user_a_download@test.local" };
const userB = { id: "user_b_download_test", name: "User B Download", email: "user_b_download@test.local" };

let tokenA = "";
let tokenB = "";

async function ensureServerRunning(): Promise<void> {
  return new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const addr = serverInstance!.address();
      const port = typeof addr === "object" && addr ? addr.port : 3001;
      BASE_URL = `http://localhost:${port}`;
      console.log(`Started Phase 2.6C in-process test server on port ${port}`);
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
const testCsrfToken = "csrf_token_for_phase2_6c_suite_1234567890";
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

async function runPhase2_6CTests(): Promise<void> {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.6C: File Download / Preview Security");
  console.log("===============================================================");

  await ensureServerRunning();
  await cleanupTestData();
  await ensureTestUsers();

  const uploadsDir = path.resolve(process.cwd(), "uploads", "users", userA.id);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // ---------------------------------------------------------------------------
  // SECTION 1: Authentication Gatekeeping (C1)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 1: Authentication Gatekeeping (C1) ---");

  // Test 1: Unauthenticated request -> 401 UNAUTHORIZED
  const res1 = await fetch(`${BASE_URL}/api/v1/files/non_existent_id/download`);
  const data1 = await res1.json();
  if (res1.status !== 401 || data1.error?.code !== "UNAUTHORIZED") {
    throw new Error(`Test 1 Failed: Expected 401 UNAUTHORIZED, got ${res1.status}`);
  }
  console.log("✅ [PASS] Test 1: Unauthenticated download returns 401 UNAUTHORIZED");

  // Test 2: Forged/invalid session token -> 401 UNAUTHORIZED
  const res2 = await fetch(`${BASE_URL}/api/v1/files/non_existent_id/download`, {
    headers: { Authorization: "Bearer forged_session_token_xyz" },
  });
  const data2 = await res2.json();
  if (res2.status !== 401 || data2.error?.code !== "UNAUTHORIZED") {
    throw new Error(`Test 2 Failed: Expected 401 UNAUTHORIZED, got ${res2.status}`);
  }
  console.log("✅ [PASS] Test 2: Forged session token returns 401 UNAUTHORIZED");

  // ---------------------------------------------------------------------------
  // SECTION 2: Ownership & Cross-User Isolation (C1)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Ownership & Cross-User Isolation (C1) ---");

  // Create valid file for User A
  const samplePdfContent = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Title (Test Document) >>\nendobj\ntrailer\n<<>>\n%%EOF");
  const physicalFilenameA = `test_file_user_a_${Date.now()}.pdf`;
  const physicalFilePathA = path.resolve(uploadsDir, physicalFilenameA);
  fs.writeFileSync(physicalFilePathA, samplePdfContent);

  const fileA = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "My Secret Report.pdf",
      storageKey: `users/${userA.id}/${physicalFilenameA}`,
      mimeType: "application/pdf",
      size: samplePdfContent.length,
      status: "READY",
    },
  });

  // Test 3: User A downloads own file -> 200 OK with correct stream
  const res3 = await fetch(`${BASE_URL}/api/v1/files/${fileA.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const text3 = await res3.text();
  if (res3.status !== 200 || !text3.startsWith("%PDF-1.4")) {
    throw new Error(`Test 3 Failed: User A could not download own file, status=${res3.status}`);
  }
  console.log("✅ [PASS] Test 3: User A downloads own file successfully (200 OK, valid %PDF- content)");

  // Test 4: User B attempts to download User A's file -> 404 FILE_NOT_FOUND (no existence leak)
  const res4 = await fetch(`${BASE_URL}/api/v1/files/${fileA.id}/download`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data4 = await res4.json();
  if (res4.status !== 404 || data4.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 4 Failed: Expected 404 FILE_NOT_FOUND for User B, got ${res4.status} (${JSON.stringify(data4)})`);
  }
  console.log("✅ [PASS] Test 4: User B cannot download User A's file -> 404 FILE_NOT_FOUND (IDOR prevented, zero existence leak)");

  // ---------------------------------------------------------------------------
  // SECTION 3: Storage Path Security & Directory Traversal Protection (C2)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 3: Storage Path Security & Directory Traversal Protection (C2) ---");

  // Test 5: Storage key with relative traversal (../../)
  const fileTraversal = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "traversal.pdf",
      storageKey: `../../package.json`,
      mimeType: "application/pdf",
      size: 100,
      status: "READY",
    },
  });
  const res5 = await fetch(`${BASE_URL}/api/v1/files/${fileTraversal.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data5 = await res5.json();
  if (res5.status !== 404 || data5.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 5 Failed: Relative path traversal not blocked: status=${res5.status}`);
  }
  console.log("✅ [PASS] Test 5: Relative traversal in storageKey (../../) rejected with 404 FILE_NOT_FOUND");

  // Test 6: Storage key with absolute path (/etc/passwd)
  const fileAbsolute = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "absolute.pdf",
      storageKey: `/etc/passwd`,
      mimeType: "application/pdf",
      size: 100,
      status: "READY",
    },
  });
  const res6 = await fetch(`${BASE_URL}/api/v1/files/${fileAbsolute.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data6 = await res6.json();
  if (res6.status !== 404 || data6.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 6 Failed: Absolute path not blocked: status=${res6.status}`);
  }
  console.log("✅ [PASS] Test 6: Absolute path in storageKey (/etc/passwd) rejected with 404 FILE_NOT_FOUND");

  // Test 7: Storage key with URL encoded traversal (%2e%2e%2f)
  const fileEncoded = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "encoded.pdf",
      storageKey: `users/${userA.id}/%2e%2e%2f%2e%2e%2fpackage.json`,
      mimeType: "application/pdf",
      size: 100,
      status: "READY",
    },
  });
  const res7 = await fetch(`${BASE_URL}/api/v1/files/${fileEncoded.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data7 = await res7.json();
  if (res7.status !== 404 || data7.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 7 Failed: Encoded traversal not blocked: status=${res7.status}`);
  }
  console.log("✅ [PASS] Test 7: URL encoded traversal in storageKey (%2e%2e) rejected with 404 FILE_NOT_FOUND");

  // Test 8: Storage key with null byte
  const fileNullByte = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "nullbyte.pdf",
      storageKey: `users/${userA.id}/sample.pdf\0.png`,
      mimeType: "application/pdf",
      size: 100,
      status: "READY",
    },
  });
  const res8 = await fetch(`${BASE_URL}/api/v1/files/${fileNullByte.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data8 = await res8.json();
  if (res8.status !== 404 || data8.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 8 Failed: Null byte not blocked: status=${res8.status}`);
  }
  console.log("✅ [PASS] Test 8: Null byte in storageKey rejected with 404 FILE_NOT_FOUND");

  // Test 8b: Outside-root Symlink Escape Protection (2.6C-1)
  const symlinkFileName = `symlink_escape_${Date.now()}.pdf`;
  const symlinkPhysicalPath = path.resolve(uploadsDir, symlinkFileName);
  let symlinkCreated = false;
  try {
    fs.symlinkSync(path.resolve(process.cwd(), "package.json"), symlinkPhysicalPath);
    symlinkCreated = true;
  } catch {}

  if (symlinkCreated) {
    const fileSymlink = await prisma.file.create({
      data: {
        userId: userA.id,
        originalName: "symlink.pdf",
        storageKey: `users/${userA.id}/${symlinkFileName}`,
        mimeType: "application/pdf",
        size: 100,
        status: "READY",
      },
    });

    const resSymlink = await fetch(`${BASE_URL}/api/v1/files/${fileSymlink.id}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataSymlink = await resSymlink.json();
    if (resSymlink.status !== 404 || dataSymlink.error?.code !== "FILE_NOT_FOUND") {
      throw new Error(`Test 8b Failed: Outside-root symlink was not blocked: status=${resSymlink.status}`);
    }
    // Clean up symlink and db record
    try {
      fs.unlinkSync(symlinkPhysicalPath);
    } catch {}
    await prisma.file.delete({ where: { id: fileSymlink.id } }).catch(() => {});
    console.log("✅ [PASS] Test 8b: Symlink pointing outside storage root is strictly blocked with 404 FILE_NOT_FOUND");
  }

  // ---------------------------------------------------------------------------
  // SECTION 4: Missing Physical File Handling (C3, C8)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Missing Physical File Handling (C3, C8) ---");

  // File record exists in DB, but physical disk file does not exist
  const fileMissingDisk = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "missing_on_disk.pdf",
      storageKey: `users/${userA.id}/ghost_file_${Date.now()}.pdf`,
      mimeType: "application/pdf",
      size: 500,
      status: "READY",
    },
  });
  const resMissing = await fetch(`${BASE_URL}/api/v1/files/${fileMissingDisk.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataMissing = await resMissing.json();
  if (resMissing.status !== 404 || dataMissing.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 9 Failed: Missing physical file expected 404 FILE_NOT_FOUND, got ${resMissing.status} (${JSON.stringify(dataMissing)})`);
  }
  if (dataMissing.error?.message.includes("/Users/") || dataMissing.error?.message.includes("ENOENT")) {
    throw new Error(`Security Violation: Server filesystem path or ENOENT leaked in error message!`);
  }
  console.log("✅ [PASS] Test 9: DB record with missing physical file safely returns 404 FILE_NOT_FOUND without path/ENOENT leak");

  // ---------------------------------------------------------------------------
  // SECTION 5: Header Security & Injection Protection (C4, C5, C7, C10)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 5: Header Security & Injection Protection (C4, C5, C7, C10) ---");

  // Test 10: Standard headers on valid download
  const headers3 = res3.headers;
  const contentType = headers3.get("content-type");
  const contentDisposition = headers3.get("content-disposition");
  const contentLength = headers3.get("content-length");
  const nosniff = headers3.get("x-content-type-options");
  const cacheControl = headers3.get("cache-control");

  if (!contentType?.includes("application/pdf")) {
    throw new Error(`Test 10 Failed: Expected Content-Type application/pdf, got ${contentType}`);
  }
  if (!contentDisposition?.startsWith("attachment;")) {
    throw new Error(`Test 10 Failed: Expected Content-Disposition starting with 'attachment;', got ${contentDisposition}`);
  }
  if (Number(contentLength) !== samplePdfContent.length) {
    throw new Error(`Test 10 Failed: Expected Content-Length ${samplePdfContent.length}, got ${contentLength}`);
  }
  if (nosniff !== "nosniff") {
    throw new Error(`Test 10 Failed: Missing or invalid X-Content-Type-Options: nosniff`);
  }
  if (!cacheControl?.includes("no-store") && !cacheControl?.includes("private")) {
    throw new Error(`Test 10 Failed: Insecure Cache-Control header: ${cacheControl}`);
  }
  console.log("✅ [PASS] Test 10: Download headers verified (Content-Type, Content-Disposition, Content-Length, nosniff, Cache-Control)");

  // Test 11: Filename injection attack protection (C4)
  // Malicious filename attempting to inject headers or break out of quoted string
  const maliciousName = 'evil.pdf"; filename="injected.html';
  const fileMaliciousName = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: maliciousName,
      storageKey: `users/${userA.id}/${physicalFilenameA}`,
      mimeType: "application/pdf",
      size: samplePdfContent.length,
      status: "READY",
    },
  });

  const resMalicious = await fetch(`${BASE_URL}/api/v1/files/${fileMaliciousName.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const maliciousDisposition = resMalicious.headers.get("content-disposition") || "";
  // Check that quotes were neutralized and no unescaped filename="injected.html" occurred
  if (maliciousDisposition.includes('"; filename="injected.html')) {
    throw new Error(`Security Violation: Content-Disposition filename injection succeeded! Header: ${maliciousDisposition}`);
  }
  console.log("✅ [PASS] Test 11: Malicious filename injection attempt neutralized in Content-Disposition:", maliciousDisposition);

  // Test 12: Executable / Dangerous MIME sanitization (C5)
  // Attempt to serve HTML / JS as executable
  const fileDangerousMime = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "malicious.html.pdf",
      storageKey: `users/${userA.id}/${physicalFilenameA}`,
      mimeType: "text/html", // Dangerous MIME in database
      size: samplePdfContent.length,
      status: "READY",
    },
  });

  const resDangerousMime = await fetch(`${BASE_URL}/api/v1/files/${fileDangerousMime.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const sanitizedContentType = resDangerousMime.headers.get("content-type");
  if (sanitizedContentType?.includes("text/html")) {
    throw new Error(`Security Violation: Dangerous MIME text/html was blindly served to client!`);
  }
  if (!sanitizedContentType?.includes("application/pdf")) {
    throw new Error(`Test 12 Failed: Expected overridden application/pdf, got ${sanitizedContentType}`);
  }
  console.log("✅ [PASS] Test 12: Dangerous MIME type (text/html) safely overridden to application/pdf");

  // ---------------------------------------------------------------------------
  // SECTION 6: HTTP Range Requests (C9)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 6: HTTP Range Requests (C9) ---");

  // Test 13: Valid HTTP Range request (bytes=0-4) -> 206 Partial Content
  const resRange = await fetch(`${BASE_URL}/api/v1/files/${fileA.id}/download`, {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      Range: "bytes=0-4",
    },
  });
  const rangeText = await resRange.text();
  const rangeHeader = resRange.headers.get("content-range");
  const rangeLength = resRange.headers.get("content-length");

  if (resRange.status !== 206) {
    throw new Error(`Test 13 Failed: Expected 206 Partial Content, got ${resRange.status}`);
  }
  if (rangeText !== "%PDF-") {
    throw new Error(`Test 13 Failed: Range chunk expected '%PDF-', got '${rangeText}'`);
  }
  if (!rangeHeader?.startsWith(`bytes 0-4/${samplePdfContent.length}`)) {
    throw new Error(`Test 13 Failed: Content-Range mismatch: ${rangeHeader}`);
  }
  if (Number(rangeLength) !== 5) {
    throw new Error(`Test 13 Failed: Partial Content-Length expected 5, got ${rangeLength}`);
  }
  console.log("✅ [PASS] Test 13: Valid HTTP Range request returns 206 Partial Content with correct bytes and Content-Range");

  // Test 14: Invalid HTTP Range request (bytes=99999-100000) -> 416 Range Not Satisfiable
  const resBadRange = await fetch(`${BASE_URL}/api/v1/files/${fileA.id}/download`, {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      Range: "bytes=99999-100000",
    },
  });
  if (resBadRange.status !== 416) {
    throw new Error(`Test 14 Failed: Expected 416 Range Not Satisfiable, got ${resBadRange.status}`);
  }
  console.log("✅ [PASS] Test 14: Invalid HTTP Range request returns 416 Range Not Satisfiable");

  // ---------------------------------------------------------------------------
  // SECTION 7: Sensitive Leakage Verification (C8)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 7: Sensitive Information Leakage Verification (C8) ---");

  // Test 15: Non-existent file ID -> 404 FILE_NOT_FOUND (no internal leakage)
  const resNonExistent = await fetch(`${BASE_URL}/api/v1/files/non_existent_cuid_12345/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataNonExistent = await resNonExistent.json();
  if (resNonExistent.status !== 404 || dataNonExistent.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 15 Failed: Expected 404 FILE_NOT_FOUND, got ${resNonExistent.status}`);
  }
  const serializedError = JSON.stringify(dataNonExistent);
  if (
    serializedError.includes("storageKey") ||
    serializedError.includes("userId") ||
    serializedError.includes("prisma") ||
    serializedError.includes("/Users/") ||
    serializedError.includes("uploads")
  ) {
    throw new Error(`Security Violation: Sensitive internal details leaked in 404 error response!`);
  }
  console.log("✅ [PASS] Test 15: Error responses strictly scrubbed; zero storageKey, userId, or server path leakage");

  // Test 16: Deleted file -> 404 FILE_NOT_FOUND
  await prisma.file.delete({ where: { id: fileA.id } });
  const resDeleted = await fetch(`${BASE_URL}/api/v1/files/${fileA.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataDeleted = await resDeleted.json();
  if (resDeleted.status !== 404 || dataDeleted.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 16 Failed: Deleted file should return 404 FILE_NOT_FOUND, got ${resDeleted.status}`);
  }
  console.log("✅ [PASS] Test 16: Deleted file returns 404 FILE_NOT_FOUND");

  console.log("\n===============================================================");
  console.log("🎉 ALL 16 FILE DOWNLOAD / PREVIEW SECURITY TESTS PASSED! (100%)");
  console.log("===============================================================\n");
}

runPhase2_6CTests()
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
