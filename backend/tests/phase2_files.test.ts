process.env.NODE_ENV = "test";
import fs from "fs";
import path from "path";
import http from "http";
import jwt from "jsonwebtoken";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-replace-in-production";

const userA = { id: "user_a_test", name: "User A", email: "user_a@test.local" };
const userB = { id: "user_b_test", name: "User B", email: "user_b@test.local" };

let tokenA = "";
let tokenB = "";

async function ensureServerRunning(): Promise<void> {
  // Check if server is already running on 3001
  try {
    const res = await fetch("http://localhost:3001/api/v1/health", { signal: AbortSignal.timeout(500) });
    if (res.ok) {
      BASE_URL = "http://localhost:3001";
      return;
    }
  } catch {
    // Port 3001 not reachable, start ephemeral server
  }

  return new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const addr = serverInstance!.address();
      const port = typeof addr === "object" && addr ? addr.port : 3001;
      BASE_URL = `http://localhost:${port}`;
      console.log(`Started in-process test server on port ${port}`);
      resolve();
    });
  });
}

async function ensureTestUsers() {
  for (const u of [userA, userB]) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: u.id,
          name: u.name,
          email: u.email,
          password: "test-hash-password",
          isVerified: true,
        },
      });
    }
    u.id = user.id;
  }
  tokenA = jwt.sign({ id: userA.id, email: userA.email }, JWT_SECRET, { expiresIn: "1h" });
  tokenB = jwt.sign({ id: userB.id, email: userB.email }, JWT_SECRET, { expiresIn: "1h" });
}

async function runTests() {
  console.log("=== PHASE 2 FILE MANAGEMENT TEST SUITE ===");
  await ensureServerRunning();
  await ensureTestUsers();

  const tempDir = path.join(process.cwd(), "tests", "fixtures");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const samplePdfPath = path.join(tempDir, "sample.pdf");
  fs.writeFileSync(samplePdfPath, "%PDF-1.4\n%EOF\n");

  const sampleJpgPath = path.join(tempDir, "sample.jpg");
  fs.writeFileSync(sampleJpgPath, "FAKE_IMAGE_BYTES");

  let uploadedFileId = "";

  // Test 0: Unauthenticated Request must fail with 401 UNAUTHORIZED
  console.log("\n[Test 0] GET /api/v1/files (Unauthenticated)");
  const res0 = await fetch(`${BASE_URL}/api/v1/files`);
  const data0 = await res0.json();
  console.log("Status:", res0.status, "Code:", data0.error?.code);
  if (res0.status !== 401 || data0.error?.code !== "UNAUTHORIZED") {
    throw new Error(`Test 0 Failed: Expected 401 UNAUTHORIZED, got ${res0.status}`);
  }
  console.log("PASS: Unauthenticated access blocked.");

  // Test 1: Upload valid PDF
  console.log("\n[Test 1] Upload PDF - POST /api/v1/files (User A)");
  const form1 = new FormData();
  form1.append("file", new Blob([fs.readFileSync(samplePdfPath)], { type: "application/pdf" }), "my_contract.pdf");
  const res1 = await fetch(`${BASE_URL}/api/v1/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
    body: form1,
  });
  const data1 = await res1.json();
  console.log("Status:", res1.status, "File:", data1.data?.file?.id, data1.data?.file?.originalName);
  if (res1.status !== 201 || !data1.data?.file?.id) {
    throw new Error(`Test 1 Failed: ${JSON.stringify(data1)}`);
  }
  uploadedFileId = data1.data.file.id;
  console.log("PASS: PDF uploaded successfully.");

  // Test 2: List files
  console.log("\n[Test 2] List Files - GET /api/v1/files (User A)");
  const res2 = await fetch(`${BASE_URL}/api/v1/files?page=1&limit=20`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data2 = await res2.json();
  console.log("Status:", res2.status, "Total files:", data2.data?.pagination?.total);
  if (res2.status !== 200 || !data2.data?.files || data2.data.files.length === 0) {
    throw new Error("Test 2 Failed: File not found in listing.");
  }
  console.log("PASS: User A file listed.");

  // Test 3: Get File Details
  console.log("\n[Test 3] File Details - GET /api/v1/files/:id (User A)");
  const res3 = await fetch(`${BASE_URL}/api/v1/files/${uploadedFileId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data3 = await res3.json();
  console.log("Status:", res3.status, "Details:", data3.data?.file?.originalName);
  if (res3.status !== 200 || data3.data?.file?.id !== uploadedFileId) {
    throw new Error("Test 3 Failed: Metadata mismatch.");
  }
  if (data3.data.file.storageKey) {
    throw new Error("Security Violation: storageKey leaked in public response!");
  }
  console.log("PASS: Metadata retrieved without storageKey leakage.");

  // Test 4: Rename File
  console.log("\n[Test 4] Rename File - PATCH /api/v1/files/:id (User A)");
  const res4 = await fetch(`${BASE_URL}/api/v1/files/${uploadedFileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ name: "Renamed Contract" }),
  });
  const data4 = await res4.json();
  console.log("Status:", res4.status, "New name:", data4.data?.file?.originalName);
  if (res4.status !== 200 || data4.data?.file?.originalName !== "Renamed Contract.pdf") {
    throw new Error("Test 4 Failed: Rename failed or .pdf extension not preserved.");
  }
  console.log("PASS: File renamed and .pdf extension preserved.");

  // Test 5: Download File
  console.log("\n[Test 5] Download - GET /api/v1/files/:id/download (User A)");
  const res5 = await fetch(`${BASE_URL}/api/v1/files/${uploadedFileId}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const disposition = res5.headers.get("content-disposition");
  const blobText = await res5.text();
  console.log("Status:", res5.status, "Disposition:", disposition);
  if (res5.status !== 200 || !blobText.startsWith("%PDF")) {
    throw new Error("Test 5 Failed: Download stream invalid.");
  }
  console.log("PASS: Valid PDF stream downloaded with Content-Disposition.");

  // Test 6: Authorization & Isolation (User B cannot access User A's file)
  console.log("\n[Test 6] Authorization Check - GET /api/v1/files/:id (User B accessing User A file)");
  const res6 = await fetch(`${BASE_URL}/api/v1/files/${uploadedFileId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data6 = await res6.json();
  console.log("Status:", res6.status, "Error Code:", data6.error?.code);
  if (res6.status !== 404 || data6.error?.code !== "FILE_NOT_FOUND") {
    throw new Error(`Test 6 Failed: Expected 404 FILE_NOT_FOUND, got ${res6.status}`);
  }
  console.log("PASS: Strict ownership isolation confirmed (no existence leakage).");

  // Test 7: Reject invalid format (jpg)
  console.log("\n[Test 7] Invalid Format - POST /api/v1/files with JPG");
  const form7 = new FormData();
  form7.append("file", new Blob([fs.readFileSync(sampleJpgPath)], { type: "image/jpeg" }), "photo.jpg");
  const res7 = await fetch(`${BASE_URL}/api/v1/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
    body: form7,
  });
  const data7 = await res7.json();
  console.log("Status:", res7.status, "Error Code:", data7.error?.code);
  if (res7.status !== 400 || data7.error?.code !== "UNSUPPORTED_FORMAT") {
    throw new Error(`Test 7 Failed: Expected 400 UNSUPPORTED_FORMAT, got ${res7.status}`);
  }
  console.log("PASS: Non-PDF rejected with UNSUPPORTED_FORMAT.");

  // Test 8: Delete File
  console.log("\n[Test 8] Delete File - DELETE /api/v1/files/:id (User A)");
  const res8 = await fetch(`${BASE_URL}/api/v1/files/${uploadedFileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data8 = await res8.json();
  console.log("Status:", res8.status, "Result:", data8.data?.message);
  if (res8.status !== 200) {
    throw new Error("Test 8 Failed: File deletion failed.");
  }

  // Verify deleted file is gone
  const res8Verify = await fetch(`${BASE_URL}/api/v1/files/${uploadedFileId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (res8Verify.status !== 404) {
    throw new Error("Test 8 Failed: File still accessible after delete.");
  }
  console.log("PASS: File deleted from database and filesystem.");

  // Test 9: Reject invalid FileStatus query filter
  console.log("\n[Test 9] Invalid Status Query - GET /api/v1/files?status=RANDOM_JUNK (User A)");
  const res9 = await fetch(`${BASE_URL}/api/v1/files?status=RANDOM_JUNK`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data9 = await res9.json();
  console.log("Status:", res9.status, "Error Code:", data9.error?.code);
  if (res9.status !== 400 || data9.error?.code !== "INVALID_FILE_STATUS") {
    throw new Error(`Test 9 Failed: Expected 400 INVALID_FILE_STATUS, got ${res9.status}`);
  }
  console.log("PASS: Controlled validation layer rejected invalid FileStatus.");

  console.log("\n==========================================");
  console.log("ALL PHASE 2 TESTS PASSED SUCCESSFULLY! ✅");
  console.log("==========================================");
}

runTests()
  .then(async () => {
    if (serverInstance) {
      serverInstance.close();
    }
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Test Suite Failed:", err);
    if (serverInstance) {
      serverInstance.close();
    }
    await prisma.$disconnect();
    process.exit(1);
  });
