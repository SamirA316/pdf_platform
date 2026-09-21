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

const userA = { id: "user_a_phase4", name: "User A (Phase 4)", email: "user_a_phase4@test.local" };
const userB = { id: "user_b_phase4", name: "User B (Phase 4)", email: "user_b_phase4@test.local" };

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
  console.log("=== PHASE 4.1 MERGE PDF TEST SUITE ===");
  await ensureServerRunning();
  await ensureTestUsers();

  // Create real test PDFs with known page counts
  const pdfBufferA = await generateSamplePdf(1, "Document A"); // 1 page
  const pdfBufferB = await generateSamplePdf(2, "Document B"); // 2 pages
  const pdfBufferC = await generateSamplePdf(1, "Document C"); // 1 page

  const fileA1Id = await uploadPdfBuffer(tokenA, pdfBufferA, "doc_a.pdf");
  const fileA2Id = await uploadPdfBuffer(tokenA, pdfBufferB, "doc_b.pdf");
  const fileA3Id = await uploadPdfBuffer(tokenA, pdfBufferC, "doc_c.pdf");
  const fileB1Id = await uploadPdfBuffer(tokenB, pdfBufferA, "doc_user_b.pdf");

  // [Test 1] Reject less than 2 files
  console.log("\n[Test 1] Validation: Reject less than 2 input files");
  const resEmpty = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ tool: "merge-pdf", inputFileIds: [] }),
  });
  const dataEmpty = await resEmpty.json();
  if (resEmpty.status !== 400 || dataEmpty.error?.code !== "INVALID_INPUT_FILE") {
    throw new Error(`Expected 400 INVALID_INPUT_FILE for 0 files, got ${resEmpty.status}`);
  }

  const resSingle = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ tool: "merge-pdf", inputFileIds: [fileA1Id] }),
  });
  const dataSingle = await resSingle.json();
  if (resSingle.status !== 400 || dataSingle.error?.code !== "INVALID_INPUT_FILE") {
    throw new Error(`Expected 400 INVALID_INPUT_FILE for 1 file, got ${resSingle.status}`);
  }
  console.log("PASS: 0 and 1 input files rejected with INVALID_INPUT_FILE.");

  // [Test 2] Reject duplicate input file IDs
  console.log("\n[Test 2] Validation: Reject duplicate input file IDs");
  const resDup = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ tool: "merge-pdf", inputFileIds: [fileA1Id, fileA1Id] }),
  });
  const dataDup = await resDup.json();
  if (resDup.status !== 400 || dataDup.error?.code !== "INVALID_INPUT_FILE") {
    throw new Error(`Expected 400 INVALID_INPUT_FILE for duplicates, got ${resDup.status}`);
  }
  console.log("PASS: Duplicate input file IDs rejected.");

  // [Test 3] Reject nonexistent file IDs
  console.log("\n[Test 3] Validation: Reject nonexistent file IDs");
  const resMissing = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ tool: "merge-pdf", inputFileIds: ["cm_missing_1", "cm_missing_2"] }),
  });
  const dataMissing = await resMissing.json();
  if (resMissing.status !== 400 || dataMissing.error?.code !== "INVALID_INPUT_FILE") {
    throw new Error(`Expected 400 INVALID_INPUT_FILE for missing files, got ${resMissing.status}`);
  }
  console.log("PASS: Missing file IDs rejected.");

  // [Test 4] Reject unowned file IDs (Cross-user isolation)
  console.log("\n[Test 4] Security: Reject files owned by another user");
  const resCrossUser = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ tool: "merge-pdf", inputFileIds: [fileB1Id, fileA1Id] }),
  });
  const dataCross = await resCrossUser.json();
  if (resCrossUser.status !== 400 || dataCross.error?.code !== "INVALID_INPUT_FILE") {
    throw new Error(`Expected 400 INVALID_INPUT_FILE when including other user's file, got ${resCrossUser.status}`);
  }
  console.log("PASS: Cross-user file inclusion strictly rejected.");

  // [Test 5] Reject non-READY status file
  console.log("\n[Test 5] Validation: Reject file not in READY status");
  const dummyNonReady = await prisma.file.create({
    data: {
      userId: userA.id,
      originalName: "processing.pdf",
      storageKey: "users/user_a_phase4/temp.pdf",
      mimeType: "application/pdf",
      size: 100,
      status: "PROCESSING",
    },
  });

  const resNonReady = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ tool: "merge-pdf", inputFileIds: [fileA1Id, dummyNonReady.id] }),
  });
  const dataNonReady = await resNonReady.json();
  if (resNonReady.status !== 400 || dataNonReady.error?.code !== "INVALID_INPUT_FILE") {
    throw new Error(`Expected 400 INVALID_INPUT_FILE for non-READY file, got ${resNonReady.status}`);
  }
  await prisma.file.delete({ where: { id: dummyNonReady.id } });
  console.log("PASS: Non-READY files rejected.");

  // [Test 6] End-to-End Merge of 2 PDFs
  console.log("\n[Test 6] Execution: Merge 2 PDFs (doc_a [1 page] + doc_b [2 pages])");
  const resMerge2 = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ tool: "merge-pdf", inputFileIds: [fileA1Id, fileA2Id] }),
  });
  const dataMerge2 = await resMerge2.json();
  if (resMerge2.status !== 201 || !dataMerge2.data?.job?.id) {
    throw new Error(`Failed to create merge-pdf job: ${JSON.stringify(dataMerge2)}`);
  }
  const job2Id = dataMerge2.data.job.id;
  console.log(`Job created: ${job2Id} (Initial status: ${dataMerge2.data.job.status})`);

  // Poll job until COMPLETED
  let job2Completed: any = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const pollRes = await fetch(`${BASE_URL}/api/v1/jobs/${job2Id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pollData = await pollRes.json();
    if (pollData.data?.job?.status === "COMPLETED") {
      job2Completed = pollData.data.job;
      break;
    }
  }

  if (!job2Completed || !job2Completed.outputFileId) {
    throw new Error(`Merge job did not complete successfully. Status: ${job2Completed?.status}`);
  }
  console.log(`Job completed! Output File ID: ${job2Completed.outputFileId}, Metrics:`, job2Completed.options?.metrics);
  if (job2Completed.options?.metrics?.pageCount !== 3) {
    throw new Error(`Expected total pageCount to be 3, got ${job2Completed.options?.metrics?.pageCount}`);
  }

  // Download merged PDF and inspect with pdf-lib
  const dlRes2 = await fetch(`${BASE_URL}/api/v1/files/${job2Completed.outputFileId}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (dlRes2.status !== 200) {
    throw new Error(`Failed to download merged PDF (${dlRes2.status})`);
  }
  const dlBytes2 = await dlRes2.arrayBuffer();
  const parsedPdf2 = await PDFDocument.load(dlBytes2);
  if (parsedPdf2.getPageCount() !== 3) {
    throw new Error(`Expected parsed PDF page count to be 3, got ${parsedPdf2.getPageCount()}`);
  }
  console.log(`PASS: Merged PDF verified on disk with exactly 3 pages.`);

  // [Test 7] Order Preservation with 3 PDFs
  console.log("\n[Test 7] Order Preservation: Merge 3 PDFs [doc_c (1p), doc_a (1p), doc_b (2p)] = 4 pages");
  const resMerge3 = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      tool: "merge-pdf",
      inputFileIds: [fileA3Id, fileA1Id, fileA2Id],
      options: { outputName: "custom-order-merged.pdf" },
    }),
  });
  const dataMerge3 = await resMerge3.json();
  const job3Id = dataMerge3.data.job.id;

  let job3Completed: any = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const pollRes = await fetch(`${BASE_URL}/api/v1/jobs/${job3Id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pollData = await pollRes.json();
    if (pollData.data?.job?.status === "COMPLETED") {
      job3Completed = pollData.data.job;
      break;
    }
  }

  if (!job3Completed || !job3Completed.outputFileId) {
    throw new Error(`3-file merge job failed to complete: ${JSON.stringify(job3Completed)}`);
  }
  console.log(`Job completed! outputFileId: ${job3Completed.outputFileId}`);
  if (job3Completed.options?.metrics?.pageCount !== 4) {
    throw new Error(`Expected 4 pages, got ${job3Completed.options?.metrics?.pageCount}`);
  }

  const dlRes3 = await fetch(`${BASE_URL}/api/v1/files/${job3Completed.outputFileId}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dlBytes3 = await dlRes3.arrayBuffer();
  const parsedPdf3 = await PDFDocument.load(dlBytes3);
  if (parsedPdf3.getPageCount() !== 4) {
    throw new Error(`Expected 4 pages in parsed PDF, got ${parsedPdf3.getPageCount()}`);
  }

  // Inspect the actual text content on each page to verify genuine user-specified ordering
  const p1Text = extractPageText(parsedPdf3, 0);
  const p2Text = extractPageText(parsedPdf3, 1);
  const p3Text = extractPageText(parsedPdf3, 2);
  const p4Text = extractPageText(parsedPdf3, 3);

  console.log("Verified Page Contents:", [p1Text, p2Text, p3Text, p4Text]);

  // Verify exact sequential matching:
  // Page 1 -> Document C (1st input in array)
  // Page 2 -> Document A (2nd input in array)
  // Page 3 -> Document B Page 1 (3rd input in array)
  // Page 4 -> Document B Page 2 (3rd input in array)
  if (!p1Text.includes("Document C - Page 1")) {
    throw new Error(`Order mismatch at Page 1! Expected 'Document C - Page 1', got: '${p1Text}'`);
  }
  if (!p2Text.includes("Document A - Page 1")) {
    throw new Error(`Order mismatch at Page 2! Expected 'Document A - Page 1', got: '${p2Text}'`);
  }
  if (!p3Text.includes("Document B - Page 1")) {
    throw new Error(`Order mismatch at Page 3! Expected 'Document B - Page 1', got: '${p3Text}'`);
  }
  if (!p4Text.includes("Document B - Page 2")) {
    throw new Error(`Order mismatch at Page 4! Expected 'Document B - Page 2', got: '${p4Text}'`);
  }
  console.log("PASS: 3-file merge strictly verified: Page 1=Doc C, Page 2=Doc A, Page 3=Doc B(P1), Page 4=Doc B(P2).");

  // [Test 8] Corrupted PDF Failure Handling
  console.log("\n[Test 8] Error Handling: Corrupt PDF file");
  const corruptFileId = await uploadPdfBuffer(tokenA, Buffer.from("NOT_A_VALID_PDF_HEADER"), "corrupt.pdf");
  const resCorrupt = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ tool: "merge-pdf", inputFileIds: [fileA1Id, corruptFileId] }),
  });
  const dataCorrupt = await resCorrupt.json();
  const jobCorruptId = dataCorrupt.data.job.id;

  let jobCorruptDone: any = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const pollRes = await fetch(`${BASE_URL}/api/v1/jobs/${jobCorruptId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pollData = await pollRes.json();
    if (pollData.data?.job?.status === "FAILED") {
      jobCorruptDone = pollData.data.job;
      break;
    }
  }

  if (!jobCorruptDone) {
    throw new Error(`Expected job to fail on corrupt PDF, got ${jobCorruptDone?.status}`);
  }
  console.log(`Job status: ${jobCorruptDone.status}, Error Code: ${jobCorruptDone.errorCode}, Message: ${jobCorruptDone.errorMessage}`);
  if (jobCorruptDone.errorMessage !== "We couldn't merge these PDFs. Please try again.") {
    throw new Error(`Expected sanitized error message, got: ${jobCorruptDone.errorMessage}`);
  }
  console.log("PASS: Corrupt PDF handled gracefully with sanitized message.");

  // [Test 9] Queued / Early Job Cancellation & State Integrity
  console.log("\n[Test 9] Cancellation: Cancel queued/early merge job & verify state + no orphan output file");
  const resCancel = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ tool: "merge-pdf", inputFileIds: [fileA1Id, fileA2Id] }),
  });
  const dataCancel = await resCancel.json();
  const cancelJobId = dataCancel.data.job.id;

  // Immediate cancel while QUEUED or fast PROCESSING
  const cancelReq = await fetch(`${BASE_URL}/api/v1/jobs/${cancelJobId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const cancelData = await cancelReq.json();
  console.log(`Cancel API Status: ${cancelReq.status}, Status: ${cancelData.data?.job?.status}`);

  await new Promise((r) => setTimeout(r, 1000));
  const finalJobRes = await fetch(`${BASE_URL}/api/v1/jobs/${cancelJobId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const finalJob = (await finalJobRes.json()).data?.job;
  console.log(`Final Job Status: ${finalJob?.status}, outputFileId: ${finalJob?.outputFileId}`);
  if (finalJob?.status !== "CANCELLED" || finalJob?.outputFileId !== null) {
    throw new Error(`Expected job to remain CANCELLED with null outputFileId`);
  }
  console.log("PASS: Cancelled queued/early merge job remained CANCELLED with no orphan output file.");

  console.log("\n==========================================");
  console.log("ALL PHASE 4.1 MERGE PDF TESTS PASSED! ✅");
  console.log("==========================================");

  if (serverInstance) {
    serverInstance.close();
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  if (serverInstance) {
    serverInstance.close();
  }
  process.exit(1);
});
