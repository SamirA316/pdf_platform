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

const userA = { id: "user_a_watermark_phase4", name: "User A (Watermark)", email: "user_a_watermark@test.local" };
const userB = { id: "user_b_watermark_phase4", name: "User B (Watermark)", email: "user_b_watermark@test.local" };

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
    const page = doc.addPage([400, 400]);
    page.drawText(`${label} - Page ${i}`, {
      x: 40,
      y: 350,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });
  }
  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}

async function uploadFileBuffer(token: string, buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

  const endpoint = mimeType.startsWith("image/") ? `${BASE_URL}/api/v1/files?type=image` : `${BASE_URL}/api/v1/files`;
  const res = await fetch(endpoint, {
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

// 1x1 Red PNG Buffer
const SAMPLE_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function runTests() {
  console.log("=== PHASE 4.6 WATERMARK PDF TEST SUITE ===");
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

  // Pre-generate sample files
  const pdf3pBuffer = await generateSamplePdf(3, "DocWatermark");
  const fileA_3p = await uploadFileBuffer(tokenA, pdf3pBuffer, "watermark_sample.pdf", "application/pdf");
  const fileB_3p = await uploadFileBuffer(tokenB, pdf3pBuffer, "user_b_watermark.pdf", "application/pdf");

  // Watermark PNG images
  const imageA_png = await uploadFileBuffer(tokenA, SAMPLE_PNG_BUFFER, "stamp.png", "image/png");
  const imageB_png = await uploadFileBuffer(tokenB, SAMPLE_PNG_BUFFER, "user_b_stamp.png", "image/png");

  // TEST 1: Reject empty inputFileIds
  await test("Test 1: Reject request with empty inputFileIds", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [],
        options: { text: "CONFIDENTIAL" },
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
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p, fileA_3p],
        options: { text: "CONFIDENTIAL" },
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
        tool: "watermark-pdf",
        inputFileIds: ["nonexistent-id-99999"],
        options: { text: "CONFIDENTIAL" },
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
        tool: "watermark-pdf",
        inputFileIds: [fileB_3p],
        options: { text: "CONFIDENTIAL" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 5: Reject empty watermark text
  await test("Test 5: Reject empty watermark text", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "text", text: "   " },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_WATERMARK_TEXT") {
      throw new Error(`Expected 400 INVALID_WATERMARK_TEXT, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 6: Reject oversized watermark text (> 200 chars)
  await test("Test 6: Reject oversized watermark text (> 200 chars)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "text", text: "A".repeat(250) },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_WATERMARK_TEXT") {
      throw new Error(`Expected 400 INVALID_WATERMARK_TEXT, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 7: Reject invalid watermark type
  await test("Test 7: Reject invalid watermark type (e.g. 'audio')", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "audio", text: "hello" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_TOOL_OPTIONS") {
      throw new Error(`Expected 400 INVALID_TOOL_OPTIONS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 8: Reject invalid position
  await test("Test 8: Reject invalid position (e.g. 'underwater')", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "text", text: "CONFIDENTIAL", position: "underwater" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_TOOL_OPTIONS") {
      throw new Error(`Expected 400 INVALID_TOOL_OPTIONS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 9: Reject invalid opacity
  await test("Test 9: Reject invalid opacity (> 1.0 or < 0.01)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "text", text: "CONFIDENTIAL", opacity: 2.5 },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_TOOL_OPTIONS") {
      throw new Error(`Expected 400 INVALID_TOOL_OPTIONS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 10: Reject image watermark missing imageFileId
  await test("Test 10: Reject image watermark without imageFileId", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "image" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_WATERMARK_IMAGE") {
      throw new Error(`Expected 400 INVALID_WATERMARK_IMAGE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 11: Reject image watermark with nonexistent imageFileId
  await test("Test 11: Reject image watermark with nonexistent imageFileId", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "image", imageFileId: "nonexistent-img-9999" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 12: Reject image watermark with unowned image file
  await test("Test 12: Reject image watermark with image owned by another user", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "image", imageFileId: imageB_png },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 13: Reject image watermark with non-image file MIME
  await test("Test 13: Reject image watermark where imageFileId is a PDF file", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "image", imageFileId: fileA_3p }, // fileA_3p is a PDF, not an image
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_MIME_TYPE") {
      throw new Error(`Expected 400 INVALID_MIME_TYPE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 14: Reject out-of-bounds page number in pages array
  await test("Test 14: Reject out-of-bounds page number in pages array", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "text", text: "CONFIDENTIAL", pages: [1, 99] },
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

  // TEST 15: Happy path: Text watermark on all pages
  await test("Test 15: Text watermark on all pages (CONFIDENTIAL, 45°, center)", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: {
          type: "text",
          text: "CONFIDENTIAL",
          fontSize: 36,
          opacity: 0.35,
          rotation: 45,
          position: "center",
          color: "#E5322D",
          pages: "all",
        },
      }),
    });

    const createBody = await createRes.json();
    if (createRes.status !== 201 || !createBody.data?.job?.id) {
      throw new Error(`Failed to create watermark job: ${JSON.stringify(createBody)}`);
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
      throw new Error(`Failed to download watermarked PDF: ${downloadRes.status}`);
    }

    const outputBytes = await downloadRes.arrayBuffer();
    const outDoc = await PDFDocument.load(outputBytes);
    if (outDoc.getPageCount() !== 3) {
      throw new Error(`Expected 3 pages, got ${outDoc.getPageCount()}`);
    }
  });

  // TEST 16: Happy path: Text watermark on selected pages ([1, 3])
  await test("Test 16: Text watermark on selected pages ([1, 3])", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: {
          type: "text",
          text: "DRAFT",
          fontSize: 28,
          pages: [1, 3],
        },
      }),
    });

    const createBody = await createRes.json();
    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }
  });

  // TEST 17: Happy path: Image watermark (PNG image stamp)
  await test("Test 17: Image watermark using uploaded PNG stamp", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: {
          type: "image",
          imageFileId: imageA_png,
          scale: 0.8,
          opacity: 0.5,
          position: "center",
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
    if (!downloadRes.ok) {
      throw new Error(`Failed to download image watermarked PDF: ${downloadRes.status}`);
    }

    const outDoc = await PDFDocument.load(await downloadRes.arrayBuffer());
    if (outDoc.getPageCount() !== 3) {
      throw new Error(`Expected 3 pages, got ${outDoc.getPageCount()}`);
    }
  });

  // TEST 18: Happy path: Corner positions (top-left, bottom-right)
  await test("Test 18: Text watermark with corner positions (top-left)", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: {
          type: "text",
          text: "APPROVED",
          position: "top-left",
          rotation: 0,
        },
      }),
    });

    const createBody = await createRes.json();
    const completedJob = await pollJob(createBody.data.job.id, tokenA);
    if (completedJob.status !== "COMPLETED") {
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }
  });

  // TEST 19: Cancellation during processing triggers cleanup
  await test("Test 19: Job cancellation triggers cleanup of output file", async () => {
    const createRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "watermark-pdf",
        inputFileIds: [fileA_3p],
        options: { type: "text", text: "CANCEL_TEST" },
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
