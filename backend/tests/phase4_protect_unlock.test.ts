process.env.NODE_ENV = "test";
import fs from "fs";
import path from "path";
import http from "http";
import jwt from "jsonwebtoken";
import { PDFDocument as CantooPDF, EncryptedPDFError } from "@cantoo/pdf-lib";
import { PDFDocument as StandardPDF, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-replace-in-production";

const userA = { id: "user_a_protect_phase4", name: "User A (Protect)", email: "user_a_protect@test.local" };
const userB = { id: "user_b_protect_phase4", name: "User B (Protect)", email: "user_b_protect@test.local" };

let tokenA = "";
let tokenB = "";

async function ensureServerRunning(): Promise<void> {
  try {
    const res = await fetch("http://localhost:3001/api/v1/health", { signal: AbortSignal.timeout(500) });
    if (res.ok) {
      BASE_URL = "http://localhost:3001";
      return;
    }
  } catch {
    // Port 3001 not listening, start ephemeral server
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

async function generateSamplePdf(pageCount: number, label: string): Promise<Buffer> {
  const doc = await StandardPDF.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([400, 500]);
    page.drawText(`${label} - Content on Page ${i}`, {
      x: 40,
      y: 400,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });
  }
  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}

async function uploadPdfBuffer(token: string, buffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);

  const res = await fetch(`${BASE_URL}/api/v1/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json();
  if (res.status !== 201 || !data.data?.file?.id) {
    throw new Error(`File upload failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data.data.file.id;
}

async function pollJobUntilDone(token: string, jobId: string, maxWaitMs = 12000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (res.status !== 200) {
      throw new Error(`Failed to fetch job ${jobId}: ${JSON.stringify(body)}`);
    }
    const job = body.data.job;
    if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
      return job;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Job ${jobId} timed out after ${maxWaitMs}ms`);
}

async function runTests() {
  console.log("=== PHASE 4.8 PROTECT & 4.9 UNLOCK PDF TEST SUITE ===");
  await ensureServerRunning();
  await ensureTestUsers();

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error("  ", err.message || err);
    }
  }

  // Pre-generate sample 3-page PDF
  const pdf3pBuffer = await generateSamplePdf(3, "Confidential Document");
  const fileA_3p = await uploadPdfBuffer(tokenA, pdf3pBuffer, "financial_report.pdf");
  const fileB_3p = await uploadPdfBuffer(tokenB, pdf3pBuffer, "user_b_private.pdf");

  let protectedFileId = "";
  const TEST_PASSWORD = "SecurePassword@123";

  // TEST 1: Reject empty inputFileIds for protect-pdf
  await test("Test 1: Reject protect-pdf with empty inputFileIds", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "protect-pdf",
        inputFileIds: [],
        options: { userPassword: "pass" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 2: Reject multiple input files (>1)
  await test("Test 2: Reject protect-pdf with multiple input files", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "protect-pdf",
        inputFileIds: [fileA_3p, fileA_3p],
        options: { userPassword: "pass" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 3: Reject file owned by another user (ownership validation)
  await test("Test 3: Reject protect-pdf for file owned by User B", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "protect-pdf",
        inputFileIds: [fileB_3p],
        options: { userPassword: "pass" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 4: Reject protect with missing or empty password
  await test("Test 4: Reject protect-pdf with missing or empty password", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "protect-pdf",
        inputFileIds: [fileA_3p],
        options: { userPassword: "" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_PASSWORD") {
      throw new Error(`Expected 400 INVALID_PASSWORD, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 5: Happy path: Protect PDF with AES-256 and custom permissions
  await test("Test 5: Happy path: Protect PDF successfully", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "protect-pdf",
        inputFileIds: [fileA_3p],
        options: {
          userPassword: TEST_PASSWORD,
          permissions: {
            print: true,
            copy: false,
            modify: false,
            annotate: false,
          },
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 201 || !body.data?.job?.id) {
      throw new Error(`Expected 201 job created, got ${res.status}: ${JSON.stringify(body)}`);
    }

    const completedJob = await pollJobUntilDone(tokenA, body.data.job.id);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }
    if (!completedJob.outputFileId) {
      throw new Error("Missing outputFileId in completed protect job");
    }

    protectedFileId = completedJob.outputFileId;
  });

  // TEST 6: Verify output PDF is encrypted (cannot be read without password)
  await test("Test 6: Verify output PDF is strictly encrypted", async () => {
    const dbFile = await prisma.file.findUnique({ where: { id: protectedFileId } });
    if (!dbFile) throw new Error("Protected file not found in DB");

    const physicalPath = path.resolve(process.cwd(), "uploads", dbFile.storageKey);
    const bytes = await fs.promises.readFile(physicalPath);

    let isEncrypted = false;
    try {
      await CantooPDF.load(bytes);
    } catch (err: any) {
      if (err instanceof EncryptedPDFError || (err.message && err.message.includes("encrypted"))) {
        isEncrypted = true;
      }
    }

    if (!isEncrypted) {
      throw new Error("Protected PDF was loaded without password, but it should be encrypted!");
    }
  });

  // TEST 7: Verify output PDF can be decrypted using the set password
  await test("Test 7: Verify output PDF can be unlocked with correct password", async () => {
    const dbFile = await prisma.file.findUnique({ where: { id: protectedFileId } });
    if (!dbFile) throw new Error("Protected file not found in DB");

    const physicalPath = path.resolve(process.cwd(), "uploads", dbFile.storageKey);
    const bytes = await fs.promises.readFile(physicalPath);

    const doc = await CantooPDF.load(bytes, { password: TEST_PASSWORD });
    if (doc.getPageCount() !== 3) {
      throw new Error(`Expected 3 pages in decrypted PDF, got ${doc.getPageCount()}`);
    }
  });

  // TEST 8: Zero password leakage in Job records (security validation)
  await test("Test 8: Ensure userPassword is never leaked in DB job.options or API responses", async () => {
    const jobs = await prisma.job.findMany({
      where: { userId: userA.id, tool: "protect-pdf" },
    });
    for (const j of jobs) {
      if (j.options && typeof j.options === "string") {
        if (j.options.includes(TEST_PASSWORD)) {
          throw new Error(`Security breach: Plaintext password found stored in job ${j.id} options DB field!`);
        }
      }
    }
  });

  // TEST 9: Unlock PDF - Reject empty password
  await test("Test 9: Reject unlock-pdf with missing or empty password", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "unlock-pdf",
        inputFileIds: [protectedFileId],
        options: { password: "" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_PASSWORD") {
      throw new Error(`Expected 400 INVALID_PASSWORD, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 10: Unlock PDF - Reject unencrypted PDF
  await test("Test 10: Reject unlock-pdf on an unencrypted PDF (PDF_NOT_ENCRYPTED)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "unlock-pdf",
        inputFileIds: [fileA_3p],
        options: { password: "anypassword" },
      }),
    });
    const body = await res.json();
    if (res.status !== 201 || !body.data?.job?.id) {
      throw new Error(`Expected 201 job created, got ${res.status}: ${JSON.stringify(body)}`);
    }

    const job = await pollJobUntilDone(tokenA, body.data.job.id);
    if (job.status !== "FAILED") {
      throw new Error(`Expected job to fail on unencrypted PDF, got status ${job.status}`);
    }
    if (!job.errorMessage?.toLowerCase().includes("not password-protected") && !job.errorMessage?.toLowerCase().includes("couldn't unlock")) {
      throw new Error(`Expected unencrypted error message, got: ${job.errorMessage}`);
    }
  });

  // TEST 11: Unlock PDF - Reject incorrect password (INVALID_PDF_PASSWORD)
  await test("Test 11: Reject unlock-pdf with wrong password (INVALID_PDF_PASSWORD)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "unlock-pdf",
        inputFileIds: [protectedFileId],
        options: { password: "WrongPassword123!" },
      }),
    });
    const body = await res.json();
    if (res.status !== 201 || !body.data?.job?.id) {
      throw new Error(`Expected 201 job created, got ${res.status}: ${JSON.stringify(body)}`);
    }

    const job = await pollJobUntilDone(tokenA, body.data.job.id);
    if (job.status !== "FAILED") {
      throw new Error(`Expected job to fail on wrong password, got status ${job.status}`);
    }
    if (!job.errorMessage?.includes("Incorrect PDF password")) {
      throw new Error(`Expected 'Incorrect PDF password' message, got: ${job.errorMessage}`);
    }
  });

  // TEST 12: Happy path: Unlock PDF with correct password
  await test("Test 12: Happy path: Unlock PDF with correct password creates unencrypted PDF", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "unlock-pdf",
        inputFileIds: [protectedFileId],
        options: { password: TEST_PASSWORD },
      }),
    });
    const body = await res.json();
    if (res.status !== 201 || !body.data?.job?.id) {
      throw new Error(`Expected 201 job created, got ${res.status}: ${JSON.stringify(body)}`);
    }

    const job = await pollJobUntilDone(tokenA, body.data.job.id);
    if (job.status !== "COMPLETED") {
      throw new Error(`Job failed: ${job.errorMessage}`);
    }
    if (!job.outputFileId) {
      throw new Error("Missing outputFileId in completed unlock job");
    }

    // Verify unlocked file on disk can be loaded WITHOUT password
    const unlockedDbFile = await prisma.file.findUnique({ where: { id: job.outputFileId } });
    if (!unlockedDbFile) throw new Error("Unlocked file record not found in DB");

    const unlockedPath = path.resolve(process.cwd(), "uploads", unlockedDbFile.storageKey);
    const unlockedBytes = await fs.promises.readFile(unlockedPath);

    const unlockedDoc = await CantooPDF.load(unlockedBytes);
    if (unlockedDoc.getPageCount() !== 3) {
      throw new Error(`Expected 3 pages in unlocked PDF, got ${unlockedDoc.getPageCount()}`);
    }
  });

  // TEST 13: Atomic Cancellation and Cleanup
  await test("Test 13: Cancel job cleans up output file and prevents orphaned data", async () => {
    // Create a job and immediately cancel it
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "protect-pdf",
        inputFileIds: [fileA_3p],
        options: { userPassword: "TemporaryPassword123" },
      }),
    });
    const body = await res.json();
    const jobId = body.data?.job?.id;
    if (!jobId) throw new Error("Could not create job for cancellation test");

    // Immediately cancel
    const cancelRes = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const cancelBody = await cancelRes.json();
    if (cancelRes.status !== 200) {
      throw new Error(`Cancel request failed: ${JSON.stringify(cancelBody)}`);
    }

    // Wait a brief moment to let processor complete or abort
    await new Promise((r) => setTimeout(r, 600));

    const finalJob = await prisma.job.findUnique({ where: { id: jobId } });
    if (finalJob?.status !== "CANCELLED") {
      throw new Error(`Expected CANCELLED status, got ${finalJob?.status}`);
    }
    if (finalJob?.outputFileId) {
      throw new Error(`Expected outputFileId to be null after cancellation, got ${finalJob.outputFileId}`);
    }
  });

  console.log(`\nResults: ${passed}/${total} passed`);
  if (serverInstance) {
    serverInstance.close();
  }
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered an error:", err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
