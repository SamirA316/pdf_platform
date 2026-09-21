process.env.NODE_ENV = "test";
import fs from "fs";
import path from "path";
import http from "http";
import jwt from "jsonwebtoken";
import { PDFDocument, rgb, StandardFonts } from "@cantoo/pdf-lib";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-replace-in-production";

const userA = { id: "user_a_repair_phase4", name: "User A (Repair)", email: "user_a_repair@test.local" };
const userB = { id: "user_b_repair_phase4", name: "User B (Repair)", email: "user_b_repair@test.local" };

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

async function generateValidPdf(pageCount: number, label: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
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
  console.log("=== PHASE 4.10 REPAIR PDF TEST SUITE ===");
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

  // Pre-generate standard valid 2-page PDF
  const valid2pBytes = await generateValidPdf(2, "RepairTestDoc");
  const fileA_valid = await uploadPdfBuffer(tokenA, valid2pBytes, "valid_document.pdf");
  const fileB_valid = await uploadPdfBuffer(tokenB, valid2pBytes, "user_b_valid.pdf");

  // Generate a mildly corrupted PDF: shifted header (junk prepended)
  const shiftedBytes = Buffer.concat([
    Buffer.from("JUNK_NETWORK_HEADERS\r\nServer: BadProxy\r\n\r\n"),
    valid2pBytes,
  ]);
  const fileA_shifted = await uploadPdfBuffer(tokenA, shiftedBytes, "shifted_headers.pdf");

  // Generate a mildly corrupted PDF: truncated %%EOF trailer
  const truncatedBytes = Buffer.concat([
    valid2pBytes.subarray(0, valid2pBytes.length - 8),
    Buffer.from("TRUNCATED"),
  ]);
  const fileA_truncated = await uploadPdfBuffer(tokenA, truncatedBytes, "corrupted_trailer.pdf");

  // Generate an unrepairable garbage file
  const garbageBytes = Buffer.from(
    "%PDF-1.4\n1 0 obj\nTHIS_IS_TOTALLY_CORRUPTED_BINARY_RUBBISH_NOT_A_VALID_OBJECT\nendobj\n"
  );
  const fileA_unrepairable = await uploadPdfBuffer(tokenA, garbageBytes, "unrepairable.pdf");

  // TEST 1: Reject empty inputFileIds
  await test("Test 1: Reject repair request with empty inputFileIds", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "repair-pdf",
        inputFileIds: [],
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 2: Reject multiple input files (>1)
  await test("Test 2: Reject repair request with multiple input files", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "repair-pdf",
        inputFileIds: [fileA_valid, fileA_valid],
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 3: Reject file owned by another user (ownership validation)
  await test("Test 3: Reject repair request for file owned by User B", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "repair-pdf",
        inputFileIds: [fileB_valid],
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 4: Repair valid PDF (ensures clean pass-through and re-serialization)
  await test("Test 4: Repair a valid PDF cleanly", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "repair-pdf",
        inputFileIds: [fileA_valid],
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
      throw new Error("Missing outputFileId in completed repair job");
    }
  });

  // TEST 5: Repair mildly corrupted PDF: shifted header
  await test("Test 5: Repair mildly corrupted PDF with prepended junk headers", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "repair-pdf",
        inputFileIds: [fileA_shifted],
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

    // Verify output file exists and has 2 readable pages
    const dbFile = await prisma.file.findUnique({ where: { id: job.outputFileId } });
    if (!dbFile) throw new Error("Repaired file record not found");

    const physicalPath = path.resolve(process.cwd(), "uploads", dbFile.storageKey);
    const bytes = await fs.promises.readFile(physicalPath);
    const doc = await PDFDocument.load(bytes);
    if (doc.getPageCount() !== 2) {
      throw new Error(`Expected 2 pages in repaired PDF, got ${doc.getPageCount()}`);
    }
  });

  // TEST 6: Repair mildly corrupted PDF: broken trailer
  await test("Test 6: Repair mildly corrupted PDF with broken trailer EOF", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "repair-pdf",
        inputFileIds: [fileA_truncated],
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
  });

  // TEST 7: Unrepairable corrupted PDF returns PDF_REPAIR_FAILED without fake success
  await test("Test 7: Unrepairable corrupted PDF strictly fails with error (no fake success)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "repair-pdf",
        inputFileIds: [fileA_unrepairable],
      }),
    });
    const body = await res.json();
    if (res.status !== 201 || !body.data?.job?.id) {
      throw new Error(`Expected 201 job created, got ${res.status}: ${JSON.stringify(body)}`);
    }

    const job = await pollJobUntilDone(tokenA, body.data.job.id);
    if (job.status !== "FAILED") {
      throw new Error(`Expected job to fail on unrepairable PDF, but status was ${job.status}`);
    }
    if (!job.errorMessage?.toLowerCase().includes("couldn't repair")) {
      throw new Error(`Expected error message to mention couldn't repair, got: ${job.errorMessage}`);
    }
    if (job.outputFileId) {
      throw new Error(`Fake success detected: outputFileId was generated for unrepairable PDF!`);
    }
  });

  // TEST 8: Atomic Cancellation and Cleanup
  await test("Test 8: Cancel repair job cleans up output file and prevents orphaned data", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "repair-pdf",
        inputFileIds: [fileA_valid],
      }),
    });
    const body = await res.json();
    const jobId = body.data?.job?.id;
    if (!jobId) throw new Error("Could not create job for cancellation test");

    const cancelRes = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const cancelBody = await cancelRes.json();
    if (cancelRes.status !== 200) {
      throw new Error(`Cancel request failed: ${JSON.stringify(cancelBody)}`);
    }

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
