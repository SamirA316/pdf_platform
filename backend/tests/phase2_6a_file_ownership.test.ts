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

const userA = { id: "user_a_ownership_test", name: "User A", email: "user_a_ownership@test.local" };
const userB = { id: "user_b_ownership_test", name: "User B", email: "user_b_ownership@test.local" };

let tokenA = "";
let tokenB = "";

async function ensureServerRunning(): Promise<void> {
  return new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const addr = serverInstance!.address();
      const port = typeof addr === "object" && addr ? addr.port : 3001;
      BASE_URL = `http://localhost:${port}`;
      console.log(`Started Phase 2.6A in-process test server on port ${port}`);
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
const testCsrfToken = "csrf_token_for_phase2_6a_suite_1234567890";
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

async function runTests(): Promise<void> {
  console.log("===============================================================");
  console.log("▶ [REGRESSION] Running Phase 2.6A: File Ownership & Access Control");
  console.log("===============================================================");

  await ensureServerRunning();
  await ensureTestUsers();

  const tempDir = path.join(process.cwd(), "tests", "fixtures");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const samplePdfPath = path.join(tempDir, "sample_ownership.pdf");
  const validPdfContent = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n`;
  fs.writeFileSync(samplePdfPath, validPdfContent);

  let userAFileId = "";
  let userBFileId = "";
  let userADocId = "";
  let userAJobId = "";
  let userAJobOutputFileId = "";

  // ---------------------------------------------------------------------------
  // SECTION 1: Authentication & Session Enforcement
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 1: Authentication & Session Gatekeeping ---");

  // Test 1: Request with no session returns 401 UNAUTHORIZED
  const res1 = await fetch(`${BASE_URL}/api/v1/files`);
  const data1 = await res1.json();
  if (res1.status !== 401 || data1.error?.code !== "UNAUTHORIZED") {
    throw new Error(`Test 1 Failed: Expected 401 UNAUTHORIZED, got ${res1.status}`);
  }
  console.log("✅ [PASS] Test 1: Unauthenticated request to /files returns 401 UNAUTHORIZED");

  // Test 2: Request with invalid/forged session token returns 401 UNAUTHORIZED
  const res2 = await fetch(`${BASE_URL}/api/v1/files`, {
    headers: { Authorization: "Bearer forged_session_token_xyz" },
  });
  const data2 = await res2.json();
  if (res2.status !== 401 || data2.error?.code !== "UNAUTHORIZED") {
    throw new Error(`Test 2 Failed: Expected 401 UNAUTHORIZED for invalid session, got ${res2.status}`);
  }
  console.log("✅ [PASS] Test 2: Forged/invalid session token returns 401 UNAUTHORIZED");

  // ---------------------------------------------------------------------------
  // SECTION 2: File Ownership & Access Control (A2, A5, A6, A7, A8)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 2: File Ownership & IDOR Protection ---");

  // Test 3: User A uploads a file
  const formA = new FormData();
  formA.append("file", new Blob([fs.readFileSync(samplePdfPath)], { type: "application/pdf" }), "user_a_file.pdf");
  const res3 = await fetch(`${BASE_URL}/api/v1/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
    body: formA,
  });
  const data3 = await res3.json();
  if (res3.status !== 201 || !data3.data?.file?.id) {
    throw new Error(`Test 3 Failed: Upload failed: ${JSON.stringify(data3)}`);
  }
  userAFileId = data3.data.file.id;
  console.log("✅ [PASS] Test 3: User A uploads own file successfully (201 Created)");

  // Test 4: User A reads own file -> 200 OK
  const res4 = await fetch(`${BASE_URL}/api/v1/files/${userAFileId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data4 = await res4.json();
  if (res4.status !== 200 || data4.data?.file?.id !== userAFileId) {
    throw new Error("Test 4 Failed: User A cannot read own file.");
  }
  console.log("✅ [PASS] Test 4: User A reads own file metadata (200 OK)");

  // Test 5: User B attempts to read User A's file -> 404 FILE_NOT_FOUND (IDOR prevented, no existence leakage)
  const res5 = await fetch(`${BASE_URL}/api/v1/files/${userAFileId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data5 = await res5.json();
  if (res5.status !== 404 || data5.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 5 Failed: Expected 404 FILE_NOT_FOUND, got ${res5.status} (${data5.error?.code})`);
  }
  console.log("✅ [PASS] Test 5: User B cannot read User A's file -> 404 Not Found (IDOR prevented, no existence leaked)");

  // Test 6: User A downloads own file -> 200 OK with valid PDF stream
  const res6 = await fetch(`${BASE_URL}/api/v1/files/${userAFileId}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const text6 = await res6.text();
  if (res6.status !== 200 || !text6.startsWith("%PDF")) {
    throw new Error("Test 6 Failed: User A could not download own file.");
  }
  console.log("✅ [PASS] Test 6: User A downloads own file stream (200 OK, %PDF- prefix)");

  // Test 7: User B attempts to download User A's file -> 404 FILE_NOT_FOUND
  const res7 = await fetch(`${BASE_URL}/api/v1/files/${userAFileId}/download`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data7 = await res7.json();
  if (res7.status !== 404 || data7.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 7 Failed: Expected 404 for User B download attempt, got ${res7.status}`);
  }
  console.log("✅ [PASS] Test 7: User B cannot download User A's file -> 404 Not Found");

  // Test 8: User B attempts to rename User A's file -> 404 FILE_NOT_FOUND
  const res8 = await fetch(`${BASE_URL}/api/v1/files/${userAFileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({ name: "Hacked Contract" }),
  });
  const data8 = await res8.json();
  if (res8.status !== 404 || data8.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 8 Failed: Expected 404 for User B rename attempt, got ${res8.status}`);
  }
  console.log("✅ [PASS] Test 8: User B cannot rename User A's file -> 404 Not Found");

  // Test 9: User B attempts to delete User A's file -> 404 FILE_NOT_FOUND
  const res9 = await fetch(`${BASE_URL}/api/v1/files/${userAFileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data9 = await res9.json();
  if (res9.status !== 404 || data9.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 9 Failed: Expected 404 for User B delete attempt, got ${res9.status}`);
  }
  console.log("✅ [PASS] Test 9: User B cannot delete User A's file -> 404 Not Found");

  // Verify file still exists after User B's failed deletion
  const res9Verify = await fetch(`${BASE_URL}/api/v1/files/${userAFileId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (res9Verify.status !== 200) {
    throw new Error("Test 9 Verification Failed: User A's file was affected by User B's delete attempt.");
  }
  console.log("✅ [PASS] Test 9b: User A's file remains intact and unmutated");

  // ---------------------------------------------------------------------------
  // SECTION 3: Document Ownership & Access Control (A3, A7, A8)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 3: Document Ownership & IDOR Protection ---");

  // Create test document for User A directly in DB
  const docAFile = path.join(process.cwd(), "uploads", `doc_a_${Date.now()}.pdf`);
  fs.writeFileSync(docAFile, "%PDF-1.4\n%DocA\n%%EOF\n");
  const docA = await prisma.document.create({
    data: {
      filename: path.basename(docAFile),
      originalName: "user_a_doc.pdf",
      size: 24,
      type: "UPLOAD",
      path: docAFile,
      userId: userA.id,
    },
  });
  userADocId = docA.id;

  // Test 10: User A reads own document -> 200 OK (sanitized DTO without path or userId)
  const res10 = await fetch(`${BASE_URL}/api/documents/${userADocId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data10 = await res10.json();
  if (res10.status !== 200 || data10.document?.id !== userADocId) {
    throw new Error(`Test 10 Failed: User A cannot read own document. Status: ${res10.status}`);
  }
  if (data10.document?.path) {
    throw new Error("Security Violation: document filesystem path leaked in GET /documents/:id");
  }
  if (data10.document?.userId) {
    throw new Error("Security Violation: internal userId leaked in GET /documents/:id");
  }
  console.log("✅ [PASS] Test 10: User A reads own document (200 OK, path & userId strictly scrubbed)");

  // Test 10b: POST /api/documents/upload sanitization check (no path or userId leakage)
  const docUploadForm = new FormData();
  docUploadForm.append("file", new Blob([fs.readFileSync(samplePdfPath)], { type: "application/pdf" }), "uploaded_via_api.pdf");
  const resUpload = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
    body: docUploadForm,
  });
  const dataUpload = await resUpload.json();
  if (resUpload.status !== 201 || !dataUpload.document?.id) {
    throw new Error(`Test 10b Failed: Document upload failed: ${JSON.stringify(dataUpload)}`);
  }
  if (dataUpload.document?.path) {
    throw new Error("Security Violation: document filesystem path leaked in POST /documents/upload");
  }
  if (dataUpload.document?.userId) {
    throw new Error("Security Violation: internal userId leaked in POST /documents/upload");
  }
  console.log("✅ [PASS] Test 10b: POST /documents/upload returns sanitized DTO (path & userId scrubbed)");

  // Test 10c: GET /api/documents listing sanitization check
  const resList = await fetch(`${BASE_URL}/api/documents`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataList = await resList.json();
  if (resList.status !== 200 || !Array.isArray(dataList.documents)) {
    throw new Error("Test 10c Failed: GET /documents listing failed");
  }
  for (const doc of dataList.documents) {
    if (doc.path) {
      throw new Error("Security Violation: document filesystem path leaked in GET /documents listing");
    }
    if (doc.userId) {
      throw new Error("Security Violation: internal userId leaked in GET /documents listing");
    }
  }
  console.log("✅ [PASS] Test 10c: GET /documents list returns sanitized DTOs (all path & userId scrubbed)");

  // Clean up the uploaded test document
  await prisma.document.delete({ where: { id: dataUpload.document.id } });

  // Test 11: User B attempts to read User A's document -> 404 Not Found
  const res11 = await fetch(`${BASE_URL}/api/documents/${userADocId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  if (res11.status !== 404) {
    throw new Error(`Test 11 Failed: Expected 404 for User B reading User A doc, got ${res11.status}`);
  }
  console.log("✅ [PASS] Test 11: User B cannot read User A's document -> 404 Not Found (IDOR prevented)");

  // Test 12: User B attempts to download User A's document -> 404 Not Found
  const res12 = await fetch(`${BASE_URL}/api/documents/download/${userADocId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  if (res12.status !== 404) {
    throw new Error(`Test 12 Failed: Expected 404 for User B downloading User A doc, got ${res12.status}`);
  }
  console.log("✅ [PASS] Test 12: User B cannot download User A's document -> 404 Not Found");

  // Test 13: User B attempts to delete User A's document -> 404 Not Found
  const res13 = await fetch(`${BASE_URL}/api/documents/${userADocId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  if (res13.status !== 404) {
    throw new Error(`Test 13 Failed: Expected 404 for User B deleting User A doc, got ${res13.status}`);
  }
  console.log("✅ [PASS] Test 13: User B cannot delete User A's document -> 404 Not Found");

  // Test 14: User A deletes own document -> 200 OK
  const res14 = await fetch(`${BASE_URL}/api/documents/${userADocId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (res14.status !== 200) {
    throw new Error(`Test 14 Failed: User A could not delete own document, got ${res14.status}`);
  }
  console.log("✅ [PASS] Test 14: User A deletes own document (200 OK)");

  // Verify document is gone
  const res14Verify = await fetch(`${BASE_URL}/api/documents/${userADocId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (res14Verify.status !== 404) {
    throw new Error("Test 14 Verification Failed: Document still exists after deletion.");
  }
  console.log("✅ [PASS] Test 14b: Deleted document is confirmed 404 for all callers");

  // ---------------------------------------------------------------------------
  // SECTION 4: Job Ownership & Access Control (A4, A7, A8)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Job Ownership & IDOR Protection ---");

  // Create a job for User A
  const res15 = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      tool: "compress-pdf",
      inputFileIds: [userAFileId],
      options: { level: "recommended" },
    }),
  });
  const data15 = await res15.json();
  if (res15.status !== 201 || !data15.data?.job?.id) {
    throw new Error(`Test 15 Failed: Could not create Job for User A: ${JSON.stringify(data15)}`);
  }
  userAJobId = data15.data.job.id;
  console.log("✅ [PASS] Test 15: User A creates PDF job (201 Created)");

  // Test 16: User A reads own job -> 200 OK
  const res16 = await fetch(`${BASE_URL}/api/v1/jobs/${userAJobId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data16 = await res16.json();
  if (res16.status !== 200 || data16.data?.job?.id !== userAJobId) {
    throw new Error("Test 16 Failed: User A could not read own job.");
  }
  console.log("✅ [PASS] Test 16: User A reads own job (200 OK)");

  // Test 17: User B attempts to read User A's job -> 404 JOB_NOT_FOUND (no existence leakage)
  const res17 = await fetch(`${BASE_URL}/api/v1/jobs/${userAJobId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data17 = await res17.json();
  if (res17.status !== 404 || data17.error?.code !== "JOB_NOT_FOUND") {
    throw new Error(`Test 17 Failed: Expected 404 JOB_NOT_FOUND for User B job access, got ${res17.status} (${data17.error?.code})`);
  }
  console.log("✅ [PASS] Test 17: User B cannot read User A's job -> 404 Not Found (IDOR prevented)");

  // Test 18: User B attempts to cancel User A's job -> 404 JOB_NOT_FOUND
  const res18 = await fetch(`${BASE_URL}/api/v1/jobs/${userAJobId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data18 = await res18.json();
  if (res18.status !== 404 || data18.error?.code !== "JOB_NOT_FOUND") {
    throw new Error(`Test 18 Failed: Expected 404 JOB_NOT_FOUND for User B cancel attempt, got ${res18.status}`);
  }
  console.log("✅ [PASS] Test 18: User B cannot cancel User A's job -> 404 Not Found");

  // Test 19: User B attempts to delete User A's job -> 404 JOB_NOT_FOUND
  const res19 = await fetch(`${BASE_URL}/api/v1/jobs/${userAJobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data19 = await res19.json();
  if (res19.status !== 404 || data19.error?.code !== "JOB_NOT_FOUND") {
    throw new Error(`Test 19 Failed: Expected 404 JOB_NOT_FOUND for User B delete attempt, got ${res19.status}`);
  }
  console.log("✅ [PASS] Test 19: User B cannot delete User A's job -> 404 Not Found");

  // Test 20: User B attempts to create a job using User A's input file -> 400 INVALID_INPUT_FILE
  const res20 = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({
      tool: "compress-pdf",
      inputFileIds: [userAFileId],
      options: { level: "recommended" },
    }),
  });
  const data20 = await res20.json();
  if (res20.status !== 400 || data20.error?.code !== "INVALID_INPUT_FILE") {
    throw new Error(`Test 20 Failed: Expected 400 INVALID_INPUT_FILE, got ${res20.status} (${data20.error?.code})`);
  }
  console.log("✅ [PASS] Test 20: User B cannot steal User A's input file in a job request (400 INVALID_INPUT_FILE)");

  // Wait for User A's job to complete so output file is generated
  let completedJob: any = null;
  for (let i = 0; i < 20; i++) {
    const checkRes = await fetch(`${BASE_URL}/api/v1/jobs/${userAJobId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const checkData = await checkRes.json();
    if (checkData.data?.job?.status === "COMPLETED") {
      completedJob = checkData.data.job;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!completedJob || !completedJob.outputFileId) {
    throw new Error(`Job failed to produce outputFileId: ${JSON.stringify(completedJob)}`);
  }

  userAJobOutputFileId = completedJob.outputFileId;

  // Test 21: User B attempts to download User A's job output file -> 404 FILE_NOT_FOUND
  const res21 = await fetch(`${BASE_URL}/api/v1/files/${userAJobOutputFileId}/download`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data21 = await res21.json();
  if (res21.status !== 404 || data21.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 21 Failed: Expected 404 for User B job output download, got ${res21.status}`);
  }
  console.log("✅ [PASS] Test 21: User B cannot download User A's job output file -> 404 Not Found");

  // Test 22: User A can download own job output file -> 200 OK
  const res22 = await fetch(`${BASE_URL}/api/v1/files/${userAJobOutputFileId}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const text22 = await res22.text();
  if (res22.status !== 200 || !text22.startsWith("%PDF")) {
    throw new Error("Test 22 Failed: User A could not download own job output.");
  }
  console.log("✅ [PASS] Test 22: User A downloads own job output file (200 OK)");

  // ---------------------------------------------------------------------------
  // SECTION 5: Physical Storage & Path Traversal Security (A9)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 5: Physical Storage & Path Traversal Protection ---");

  // Test 23: Direct DB injection of relative path traversal into File.storageKey -> rejected on download
  const maliciousFile1 = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "malicious_traversal.pdf",
      storageKey: "../../etc/passwd",
      mimeType: "application/pdf",
      size: 100,
      status: "READY",
    },
  });

  const res23 = await fetch(`${BASE_URL}/api/v1/files/${maliciousFile1.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (res23.status !== 404) {
    throw new Error(`Test 23 Failed: Expected 404 for path traversal attempt, got ${res23.status}`);
  }
  console.log("✅ [PASS] Test 23: Storage path traversal attempt (../../) is strictly rejected (404)");

  // Test 24: Direct DB injection of absolute external path into File.storageKey -> rejected on download
  const maliciousFile2 = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "malicious_absolute.pdf",
      storageKey: "/etc/passwd",
      mimeType: "application/pdf",
      size: 100,
      status: "READY",
    },
  });

  const res24 = await fetch(`${BASE_URL}/api/v1/files/${maliciousFile2.id}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (res24.status !== 404) {
    throw new Error(`Test 24 Failed: Expected 404 for absolute path attempt, got ${res24.status}`);
  }
  console.log("✅ [PASS] Test 24: Absolute external path (/etc/passwd) is strictly rejected (404)");

  // Test 25: Document path traversal attempt -> rejected on download
  const maliciousDoc = await prisma.document.create({
    data: {
      filename: "traversal.pdf",
      originalName: "traversal.pdf",
      size: 50,
      type: "UPLOAD",
      path: "../../../etc/passwd",
      userId: userA.id,
    },
  });

  const res25 = await fetch(`${BASE_URL}/api/documents/download/${maliciousDoc.id}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (res25.status !== 404) {
    throw new Error(`Test 25 Failed: Expected 404 for document path traversal, got ${res25.status}`);
  }
  console.log("✅ [PASS] Test 25: Document path traversal (../../../etc/passwd) is strictly rejected (404)");

  // ---------------------------------------------------------------------------
  // SECTION 6: File Deletion Security & Physical Cleanup (A6)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 6: File Deletion Security & Cleanup ---");

  // Test 26: User A deletes own file -> 200 OK and physical file unlinked
  const res26 = await fetch(`${BASE_URL}/api/v1/files/${userAFileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (res26.status !== 200) {
    throw new Error(`Test 26 Failed: User A could not delete own file, got ${res26.status}`);
  }
  console.log("✅ [PASS] Test 26: User A deletes own file successfully (200 OK)");

  // Test 27: Verify deleted file is 404 for both User A and User B
  const res27A = await fetch(`${BASE_URL}/api/v1/files/${userAFileId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const res27B = await fetch(`${BASE_URL}/api/v1/files/${userAFileId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  if (res27A.status !== 404 || res27B.status !== 404) {
    throw new Error("Test 27 Failed: Deleted file still accessible.");
  }
  console.log("✅ [PASS] Test 27: Deleted file is confirmed non-accessible (404) for all users");

  // Cleanup test DB records
  await prisma.file.deleteMany({
    where: { id: { in: [maliciousFile1.id, maliciousFile2.id, userAJobOutputFileId].filter(Boolean) } },
  });
  await prisma.document.deleteMany({
    where: { id: maliciousDoc.id },
  });

  console.log("\n===============================================================");
  console.log("🎉 ALL 27 FILE OWNERSHIP & ACCESS CONTROL TESTS PASSED! (100%)");
  console.log("===============================================================");
}

runTests()
  .then(async () => {
    global.fetch = rawFetch;
    if (serverInstance) {
      serverInstance.close();
    }
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    global.fetch = rawFetch;
    console.error("❌ Phase 2.6A Test Suite Failed:", err);
    if (serverInstance) {
      serverInstance.close();
    }
    await prisma.$disconnect();
    process.exit(1);
  });
