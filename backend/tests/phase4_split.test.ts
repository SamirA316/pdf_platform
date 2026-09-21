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

const userA = { id: "user_a_split_phase4", name: "User A (Split)", email: "user_a_split@test.local" };
const userB = { id: "user_b_split_phase4", name: "User B (Split)", email: "user_b_split@test.local" };

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
  console.log("=== PHASE 4.2 SPLIT PDF TEST SUITE ===");
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

  // Pre-generate sample PDFs
  const pdf5PagesBuffer = await generateSamplePdf(5, "DocFive");
  const pdf4PagesBuffer = await generateSamplePdf(4, "DocFour");

  const fileA_5p = await uploadPdfBuffer(tokenA, pdf5PagesBuffer, "five_pages.pdf");
  const fileA_4p = await uploadPdfBuffer(tokenA, pdf4PagesBuffer, "four_pages.pdf");
  const fileB_5p = await uploadPdfBuffer(tokenB, pdf5PagesBuffer, "user_b_five_pages.pdf");

  // TEST 1: Rejection on missing input file
  await test("Test 1: Split rejection on missing input file (empty inputFileIds)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [],
        options: { mode: "every-page" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 2: Rejection on multiple input files
  await test("Test 2: Split rejection on multiple input files (>1 inputFileIds)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_5p, fileA_4p],
        options: { mode: "every-page" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 3: Rejection on non-existent input file ID
  await test("Test 3: Split rejection on non-existent input file ID", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: ["non_existent_file_id_12345"],
        options: { mode: "every-page" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 4: Rejection on unowned input file
  await test("Test 4: Split rejection on unowned input file (User B's file accessed by User A)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileB_5p],
        options: { mode: "every-page" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_INPUT_FILE") {
      throw new Error(`Expected 400 INVALID_INPUT_FILE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 5: Rejection on invalid split mode
  await test("Test 5: Split rejection on unsupported split mode", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_5p],
        options: { mode: "invalid-custom-mode" },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_TOOL_OPTIONS") {
      throw new Error(`Expected 400 INVALID_TOOL_OPTIONS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 6: Range validation - Inverted range (start > end)
  await test("Test 6: Range validation rejection on inverted range (start > end)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_5p],
        options: {
          mode: "ranges",
          ranges: [{ start: 4, end: 2 }],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "INVALID_PAGE_RANGE") {
      throw new Error(`Expected 400 INVALID_PAGE_RANGE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 7: Range validation - Out of bounds (end > totalPages)
  await test("Test 7: Range validation rejection on out-of-bounds page (end > totalPages)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_5p],
        options: {
          mode: "ranges",
          ranges: [{ start: 1, end: 10 }],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "PAGE_OUT_OF_BOUNDS") {
      throw new Error(`Expected 400 PAGE_OUT_OF_BOUNDS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 8: Range validation - Overlapping ranges
  await test("Test 8: Range validation rejection on overlapping ranges", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_5p],
        options: {
          mode: "ranges",
          ranges: [
            { start: 1, end: 3 },
            { start: 3, end: 5 },
          ],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "OVERLAPPING_PAGE_RANGES") {
      throw new Error(`Expected 400 OVERLAPPING_PAGE_RANGES, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 9: Page validation - Out of bounds page
  await test("Test 9: Page validation rejection on out-of-bounds page number", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_5p],
        options: {
          mode: "pages",
          pages: [2, 9],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "PAGE_OUT_OF_BOUNDS") {
      throw new Error(`Expected 400 PAGE_OUT_OF_BOUNDS, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 10: Page validation - Duplicate page numbers
  await test("Test 10: Page validation rejection on duplicate page numbers", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_5p],
        options: {
          mode: "pages",
          pages: [2, 3, 2],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 400 || body.error?.code !== "DUPLICATE_PAGE") {
      throw new Error(`Expected 400 DUPLICATE_PAGE, got ${res.status}: ${JSON.stringify(body)}`);
    }
  });

  // TEST 11: Mode A (ranges) execution - split 5-page PDF into [1-2] and [4-5]
  await test("Test 11: Mode A (ranges) execution - splits into multiple range PDFs", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_5p],
        options: {
          mode: "ranges",
          ranges: [
            { start: 1, end: 2 },
            { start: 4, end: 5 },
          ],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 201 || !body.data?.job?.id) {
      throw new Error(`Job creation failed: ${JSON.stringify(body)}`);
    }

    const jobId = body.data.job.id;

    // Wait for completion
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

    if (!job.outputFiles || job.outputFiles.length !== 2) {
      throw new Error(`Expected 2 outputFiles, got ${job.outputFiles?.length}`);
    }

    // Verify each downloaded PDF
    for (const out of job.outputFiles) {
      const dlRes = await fetch(`${BASE_URL}/api/v1/files/${out.id}/download`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (dlRes.status !== 200) {
        throw new Error(`Download of ${out.id} failed with ${dlRes.status}`);
      }
      const pdfBytes = await dlRes.arrayBuffer();
      const parsedDoc = await PDFDocument.load(pdfBytes);
      if (parsedDoc.getPageCount() !== 2) {
        throw new Error(`Expected 2 pages in range doc, got ${parsedDoc.getPageCount()}`);
      }
    }
  });

  // TEST 12: Mode B (pages) execution - extract pages [2, 4] into single PDF
  await test("Test 12: Mode B (pages) execution - extracts selected pages into single PDF", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_5p],
        options: {
          mode: "pages",
          pages: [2, 4],
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 201 || !body.data?.job?.id) {
      throw new Error(`Job creation failed: ${JSON.stringify(body)}`);
    }

    const jobId = body.data.job.id;

    // Wait for completion
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

    if (!job.outputFiles || job.outputFiles.length !== 1) {
      throw new Error(`Expected 1 outputFiles, got ${job.outputFiles?.length}`);
    }

    const out = job.outputFiles[0];
    const dlRes = await fetch(`${BASE_URL}/api/v1/files/${out.id}/download`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    if (dlRes.status !== 200) {
      throw new Error(`Download of ${out.id} failed with ${dlRes.status}`);
    }
    const pdfBytes = await dlRes.arrayBuffer();
    const parsedDoc = await PDFDocument.load(pdfBytes);
    if (parsedDoc.getPageCount() !== 2) {
      throw new Error(`Expected 2 pages in selected doc, got ${parsedDoc.getPageCount()}`);
    }

    const p1Text = extractPageText(parsedDoc, 0);
    const p2Text = extractPageText(parsedDoc, 1);
    if (!p1Text.includes("Page 2") || !p2Text.includes("Page 4")) {
      throw new Error(`Extracted pages text mismatch: page 1="${p1Text}", page 2="${p2Text}"`);
    }
  });

  // TEST 13: Mode C (every-page) execution - splits 4-page PDF into 4 separate single-page PDFs
  await test("Test 13: Mode C (every-page) execution - splits each page into a separate PDF", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_4p],
        options: {
          mode: "every-page",
        },
      }),
    });
    const body = await res.json();
    if (res.status !== 201 || !body.data?.job?.id) {
      throw new Error(`Job creation failed: ${JSON.stringify(body)}`);
    }

    const jobId = body.data.job.id;

    // Wait for completion
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

    if (!job.outputFiles || job.outputFiles.length !== 4) {
      throw new Error(`Expected 4 outputFiles, got ${job.outputFiles?.length}`);
    }

    for (let i = 0; i < 4; i++) {
      const out = job.outputFiles[i];
      const dlRes = await fetch(`${BASE_URL}/api/v1/files/${out.id}/download`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      if (dlRes.status !== 200) {
        throw new Error(`Download of file #${i + 1} failed`);
      }
      const pdfBytes = await dlRes.arrayBuffer();
      const parsedDoc = await PDFDocument.load(pdfBytes);
      if (parsedDoc.getPageCount() !== 1) {
        throw new Error(`Expected 1 page in file #${i + 1}, got ${parsedDoc.getPageCount()}`);
      }
      const pageText = extractPageText(parsedDoc, 0);
      if (!pageText.includes(`Page ${i + 1}`)) {
        throw new Error(`File #${i + 1} does not contain Page ${i + 1}: ${pageText}`);
      }
    }
  });

  // TEST 14: Cancellation race condition cleans up all generated output files
  await test("Test 14: Job cancellation cleans up all generated output files", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [fileA_5p],
        options: {
          mode: "every-page",
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

    // Wait for processor to complete and clean up
    await new Promise((r) => setTimeout(r, 1200));

    // Verify in database that no output files remain linked with this jobId
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
