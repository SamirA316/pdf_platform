import http from "http";
import { PDFDocument as CantooPDF, rgb } from "@cantoo/pdf-lib";
import { prisma } from "../src/common/prisma";
import { sessionService } from "../src/modules/auth/session.service";
import { app } from "../src/server";

async function createSamplePdf(text: string, pages: number = 1): Promise<Uint8Array> {
  const doc = await CantooPDF.create();
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`${text} - Page ${i}`, {
      x: 50,
      y: 750,
      size: 18,
      color: rgb(0.1, 0.4, 0.8),
    });
  }
  return await doc.save();
}

async function runSmokeTests() {
  console.log("=================================================");
  console.log("🚀 Starting Phase 1 Comprehensive Smoke Test Suite");
  console.log("   (Verifying Merge, Compress & Split V1 Flows)");
  console.log("=================================================");

  // 1. Start ephemeral in-process test server
  const { port, server } = await new Promise<{ port: number; server: http.Server }>((resolve) => {
    const s = app.listen(0, () => {
      const addr = s.address();
      const p = typeof addr === "object" && addr ? addr.port : 3001;
      resolve({ port: p, server: s });
    });
  });

  const baseUrl = `http://localhost:${port}`;
  console.log(`✅ In-process test server running on ${baseUrl}`);

  // Attach CSRF credentials for all state-changing requests (Phase 2.4C)
  const rawFetch = global.fetch;
  const testCsrfToken = "csrf_token_for_smoke_suite_1234567890";
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const opts = init ? { ...init } : {};
    const method = (opts.method || "GET").toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const headers = new Headers(opts.headers);
      if (!headers.has("X-CSRF-Token")) {
        headers.set("X-CSRF-Token", testCsrfToken);
      }
      const existingCookie = headers.get("Cookie") || "";
      if (!existingCookie.includes("pdf_csrf=")) {
        headers.set(
          "Cookie",
          existingCookie ? `${existingCookie}; pdf_csrf=${testCsrfToken}` : `pdf_csrf=${testCsrfToken}`
        );
      }
      opts.headers = headers;
    }
    return rawFetch(input, opts);
  };

  try {
    // 2. Ensure test user exists & generate JWT
    let user = await prisma.user.findUnique({ where: { email: "smoke_user@test.local" } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: "smoke_test_user_id",
          name: "Smoke Test User",
          email: "smoke_user@test.local",
          password: "hashed_password",
          isVerified: true,
        },
      });
    }

    const session = await sessionService.createSession(user.id);
    const token = session.rawToken;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      Cookie: `token=${token}`,
    };

    // Helper: Upload file to /api/v1/files
    async function uploadPdf(name: string, bytes: Uint8Array): Promise<string> {
      const formData = new FormData();
      formData.append("file", new Blob([Buffer.from(bytes)], { type: "application/pdf" }), name);
      const res = await fetch(`${baseUrl}/api/v1/files`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(`Upload failed for ${name}: ${JSON.stringify(json)}`);
      }
      return json.data.file.id;
    }

    // Helper: Poll job until COMPLETED
    async function pollJob(jobId: string): Promise<any> {
      let attempts = 0;
      while (attempts < 25) {
        await new Promise((r) => setTimeout(r, 500));
        const res = await fetch(`${baseUrl}/api/v1/jobs/${jobId}`, { headers: authHeaders });
        const json = await res.json();
        if (json.data?.job?.status === "COMPLETED") {
          return json.data.job;
        }
        if (json.data?.job?.status === "FAILED") {
          throw new Error(`Job ${jobId} failed: ${json.data.job.errorMessage}`);
        }
        attempts++;
      }
      throw new Error(`Polling timed out for job ${jobId}`);
    }

    // Helper: Verify Download
    async function verifyDownload(fileId: string): Promise<number> {
      const res = await fetch(`${baseUrl}/api/v1/files/${fileId}/download`, { headers: authHeaders });
      if (!res.ok) {
        throw new Error(`Download failed for file ${fileId} with status ${res.status}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const header = buffer.slice(0, 5).toString("ascii");
      if (!header.startsWith("%PDF-")) {
        throw new Error(`File ${fileId} is not a valid PDF: '${header}'`);
      }
      return buffer.length;
    }

    // =========================================================================
    // TEST 1: MERGE PDF FLOW
    // Upload 2 PDFs -> Create Job merge-pdf -> Completed -> Download
    // =========================================================================
    console.log("\n-------------------------------------------------");
    console.log("▶ TEST 1: Merge PDF V1 Flow");
    console.log("-------------------------------------------------");
    const pdf1Bytes = await createSamplePdf("Document Alpha - Section 1", 1);
    const pdf2Bytes = await createSamplePdf("Document Beta - Section 2", 1);

    const file1Id = await uploadPdf("doc_alpha.pdf", pdf1Bytes);
    const file2Id = await uploadPdf("doc_beta.pdf", pdf2Bytes);
    console.log(`  1. Uploaded 2 input files: [${file1Id}, ${file2Id}]`);

    const mergeRes = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "merge-pdf",
        inputFileIds: [file1Id, file2Id],
        options: {},
      }),
    });
    const mergeJson = await mergeRes.json();
    if (!mergeRes.ok || !mergeJson.success) {
      throw new Error(`Merge job creation failed: ${JSON.stringify(mergeJson)}`);
    }
    const mergeJobId = mergeJson.data.job.id;
    console.log(`  2. Merge job created: ID = ${mergeJobId}`);

    const completedMergeJob = await pollJob(mergeJobId);
    console.log(`  3. Merge job COMPLETED! Output file ID = ${completedMergeJob.outputFileId}`);

    const mergeDownloadedBytes = await verifyDownload(completedMergeJob.outputFileId);
    console.log(`  4. Downloaded merged PDF (${mergeDownloadedBytes} bytes, Magic Header: %PDF-)`);
    console.log("  ✅ Test 1 (Merge PDF) PASSED!");

    // =========================================================================
    // TEST 2: COMPRESS PDF FLOW
    // Upload PDF -> Create Job compress-pdf -> Completed -> Download
    // =========================================================================
    console.log("\n-------------------------------------------------");
    console.log("▶ TEST 2: Compress PDF V1 Flow");
    console.log("-------------------------------------------------");
    const compressInputBytes = await createSamplePdf("Compressible Test Document", 2);
    const compressFileId = await uploadPdf("sample_to_compress.pdf", compressInputBytes);
    console.log(`  1. Uploaded input file: ${compressFileId}`);

    const compressRes = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "compress-pdf",
        inputFileIds: [compressFileId],
        options: { level: "recommended" },
      }),
    });
    const compressJson = await compressRes.json();
    if (!compressRes.ok || !compressJson.success) {
      throw new Error(`Compress job creation failed: ${JSON.stringify(compressJson)}`);
    }
    const compressJobId = compressJson.data.job.id;
    console.log(`  2. Compress job created: ID = ${compressJobId}`);

    const completedCompressJob = await pollJob(compressJobId);
    console.log(`  3. Compress job COMPLETED! Output file ID = ${completedCompressJob.outputFileId}`);

    const compressDownloadedBytes = await verifyDownload(completedCompressJob.outputFileId);
    console.log(`  4. Downloaded compressed PDF (${compressDownloadedBytes} bytes, Magic Header: %PDF-)`);
    console.log("  ✅ Test 2 (Compress PDF) PASSED!");

    // =========================================================================
    // TEST 3: SPLIT PDF FLOW
    // Upload 3-page PDF -> Create Job split-pdf -> Completed -> Download
    // =========================================================================
    console.log("\n-------------------------------------------------");
    console.log("▶ TEST 3: Split PDF V1 Flow");
    console.log("-------------------------------------------------");
    const splitInputBytes = await createSamplePdf("Multi-page Document For Splitting", 3);
    const splitFileId = await uploadPdf("document_to_split.pdf", splitInputBytes);
    console.log(`  1. Uploaded 3-page input file: ${splitFileId}`);

    const splitRes = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "split-pdf",
        inputFileIds: [splitFileId],
        options: { mode: "every-page" },
      }),
    });
    const splitJson = await splitRes.json();
    if (!splitRes.ok || !splitJson.success) {
      throw new Error(`Split job creation failed: ${JSON.stringify(splitJson)}`);
    }
    const splitJobId = splitJson.data.job.id;
    console.log(`  2. Split job created: ID = ${splitJobId}`);

    const completedSplitJob = await pollJob(splitJobId);
    console.log(`  3. Split job COMPLETED! Output file IDs = ${JSON.stringify(completedSplitJob.outputFileIds || [completedSplitJob.outputFileId])}`);

    const targetSplitFileId = completedSplitJob.outputFileId || (Array.isArray(completedSplitJob.outputFileIds) ? completedSplitJob.outputFileIds[0] : null);
    if (!targetSplitFileId) {
      throw new Error(`Split job has neither outputFileId nor outputFileIds: ${JSON.stringify(completedSplitJob)}`);
    }
    const splitDownloadedBytes = await verifyDownload(targetSplitFileId);
    console.log(`  4. Downloaded split PDF page (${splitDownloadedBytes} bytes, Magic Header: %PDF-)`);
    console.log("  ✅ Test 3 (Split PDF) PASSED!");

    console.log("\n=================================================");
    console.log("🎉 ALL 3 SMOKE TEST FLOWS (Merge, Compress, Split) PASSED!");
    console.log("=================================================");
  } finally {
    global.fetch = rawFetch;
    server.close();
  }
}

runSmokeTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Smoke test suite failed:", err);
    process.exit(1);
  });
