process.env.NODE_ENV = "test";
import fs from "fs";
import path from "path";
import http from "http";
import jwt from "jsonwebtoken";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";

let BASE_URL = "http://localhost:3001";
let serverInstance: http.Server | null = null;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-replace-in-production";

const userA = { id: "user_a_phase3", name: "User A (Phase 3)", email: "user_a_phase3@test.local" };
const userB = { id: "user_b_phase3", name: "User B (Phase 3)", email: "user_b_phase3@test.local" };

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

async function uploadPdf(token: string, content: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([content], { type: "application/pdf" }), filename);

  const res = await fetch(`${BASE_URL}/api/v1/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json();
  if (res.status !== 201 || !data.data?.file?.id) {
    throw new Error(`File upload failed: ${JSON.stringify(data)}`);
  }
  return data.data.file.id;
}

async function runTests() {
  console.log("=== PHASE 3 PDF JOB SYSTEM TEST SUITE ===");
  await ensureServerRunning();
  await ensureTestUsers();

  // Create minimal valid PDF
  const validPdfContent = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n`;
  const corruptPdfContent = `%PDF-1.4\nBROKEN_CORRUPT_BYTES_XYZ_12345`;

  const fileAId = await uploadPdf(tokenA, validPdfContent, "document_a.pdf");
  const fileBId = await uploadPdf(tokenB, validPdfContent, "document_b.pdf");
  const corruptFileId = await uploadPdf(tokenA, corruptPdfContent, "corrupt.pdf");

  let createdJobId = "";

  // Test 1: Create Job
  console.log("\n[Test 1] Create Job - POST /api/v1/jobs (User A)");
  const res1 = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      tool: "compress-pdf",
      inputFileIds: [fileAId],
      options: { level: "recommended" },
    }),
  });
  const data1 = await res1.json();
  console.log("Status:", res1.status, "Job:", data1.data?.job?.id, "Status:", data1.data?.job?.status);
  if (res1.status !== 201 || !data1.data?.job?.id) {
    throw new Error(`Test 1 Failed: ${JSON.stringify(data1)}`);
  }
  createdJobId = data1.data.job.id;
  console.log("PASS: Job created successfully.");

  // Test 2: Get Job Details
  console.log("\n[Test 2] Get Job - GET /api/v1/jobs/:jobId (User A)");
  const res2 = await fetch(`${BASE_URL}/api/v1/jobs/${createdJobId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data2 = await res2.json();
  console.log("Status:", res2.status, "Tool:", data2.data?.job?.tool, "Status:", data2.data?.job?.status);
  if (res2.status !== 200 || data2.data?.job?.id !== createdJobId) {
    throw new Error("Test 2 Failed: Job details mismatch.");
  }
  console.log("PASS: Job details retrieved successfully.");

  // Test 3: List Jobs
  console.log("\n[Test 3] List Jobs - GET /api/v1/jobs (User A)");
  const res3 = await fetch(`${BASE_URL}/api/v1/jobs?page=1&limit=20&tool=compress-pdf`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data3 = await res3.json();
  console.log("Status:", res3.status, "Total jobs:", data3.data?.pagination?.total);
  if (res3.status !== 200 || !data3.data?.jobs || data3.data.jobs.length === 0) {
    throw new Error("Test 3 Failed: User jobs not found in listing.");
  }
  console.log("PASS: User jobs listed with pagination.");

  // Test 4: Invalid Job Not Found
  console.log("\n[Test 4] Invalid Job - GET /api/v1/jobs/nonexistent-job-cuid");
  const res4 = await fetch(`${BASE_URL}/api/v1/jobs/nonexistent-job-cuid`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data4 = await res4.json();
  console.log("Status:", res4.status, "Error Code:", data4.error?.code);
  if (res4.status !== 404 || data4.error?.code !== "JOB_NOT_FOUND") {
    throw new Error(`Test 4 Failed: Expected 404 JOB_NOT_FOUND, got ${res4.status}`);
  }
  console.log("PASS: Nonexistent job returns 404.");

  // Test 5: Unauthorized Job Access (User B accessing User A's job)
  console.log("\n[Test 5] Unauthorized Job Access - GET /api/v1/jobs/:jobId (User B accessing User A job)");
  const res5 = await fetch(`${BASE_URL}/api/v1/jobs/${createdJobId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const data5 = await res5.json();
  console.log("Status:", res5.status, "Error Code:", data5.error?.code);
  if (res5.status !== 403 || data5.error?.code !== "JOB_ACCESS_DENIED") {
    throw new Error(`Test 5 Failed: Expected 403 JOB_ACCESS_DENIED, got ${res5.status}`);
  }
  console.log("PASS: Cross-user job isolation strictly enforced.");

  // Test 6: Cancel Job
  console.log("\n[Test 6] Cancel Job - POST /api/v1/jobs/:jobId/cancel (User A)");
  // Create another job to cancel
  const jobToCancelRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      tool: "compress-pdf",
      inputFileIds: [fileAId],
      options: { level: "low" },
    }),
  });
  const jobToCancelData = await jobToCancelRes.json();
  const cancelJobId = jobToCancelData.data.job.id;

  const res6 = await fetch(`${BASE_URL}/api/v1/jobs/${cancelJobId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data6 = await res6.json();
  console.log("Status:", res6.status, "Job status after cancel:", data6.data?.job?.status);
  if (res6.status !== 200 || data6.data?.job?.status !== "CANCELLED") {
    throw new Error(`Test 6 Failed: Expected CANCELLED, got ${data6.data?.job?.status}`);
  }
  console.log("PASS: Job cancellation successful.");

  // Test 7: Delete Job from History (Allowed for CANCELLED job)
  console.log("\n[Test 7] Delete Job - DELETE /api/v1/jobs/:jobId (User A)");
  const res7 = await fetch(`${BASE_URL}/api/v1/jobs/${cancelJobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const data7 = await res7.json();
  console.log("Status:", res7.status, "Message:", data7.data?.message);
  if (res7.status !== 200) {
    throw new Error("Test 7 Failed: Job deletion failed.");
  }
  const verifyRes7 = await fetch(`${BASE_URL}/api/v1/jobs/${cancelJobId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  if (verifyRes7.status !== 404) {
    throw new Error("Test 7 Failed: Deleted job still returned.");
  }
  console.log("PASS: Job deleted from user history.");

  // Test 7B: Reject Deletion of Active (QUEUED/PROCESSING) Job
  console.log("\n[Test 7B] Reject Deletion of Active Job (User A)");
  const activeJobRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      tool: "compress-pdf",
      inputFileIds: [fileAId],
    }),
  });
  const activeJobData = await activeJobRes.json();
  const activeJobId = activeJobData.data.job.id;

  const deleteActiveRes = await fetch(`${BASE_URL}/api/v1/jobs/${activeJobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const deleteActiveData = await deleteActiveRes.json();
  console.log("Status:", deleteActiveRes.status, "Error Code:", deleteActiveData.error?.code);
  if (deleteActiveRes.status !== 400 || deleteActiveData.error?.code !== "INVALID_JOB_STATUS") {
    throw new Error(`Test 7B Failed: Expected 400 INVALID_JOB_STATUS, got ${deleteActiveRes.status}`);
  }
  console.log("PASS: Deletion of active job rejected with INVALID_JOB_STATUS.");

  // Cancel it so it can be cleaned up
  await fetch(`${BASE_URL}/api/v1/jobs/${activeJobId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  // Test 8: Real Compress Job Execution & Output Verification
  console.log("\n[Test 8] End-to-End Compress PDF Execution (User A)");
  let completedJob: any = null;
  let attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 600));
    const pollRes = await fetch(`${BASE_URL}/api/v1/jobs/${createdJobId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pollData = await pollRes.json();
    if (pollData.data?.job?.status === "COMPLETED") {
      completedJob = pollData.data.job;
      break;
    }
    attempts++;
  }

  if (!completedJob || completedJob.status !== "COMPLETED") {
    throw new Error(`Test 8 Failed: Job did not complete within timeout. Status: ${completedJob?.status}`);
  }
  console.log("Job completed! Output File ID:", completedJob.outputFileId);

  // Download output file
  const downloadRes = await fetch(`${BASE_URL}/api/v1/files/${completedJob.outputFileId}/download`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const downloadBytes = await downloadRes.text();
  console.log("Download Status:", downloadRes.status, "Bytes prefix:", downloadBytes.slice(0, 5));
  if (downloadRes.status !== 200 || !downloadBytes.startsWith("%PDF")) {
    throw new Error("Test 8 Failed: Compressed output is not a valid PDF stream.");
  }
  console.log("PASS: End-to-end Compress Job executed, output stored, and valid PDF downloaded.");

  // Test 9: Failed Job with Corrupt PDF
  console.log("\n[Test 9] Corrupt PDF Processing Failure (User A)");
  const corruptJobRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      tool: "compress-pdf",
      inputFileIds: [corruptFileId],
      options: { level: "recommended" },
    }),
  });
  const corruptJobData = await corruptJobRes.json();
  const corruptJobId = corruptJobData.data.job.id;

  let failedJob: any = null;
  let failAttempts = 0;
  while (failAttempts < 20) {
    await new Promise((r) => setTimeout(r, 600));
    const pollFailRes = await fetch(`${BASE_URL}/api/v1/jobs/${corruptJobId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pollFailData = await pollFailRes.json();
    if (pollFailData.data?.job?.status === "FAILED") {
      failedJob = pollFailData.data.job;
      break;
    }
    failAttempts++;
  }

  if (!failedJob || failedJob.status !== "FAILED") {
    throw new Error(`Test 9 Failed: Corrupt job did not transition to FAILED. Current: ${failedJob?.status}`);
  }
  console.log("Status:", failedJob.status, "Error Code:", failedJob.errorCode, "Message:", failedJob.errorMessage);
  if (failedJob.errorCode !== "PROCESSING_FAILED") {
    throw new Error(`Test 9 Failed: Expected errorCode PROCESSING_FAILED, got ${failedJob.errorCode}`);
  }
  console.log("PASS: Corrupted PDF gracefully transitioned to FAILED with sanitized message.");

  // Test 10: Invalid Tool Name Rejected
  console.log("\n[Test 10] Reject Invalid Tool Name");
  const res10 = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      tool: "fake-unsupported-tool",
      inputFileIds: [fileAId],
    }),
  });
  const data10 = await res10.json();
  console.log("Status:", res10.status, "Error Code:", data10.error?.code);
  if (res10.status !== 400 || data10.error?.code !== "INVALID_TOOL") {
    throw new Error(`Test 10 Failed: Expected 400 INVALID_TOOL, got ${res10.status}`);
  }

  // Also confirm unimplemented tool (e.g. organize-pdf) is rejected
  const res10b = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      tool: "unsupported-tool",
      inputFileIds: [fileAId],
    }),
  });
  const data10b = await res10b.json();
  if (res10b.status !== 400 || data10b.error?.code !== "INVALID_TOOL") {
    throw new Error(`Test 10b Failed: Expected 400 INVALID_TOOL for unimplemented tool, got ${res10b.status}`);
  }
  console.log("PASS: Unsupported and unimplemented tools rejected.");

  // Test 11: Unowned Input File Rejected
  console.log("\n[Test 11] Reject Input File Not Owned by User");
  const res11 = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      tool: "compress-pdf",
      inputFileIds: [fileBId], // Owned by User B
    }),
  });
  const data11 = await res11.json();
  console.log("Status:", res11.status, "Error Code:", data11.error?.code);
  if (res11.status !== 400 || data11.error?.code !== "INVALID_INPUT_FILE") {
    throw new Error(`Test 11 Failed: Expected 400 INVALID_INPUT_FILE, got ${res11.status}`);
  }
  console.log("PASS: Unowned input file rejected.");

  // Test 12: Cancel During Processing & Race-Safe Cleanup Verification
  console.log("\n[Test 12] Cancel During Processing & Race-Safe Cleanup Verification (User A)");
  const raceJobRes = await fetch(`${BASE_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      tool: "compress-pdf",
      inputFileIds: [fileAId],
      options: { level: "extreme" },
    }),
  });
  const raceJobData = await raceJobRes.json();
  const raceJobId = raceJobData.data.job.id;

  // Poll until it reaches PROCESSING status
  let checkAttempts = 0;
  while (checkAttempts < 15) {
    const statusRes = await fetch(`${BASE_URL}/api/v1/jobs/${raceJobId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const statusData = await statusRes.json();
    if (statusData.data?.job?.status === "PROCESSING") {
      console.log(`Job ${raceJobId} reached PROCESSING status, issuing CANCEL now...`);
      break;
    }
    await new Promise((r) => setTimeout(r, 20));
    checkAttempts++;
  }

  // Cancel while in flight
  const cancelRaceRes = await fetch(`${BASE_URL}/api/v1/jobs/${raceJobId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const cancelRaceData = await cancelRaceRes.json();
  console.log("Cancel API Status:", cancelRaceRes.status, "Job status:", cancelRaceData.data?.job?.status);
  if (cancelRaceRes.status !== 200 || cancelRaceData.data?.job?.status !== "CANCELLED") {
    throw new Error(`Test 12 Failed: Cancellation during processing failed. Status: ${cancelRaceData.data?.job?.status}`);
  }

  // Wait for background processor to finish
  await new Promise((r) => setTimeout(r, 1500));

  // Verify that job REMAINED CANCELLED and was not overwritten by COMPLETED
  const finalCheckRes = await fetch(`${BASE_URL}/api/v1/jobs/${raceJobId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const finalCheckData = await finalCheckRes.json();
  const finalJob = finalCheckData.data.job;
  console.log("Final Job status after processor completion:", finalJob.status, "outputFileId:", finalJob.outputFileId);

  if (finalJob.status !== "CANCELLED") {
    throw new Error(`Test 12 Failed: Cancelled job was overwritten with status '${finalJob.status}'`);
  }
  if (finalJob.outputFileId !== null && finalJob.outputFileId !== undefined) {
    throw new Error(`Test 12 Failed: Cancelled job outputFileId should be null, got '${finalJob.outputFileId}'`);
  }
  console.log("PASS: Job remained CANCELLED, output file was safely purged, no orphan file created.");

  console.log("\n==========================================");
  console.log("ALL PHASE 3 JOB TESTS PASSED SUCCESSFULLY! ✅");
  console.log("==========================================");
}

runTests()
  .then(async () => {
    if (serverInstance) {
      serverInstance.close();
    }
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Phase 3 Test Suite Failed:", err);
    if (serverInstance) {
      serverInstance.close();
    }
    await prisma.$disconnect();
    process.exit(1);
  });
