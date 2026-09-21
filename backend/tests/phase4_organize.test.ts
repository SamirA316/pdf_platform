process.env.NODE_ENV = "test";
import fs from "fs";
import path from "path";
import http from "http";
import zlib from "zlib";
import jwt from "jsonwebtoken";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-replace-in-production";

const userA = { id: "user_a_organize_phase4", name: "User A (Organize)", email: "user_a_organize@test.local" };
const userB = { id: "user_b_organize_phase4", name: "User B (Organize)", email: "user_b_organize@test.local" };

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

function extractPageText(doc: PDFDocument, pageIndex: number): string {
  const page = doc.getPage(pageIndex);
  const contents = page.node.Contents();
  if (!contents) return "";
  const ref = (contents as any).get ? (contents as any).get(0) : contents;
  const stream: any = doc.context.lookup(ref);
  if (!stream || !stream.contents) return "";
  let raw = "";
  try {
    raw = zlib.inflateSync(Buffer.from(stream.contents)).toString("utf-8");
  } catch {
    raw = Buffer.from(stream.contents).toString("utf-8");
  }
  const hexMatch = raw.match(/<([0-9A-Fa-f]+)>\s*Tj/);
  if (hexMatch && hexMatch[1]) {
    return Buffer.from(hexMatch[1], "hex").toString("utf-8");
  }
  return raw;
}

async function runTests() {
  console.log("=== PHASE 4.4 ORGANIZE PDF TEST SUITE ===");
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

  // Pre-generate sample 5-page PDF
  const pdf5pBuffer = await generateSamplePdf(5, "DocFive");
  const fileA_5p = await uploadPdfBuffer(tokenA, pdf5pBuffer, "five_pages.pdf");
  const fileB_5p = await uploadPdfBuffer(tokenB, pdf5pBuffer, "user_b_five_pages.pdf");

  // TEST 1: Rejection on missing input file
  await test("Test 1: Organize rejection on missing input file (empty inputFileIds)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [],
        options: { pages: [1, 2] },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 2: Rejection on multiple input files
  await test("Test 2: Organize rejection on multiple input files (>1 inputFileIds)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p, fileA_5p],
        options: { pages: [1, 2] },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 3: Rejection on non-existent input file ID
  await test("Test 3: Organize rejection on non-existent input file ID", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: ["cm_missing_file_id_999"],
        options: { pages: [1, 2] },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 4: Rejection on unowned input file
  await test("Test 4: Organize rejection on unowned input file (User B's file requested by User A)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileB_5p],
        options: { pages: [1, 2] },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 5: Rejection on empty pages array
  await test("Test 5: Organize rejection on empty pages array", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p],
        options: { pages: [] },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_TOOL_OPTIONS") {
      throw new Error(`Expected 400 INVALID_TOOL_OPTIONS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 6: Rejection on out-of-bounds sourcePage
  await test("Test 6: Organize rejection on out-of-bounds sourcePage (e.g. page 10 on 5-page doc)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p],
        options: {
          pages: [{ sourcePage: 10, rotation: 0 }],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "PAGE_OUT_OF_BOUNDS") {
      throw new Error(`Expected 400 PAGE_OUT_OF_BOUNDS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 7: Rejection on invalid rotation angle
  await test("Test 7: Organize rejection on invalid rotation angle (e.g. 45 degrees)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p],
        options: {
          pages: [{ sourcePage: 1, rotation: 45 }],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_ROTATION_ANGLE") {
      throw new Error(`Expected 400 INVALID_ROTATION_ANGLE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 8: Rejection on exceeding max output pages (200 pages limit)
  await test("Test 8: Organize rejection when requested pages exceed 200", async () => {
    const excessivePages = [];
    for (let i = 1; i <= 201; i++) {
      excessivePages.push({ sourcePage: 1, rotation: 0 });
    }
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p],
        options: { pages: excessivePages },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "MAX_OUTPUT_PAGES_EXCEEDED") {
      throw new Error(`Expected 400 MAX_OUTPUT_PAGES_EXCEEDED, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 9: Normal arbitrary reorder execution (e.g. [3, 1, 5, 2, 4])
  await test("Test 9: Arbitrary page reorder execution [3, 1, 5, 2, 4] with text verification", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p],
        options: {
          pages: [
            { sourcePage: 3, rotation: 0 },
            { sourcePage: 1, rotation: 0 },
            { sourcePage: 5, rotation: 0 },
            { sourcePage: 2, rotation: 0 },
            { sourcePage: 4, rotation: 0 },
          ],
        },
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

    const dlRes = await fetch(`${BASE_URL}/api/v1/files/${job.outputFileId}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pdfBytes = await dlRes.arrayBuffer();
    const parsedDoc = await PDFDocument.load(pdfBytes);

    if (parsedDoc.getPageCount() !== 5) {
      throw new Error(`Expected 5 pages in reordered doc, got ${parsedDoc.getPageCount()}`);
    }

    // Verify exact sequence of page text
    const expectedOrder = [3, 1, 5, 2, 4];
    for (let i = 0; i < 5; i++) {
      const pageText = extractPageText(parsedDoc, i);
      const expectedPage = expectedOrder[i];
      if (!pageText.includes(`Page ${expectedPage}`)) {
        throw new Error(`Pos #${i + 1} does not contain 'Page ${expectedPage}': got "${pageText}"`);
      }
    }
  });

  // TEST 10: Reverse order execution [5, 4, 3, 2, 1]
  await test("Test 10: Reverse order execution [5, 4, 3, 2, 1]", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p],
        options: {
          pages: [5, 4, 3, 2, 1],
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

    const firstPageText = extractPageText(parsedDoc, 0);
    const lastPageText = extractPageText(parsedDoc, 4);

    if (!firstPageText.includes("Page 5") || !lastPageText.includes("Page 1")) {
      throw new Error(`Reverse order check failed: first="${firstPageText}", last="${lastPageText}"`);
    }
  });

  // TEST 11: Page deletion / extraction [2, 4]
  await test("Test 11: Page deletion/extraction [2, 4] extracts subset", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p],
        options: {
          pages: [{ sourcePage: 2 }, { sourcePage: 4 }],
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

    if (parsedDoc.getPageCount() !== 2) {
      throw new Error(`Expected 2 pages, got ${parsedDoc.getPageCount()}`);
    }

    const p1 = extractPageText(parsedDoc, 0);
    const p2 = extractPageText(parsedDoc, 1);
    if (!p1.includes("Page 2") || !p2.includes("Page 4")) {
      throw new Error(`Extraction mismatch: P1="${p1}", P2="${p2}"`);
    }
  });

  // TEST 12: Page duplication [1, 2, 2, 3]
  await test("Test 12: Page duplication [1, 2, 2, 3]", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p],
        options: {
          pages: [1, 2, 2, 3],
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

    if (parsedDoc.getPageCount() !== 4) {
      throw new Error(`Expected 4 pages for duplicated doc, got ${parsedDoc.getPageCount()}`);
    }

    const p2Text = extractPageText(parsedDoc, 1);
    const p3Text = extractPageText(parsedDoc, 2);
    if (!p2Text.includes("Page 2") || !p3Text.includes("Page 2")) {
      throw new Error(`Duplication text check failed: P2="${p2Text}", P3="${p3Text}"`);
    }
  });

  // TEST 13: Per-page rotation in organize
  await test("Test 13: Per-page rotation in organize (Page 1 -> 90° rotated, Page 2 -> unrotated)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p],
        options: {
          pages: [
            { sourcePage: 1, rotation: 90 },
            { sourcePage: 2, rotation: 0 },
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

    const a1 = parsedDoc.getPage(0).getRotation().angle;
    const a2 = parsedDoc.getPage(1).getRotation().angle;

    if (a1 !== 90 || a2 !== 0) {
      throw new Error(`Rotation in organize failed: Page 1 angle=${a1}, Page 2 angle=${a2}`);
    }
  });

  // TEST 14: Job cancellation cleans up output file
  await test("Test 14: Organize job cancellation cleans up generated output file", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "organize-pdf",
        inputFileIds: [fileA_5p],
        options: {
          pages: [1, 2, 3],
        },
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
