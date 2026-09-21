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

const userA = { id: "user_a_pagenum_phase4", name: "User A (PageNum)", email: "user_a_pagenum@test.local" };
const userB = { id: "user_b_pagenum_phase4", name: "User B (PageNum)", email: "user_b_pagenum@test.local" };

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

async function runTests() {
  console.log("=== PHASE 4.7 PAGE NUMBERS TEST SUITE ===");
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

  // Pre-generate sample 4-page PDF
  const pdf4pBuffer = await generateSamplePdf(4, "DocNum");
  const fileA_4p = await uploadPdfBuffer(tokenA, pdf4pBuffer, "sample_doc.pdf");
  const fileB_4p = await uploadPdfBuffer(tokenB, pdf4pBuffer, "user_b_doc.pdf");

  // TEST 1: Reject empty inputFileIds
  await test("Test 1: Reject request with empty inputFileIds", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [],
        options: { position: "bottom-center" },
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
        tool: "page-numbers",
        inputFileIds: [fileA_4p, fileA_4p],
        options: { position: "bottom-center" },
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
        tool: "page-numbers",
        inputFileIds: ["nonexistent-id-00000"],
        options: { position: "bottom-center" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 4: Reject unowned file
  await test("Test 4: Reject processing file owned by another user", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileB_4p],
        options: { position: "bottom-center" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 5: Reject invalid position
  await test("Test 5: Reject invalid position (e.g. 'outside-screen')", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileA_4p],
        options: { position: "outside-screen" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_TOOL_OPTIONS") {
      throw new Error(`Expected 400 INVALID_TOOL_OPTIONS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 6: Reject invalid startNumber
  await test("Test 6: Reject invalid starting number (< 1 or non-integer)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileA_4p],
        options: { startNumber: 0 },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_START_NUMBER") {
      throw new Error(`Expected 400 INVALID_START_NUMBER, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 7: Reject invalid font size
  await test("Test 7: Reject invalid font size (< 6 or > 48)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileA_4p],
        options: { fontSize: 100 },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_TOOL_OPTIONS") {
      throw new Error(`Expected 400 INVALID_TOOL_OPTIONS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 8: Reject out-of-bounds page in pages array
  await test("Test 8: Reject out-of-bounds page number in pages array", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileA_4p],
        options: { pages: [1, 10] }, // Document only has 4 pages
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "PAGE_OUT_OF_BOUNDS") {
      throw new Error(`Expected 400 PAGE_OUT_OF_BOUNDS, got ${res.status}: ${JSON.stringify(body)}`);
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

  // TEST 9: Happy path: Basic numbering on all pages
  await test("Test 9: Basic numbering on all pages (default Page {n} / {total})", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileA_4p],
        options: {
          position: "bottom-center",
          startNumber: 1,
          format: "Page {n} / {total}",
        },
      }),
    });

    const createBody = await createRes.json();
    if (createRes.status !== 201 || !createBody.data?.job?.id) {
      throw new Error(`Failed to create page-numbers job: ${JSON.stringify(createBody)}`);
    }

    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job ended with status ${completedJob.status}: ${completedJob.errorMessage}`);
    }

    if (!completedJob.outputFileId) {
      throw new Error("Expected completedJob.outputFileId to be present");
    }

    const downloadRes = await fetch(`${BASE_URL}/api/v1/files/${completedJob.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    if (!downloadRes.ok) {
      throw new Error(`Failed to download numbered PDF: ${downloadRes.status}`);
    }

    const outputBytes = await downloadRes.arrayBuffer();
    const outDoc = await PDFDocument.load(outputBytes);
    if (outDoc.getPageCount() !== 4) {
      throw new Error(`Expected 4 pages, got ${outDoc.getPageCount()}`);
    }
  });

  // TEST 10: Happy path: Custom starting number (startNumber: 5)
  await test("Test 10: Custom starting number (startNumber: 5)", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileA_4p],
        options: {
          position: "bottom-center",
          startNumber: 5,
          format: "Page {n}",
        },
      }),
    });

    const createBody = await createRes.json();
    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }
  });

  // TEST 11: Happy path: Corner positions (top-left, bottom-right)
  await test("Test 11: Header numbering at top-left and top-right", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileA_4p],
        options: {
          position: "top-right",
          startNumber: 1,
          format: "{n} of {total}",
          fontSize: 10,
        },
      }),
    });

    const createBody = await createRes.json();
    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }
  });

  // TEST 12: Happy path: Custom format
  await test("Test 12: Custom template format (- {n} -)", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileA_4p],
        options: {
          position: "bottom-center",
          format: "- {n} -",
        },
      }),
    });

    const createBody = await createRes.json();
    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }
  });

  // TEST 13: Happy path: Selective page numbering (skip cover page 1)
  await test("Test 13: Selective page numbering on pages [2, 3, 4] (skip cover)", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileA_4p],
        options: {
          position: "bottom-right",
          startNumber: 1,
          pages: [2, 3, 4],
        },
      }),
    });

    const createBody = await createRes.json();
    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }
  });

  // TEST 14: Job cancellation during processing triggers file cleanup
  await test("Test 14: Job cancellation triggers cleanup of output file", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "page-numbers",
        inputFileIds: [fileA_4p],
        options: { position: "bottom-center" },
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
