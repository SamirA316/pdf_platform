process.env.NODE_ENV = "test";
import fs from "fs";
import path from "path";
import http from "http";
import jwt from "jsonwebtoken";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-replace-in-production";

const userA = { id: "user_a_rotate_phase4", name: "User A (Rotate)", email: "user_a_rotate@test.local" };
const userB = { id: "user_b_rotate_phase4", name: "User B (Rotate)", email: "user_b_rotate@test.local" };

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

async function generateSamplePdf(pageCount: number, label: string, initialRotation: number = 0): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([400, 400]);
    if (initialRotation !== 0) {
      page.setRotation(degrees(initialRotation));
    }
    page.drawText(`${label} - Page ${i}`, {
      x: 50,
      y: 350,
      size: 18,
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
  console.log("=== PHASE 4.3 ROTATE PDF TEST SUITE ===");
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

  // Pre-generate sample test PDFs
  const pdf3pBuffer = await generateSamplePdf(3, "DocThree");
  const fileA_3p = await uploadPdfBuffer(tokenA, pdf3pBuffer, "three_pages.pdf");
  const fileB_3p = await uploadPdfBuffer(tokenB, pdf3pBuffer, "user_b_doc.pdf");

  // TEST 1: Rejection on missing input file
  await test("Test 1: Rotate rejection on missing input file (empty inputFileIds)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [],
        options: { rotation: 90 },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 2: Rejection on multiple input files
  await test("Test 2: Rotate rejection on multiple input files (>1 inputFileIds)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [fileA_3p, fileA_3p],
        options: { rotation: 90 },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 3: Rejection on non-existent input file ID
  await test("Test 3: Rotate rejection on non-existent input file ID", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: ["cm_missing_file_id_999"],
        options: { rotation: 90 },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 4: Rejection on unowned input file (User B's file requested by User A)
  await test("Test 4: Rotate rejection on unowned input file", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [fileB_3p],
        options: { rotation: 90 },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 5: Rejection on invalid rotation angle
  await test("Test 5: Rotate rejection on invalid angle (e.g. 45 degrees)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [fileA_3p],
        options: { rotation: 45 },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_ROTATION_ANGLE") {
      throw new Error(`Expected 400 INVALID_ROTATION_ANGLE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 6: Rejection on out-of-bounds page number in selective rotation
  await test("Test 6: Rotate rejection on out-of-bounds page number (e.g. page 10 on 3-page doc)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [fileA_3p],
        options: {
          rotations: [{ page: 10, rotation: 90 }],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "PAGE_OUT_OF_BOUNDS") {
      throw new Error(`Expected 400 PAGE_OUT_OF_BOUNDS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 7: Rejection on invalid page number (non-integer)
  await test("Test 7: Rotate rejection on non-integer page number", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [fileA_3p],
        options: {
          rotations: [{ page: "two", rotation: 90 }],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_PAGE") {
      throw new Error(`Expected 400 INVALID_PAGE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 8: Global 90° Clockwise rotation execution
  let rotated90FileId = "";
  await test("Test 8: Global 90° clockwise rotation execution & angle verification", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [fileA_3p],
        options: { rotation: 90 },
      }),
    });
    const body = await res.json();
    if (res.status !== 201 || !body.data?.job?.id) {
      throw new Error(`Job creation failed: ${JSON.stringify(body)}`);
    }

    const jobId = body.data.job.id;

    // Poll for completion
    let job: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const getRes = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const getBody = await getRes.json();
      job = getBody.data?.job;
      if (job?.status === "COMPLETED" || job?.status === "FAILED") break;
    }

    if (job?.status !== "COMPLETED") {
      throw new Error(`Expected COMPLETED, got ${job?.status}: ${job?.errorMessage}`);
    }

    if (!job.outputFileId) {
      throw new Error("Expected outputFileId to be populated.");
    }
    rotated90FileId = job.outputFileId;

    // Download and inspect angles using pdf-lib
    const dlRes = await fetch(`${BASE_URL}/api/v1/files/${job.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    if (dlRes.status !== 200) {
      throw new Error(`Download failed with status ${dlRes.status}`);
    }
    const pdfBytes = await dlRes.arrayBuffer();
    const parsedDoc = await PDFDocument.load(pdfBytes);

    if (parsedDoc.getPageCount() !== 3) {
      throw new Error(`Expected 3 pages, got ${parsedDoc.getPageCount()}`);
    }

    for (let i = 0; i < 3; i++) {
      const pageAngle = parsedDoc.getPage(i).getRotation().angle;
      if (pageAngle !== 90) {
        throw new Error(`Page ${i + 1} angle is ${pageAngle}°, expected 90°`);
      }
    }
  });

  // TEST 9: Global 180° Flip execution
  await test("Test 9: Global 180° flip execution & angle verification", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [fileA_3p],
        options: { rotation: 180 },
      }),
    });
    const body = await res.json();
    const jobId = body.data?.job?.id;

    let job: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const getRes = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const getBody = await getRes.json();
      job = getBody.data?.job;
      if (job?.status === "COMPLETED" || job?.status === "FAILED") break;
    }

    if (job?.status !== "COMPLETED") {
      throw new Error(`Expected COMPLETED, got ${job?.status}: ${job?.errorMessage}`);
    }

    const dlRes = await fetch(`${BASE_URL}/api/v1/files/${job.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pdfBytes = await dlRes.arrayBuffer();
    const parsedDoc = await PDFDocument.load(pdfBytes);

    for (let i = 0; i < 3; i++) {
      const pageAngle = parsedDoc.getPage(i).getRotation().angle;
      if (pageAngle !== 180) {
        throw new Error(`Page ${i + 1} angle is ${pageAngle}°, expected 180°`);
      }
    }
  });

  // TEST 10: Selective Per-Page rotation execution
  await test("Test 10: Selective per-page rotation (Page 1 -> 90°, Page 3 -> 270°, Page 2 unrotated)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [fileA_3p],
        options: {
          rotations: [
            { page: 1, rotation: 90 },
            { page: 3, rotation: 270 },
          ],
        },
      }),
    });
    const body = await res.json();
    const jobId = body.data?.job?.id;

    let job: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const getRes = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const getBody = await getRes.json();
      job = getBody.data?.job;
      if (job?.status === "COMPLETED" || job?.status === "FAILED") break;
    }

    if (job?.status !== "COMPLETED") {
      throw new Error(`Expected COMPLETED, got ${job?.status}: ${job?.errorMessage}`);
    }

    const dlRes = await fetch(`${BASE_URL}/api/v1/files/${job.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pdfBytes = await dlRes.arrayBuffer();
    const parsedDoc = await PDFDocument.load(pdfBytes);

    const angleP1 = parsedDoc.getPage(0).getRotation().angle;
    const angleP2 = parsedDoc.getPage(1).getRotation().angle;
    const angleP3 = parsedDoc.getPage(2).getRotation().angle;

    if (angleP1 !== 90 || angleP2 !== 0 || angleP3 !== 270) {
      throw new Error(`Angle mismatch: Page 1=${angleP1}°, Page 2=${angleP2}°, Page 3=${angleP3}°`);
    }
  });

  // TEST 11: Cumulative rotation (Rotating an already-rotated PDF by another 90°)
  await test("Test 11: Cumulative rotation on pre-rotated PDF (90° + 90° = 180°)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [rotated90FileId],
        options: { rotation: 90 },
      }),
    });
    const body = await res.json();
    const jobId = body.data?.job?.id;

    let job: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const getRes = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const getBody = await getRes.json();
      job = getBody.data?.job;
      if (job?.status === "COMPLETED" || job?.status === "FAILED") break;
    }

    if (job?.status !== "COMPLETED") {
      throw new Error(`Expected COMPLETED, got ${job?.status}: ${job?.errorMessage}`);
    }

    const dlRes = await fetch(`${BASE_URL}/api/v1/files/${job.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pdfBytes = await dlRes.arrayBuffer();
    const parsedDoc = await PDFDocument.load(pdfBytes);

    for (let i = 0; i < 3; i++) {
      const pageAngle = parsedDoc.getPage(i).getRotation().angle;
      if (pageAngle !== 180) {
        throw new Error(`Cumulative angle for page ${i + 1} is ${pageAngle}°, expected 180°`);
      }
    }
  });

  // TEST 12: Split output limit safeguard verification
  await test("Test 12: Safeguard rejection when split output count exceeds 100", async () => {
    // Attempt split with > 100 ranges
    const excessiveRanges: Array<{ start: number; end: number }> = [];
    for (let i = 1; i <= 101; i++) {
      excessiveRanges.push({ start: 1, end: 1 });
    }

    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_3p],
        options: {
          mode: "ranges",
          ranges: excessiveRanges,
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "MAX_OUTPUTS_EXCEEDED") {
      throw new Error(`Expected 400 MAX_OUTPUTS_EXCEEDED, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 13: Job cancellation cleans up output file
  await test("Test 13: Rotate job cancellation cleans up generated output file", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "rotate-pdf",
        inputFileIds: [fileA_3p],
        options: { rotation: 90 },
      }),
    });
    const body = await res.json();
    const jobId = body.data?.job?.id;

    // Immediately cancel
    const cancelRes = await fetch(`${BASE_URL}/api/v1/jobs/${jobId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const cancelBody = await cancelRes.json();

    if (cancelRes.status !== 200 || cancelBody.data?.job?.status !== "CANCELLED") {
      throw new Error(`Cancellation failed: ${JSON.stringify(cancelBody)}`);
    }

    // Wait for processor and atomic verification
    await new Promise((r) => setTimeout(r, 1000));

    const orphanedFiles = await prisma.file.findMany({
      where: { jobId },
    });

    if (orphanedFiles.length > 0) {
      throw new Error(`Found ${orphanedFiles.length} orphaned files after job cancellation`);
    }
  });

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===`);

  if (serverInstance) {
    serverInstance.close();
  }

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner crash:", err);
  if (serverInstance) (serverInstance as any).close();
  process.exit(1);
});
