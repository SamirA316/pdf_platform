process.env.NODE_ENV = "test";
import fs from "fs";
import path from "path";
import http from "http";
import jwt from "jsonwebtoken";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-replace-in-production";

const userA = { id: "user_a_resize_phase4", name: "User A (Resize)", email: "user_a_resize@test.local" };
const userB = { id: "user_b_resize_phase4", name: "User B (Resize)", email: "user_b_resize@test.local" };

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
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([300, 300]);
    page.drawText(`${label} - Page ${i}`, {
      x: 30,
      y: 250,
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

async function runTests() {
  console.log("=== PHASE 4.5 RESIZE PDF TEST SUITE ===");
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

  // Generate sample 3-page PDF
  const pdf3pBuffer = await generateSamplePdf(3, "DocResize");
  const fileA_3p = await uploadPdfBuffer(tokenA, pdf3pBuffer, "sample_resize.pdf");
  const fileB_3p = await uploadPdfBuffer(tokenB, pdf3pBuffer, "user_b_resize.pdf");

  // TEST 1: Reject empty inputFileIds
  await test("Test 1: Reject request with empty inputFileIds", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [],
        options: { size: "a4" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 2: Reject multiple inputFileIds
  await test("Test 2: Reject request with multiple inputFileIds (>1)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p, fileA_3p],
        options: { size: "a4" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 3: Reject nonexistent file ID
  await test("Test 3: Reject request with nonexistent file ID", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: ["nonexistent-id-00000"],
        options: { size: "a4" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 4: Reject wrong owner file
  await test("Test 4: Reject processing file owned by another user", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileB_3p],
        options: { size: "a4" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 5: Reject invalid preset size
  await test("Test 5: Reject invalid page size preset", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: { size: "super-large-billboard" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_PAGE_SIZE") {
      throw new Error(`Expected 400 INVALID_PAGE_SIZE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 6: Reject invalid orientation
  await test("Test 6: Reject invalid orientation", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: { size: "a4", orientation: "diagonal-left" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_ORIENTATION") {
      throw new Error(`Expected 400 INVALID_ORIENTATION, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 7: Reject custom size missing width or height
  await test("Test 7: Reject custom size missing width or height", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: { size: "custom", width: 210 },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_DIMENSIONS") {
      throw new Error(`Expected 400 INVALID_DIMENSIONS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 8: Reject custom size with non-positive dimensions
  await test("Test 8: Reject custom size with zero or negative dimensions", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: { size: "custom", width: -50, height: 100 },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_DIMENSIONS") {
      throw new Error(`Expected 400 INVALID_DIMENSIONS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 9: Reject custom size with invalid unit
  await test("Test 9: Reject custom size with invalid unit", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: { size: "custom", width: 100, height: 200, unit: "kilometers" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_UNIT") {
      throw new Error(`Expected 400 INVALID_UNIT, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 10: Reject custom size oversized (> 5000 pt)
  await test("Test 10: Reject custom size exceeding maximum 5000 pt", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: { size: "custom", width: 3000, height: 3000, unit: "mm" }, // ~8500 pt
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "OVERSIZED_DIMENSIONS") {
      throw new Error(`Expected 400 OVERSIZED_DIMENSIONS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // Helper to poll job completion
  async function pollJob(jobId: string, token: string, maxWaitMs = 15000): Promise<any> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const res = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const status = data.data?.job?.status;
      if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
        return data.data.job;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Job ${jobId} timed out after ${maxWaitMs}ms`);
  }

  // TEST 11: Happy path: Resize to A4 (Portrait)
  await test("Test 11: Resize to A4 (Portrait) - check page dimensions", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: {
          size: "a4",
          orientation: "portrait",
        },
      }),
    });

    const createBody = await createRes.json();
    if (createRes.status !== 201 || !createBody.data?.job?.id) {
      throw new Error(`Failed to create resize job: ${JSON.stringify(createBody)}`);
    }

    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job ended with status ${completedJob.status}: ${completedJob.errorMessage}`);
    }

    if (!completedJob.outputFileId) {
      throw new Error("Expected completedJob.outputFileId to be populated");
    }

    // Download output PDF and inspect page dimensions
    const downloadRes = await fetch(`${BASE_URL}/api/v1/files/${completedJob.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    if (!downloadRes.ok) {
      throw new Error(`Failed to download output PDF: ${downloadRes.status}`);
    }

    const outputBytes = await downloadRes.arrayBuffer();
    const outDoc = await PDFDocument.load(outputBytes);
    if (outDoc.getPageCount() !== 3) {
      throw new Error(`Expected 3 pages, got ${outDoc.getPageCount()}`);
    }

    const p0 = outDoc.getPage(0);
    const w = p0.getWidth();
    const h = p0.getHeight();

    // A4 Portrait: 595.28 x 841.89 pt (tolerance ±1)
    if (Math.abs(w - 595.28) > 1 || Math.abs(h - 841.89) > 1) {
      throw new Error(`Expected A4 portrait dimensions ~595x842 pt, got ${w}x${h} pt`);
    }
  });

  // TEST 12: Happy path: Resize to A3 (Landscape)
  await test("Test 12: Resize to A3 (Landscape) - check width > height", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: {
          size: "a3",
          orientation: "landscape",
        },
      }),
    });

    const createBody = await createRes.json();
    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }

    const downloadRes = await fetch(`${BASE_URL}/api/v1/files/${completedJob.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const outputBytes = await downloadRes.arrayBuffer();
    const outDoc = await PDFDocument.load(outputBytes);
    const p0 = outDoc.getPage(0);
    const w = p0.getWidth();
    const h = p0.getHeight();

    // A3 Landscape: 1190.55 x 841.89 pt (tolerance ±1)
    if (Math.abs(w - 1190.55) > 1 || Math.abs(h - 841.89) > 1) {
      throw new Error(`Expected A3 landscape dimensions ~1191x842 pt, got ${w}x${h} pt`);
    }
  });

  // TEST 13: Happy path: Resize to Letter
  await test("Test 13: Resize to Letter (Portrait) - check 612x792 pt", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: {
          size: "letter",
          orientation: "portrait",
        },
      }),
    });

    const createBody = await createRes.json();
    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }

    const downloadRes = await fetch(`${BASE_URL}/api/v1/files/${completedJob.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const outputBytes = await downloadRes.arrayBuffer();
    const outDoc = await PDFDocument.load(outputBytes);
    const p0 = outDoc.getPage(0);
    const w = p0.getWidth();
    const h = p0.getHeight();

    if (Math.abs(w - 612) > 1 || Math.abs(h - 792) > 1) {
      throw new Error(`Expected Letter dimensions 612x792 pt, got ${w}x${h} pt`);
    }
  });

  // TEST 14: Happy path: Resize to Legal
  await test("Test 14: Resize to Legal (Portrait) - check 612x1008 pt", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: {
          size: "legal",
          orientation: "portrait",
        },
      }),
    });

    const createBody = await createRes.json();
    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }

    const downloadRes = await fetch(`${BASE_URL}/api/v1/files/${completedJob.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const outputBytes = await downloadRes.arrayBuffer();
    const outDoc = await PDFDocument.load(outputBytes);
    const p0 = outDoc.getPage(0);
    const w = p0.getWidth();
    const h = p0.getHeight();

    if (Math.abs(w - 612) > 1 || Math.abs(h - 1008) > 1) {
      throw new Error(`Expected Legal dimensions 612x1008 pt, got ${w}x${h} pt`);
    }
  });

  // TEST 15: Happy path: Custom size in mm (100mm x 150mm)
  await test("Test 15: Custom size in mm (100 x 150 mm) - check converted points", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: {
          size: "custom",
          width: 100,
          height: 150,
          unit: "mm",
          orientation: "portrait",
        },
      }),
    });

    const createBody = await createRes.json();
    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }

    const downloadRes = await fetch(`${BASE_URL}/api/v1/files/${completedJob.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const outputBytes = await downloadRes.arrayBuffer();
    const outDoc = await PDFDocument.load(outputBytes);
    const p0 = outDoc.getPage(0);
    const w = p0.getWidth();
    const h = p0.getHeight();

    // 100 mm = ~283.46 pt, 150 mm = ~425.20 pt
    const expectedW = 100 * (72 / 25.4);
    const expectedH = 150 * (72 / 25.4);

    if (Math.abs(w - expectedW) > 1 || Math.abs(h - expectedH) > 1) {
      throw new Error(`Expected ~${expectedW}x${expectedH} pt, got ${w}x${h} pt`);
    }
  });

  // TEST 16: Job cancellation during processing cleanup
  await test("Test 16: Job cancellation during processing triggers file cleanup", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "resize-pdf",
        inputFileIds: [fileA_3p],
        options: { size: "a4" },
      }),
    });

    const createBody = await createRes.json();
    const jobId = createBody.data.job.id;

    // Immediately cancel
    const cancelRes = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    if (cancelRes.ok) {
      await new Promise((r) => setTimeout(r, 1200));
      const getRes = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const getBody = await getRes.json();
      const status = getBody.data?.job?.status;
      if (status !== "CANCELLED") {
        throw new Error(`Expected CANCELLED, got ${status}`);
      }
      if (getBody.data?.job?.outputFileId) {
        throw new Error("Cancelled job must not retain an outputFileId");
      }
    }
  });

  console.log(`\nResults: ${passed}/${total} tests passed.`);
  if (serverInstance) {
    serverInstance.close();
  }
  process.exit(passed === total ? 0 : 1);
}

runTests().catch((err) => {
  console.error("Test runner encountered error:", err);
  if (serverInstance) {
    serverInstance.close();
  }
  process.exit(1);
});
