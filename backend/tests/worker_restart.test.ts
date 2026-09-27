process.env.NODE_ENV = "test";
import assert from "assert";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { PDFDocument, rgb } from "@cantoo/pdf-lib";
import { prisma } from "../src/common/prisma";
import { JobWorker } from "../src/workers/job.worker";
import { StorageService } from "../src/modules/files/storage.service";
import { jobService } from "../src/modules/jobs/job.service";
import { JobStatus } from "../src/modules/jobs/job.constants";

async function runWorkerRestartTest() {
  console.log("===============================================================");
  console.log("▶ [TEST] Durable Worker Restart & Encrypted Secrets Verification");
  console.log("===============================================================");

  // 0. Ensure test database schema exists
  try {
    await prisma.user.findFirst();
  } catch (err: any) {
    if (err?.code === "P2021" || String(err?.message || "").includes("does not exist")) {
      console.log("ℹ️ Test database tables not found. Automatically initializing schema via prisma db push...");
      execSync("npx prisma db push --skip-generate", {
        cwd: path.resolve(__dirname, ".."),
        stdio: "inherit",
        env: process.env,
      });
    }
  }

  const storageService = new StorageService();
  storageService.ensureStorageRoot();

  // 1. Setup test user
  const testUser = await prisma.user.upsert({
    where: { email: "worker_restart_test@quickpdf.local" },
    update: {},
    create: {
      id: "worker_restart_user_id",
      name: "Worker Restart Tester",
      email: "worker_restart_test@quickpdf.local",
      password: "test-hash-password-12345",
      isVerified: true,
    },
  });

  // 2. Create sample PDF on disk and record in DB
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 400]);
  page.drawText("Worker Restart Test Document", { x: 50, y: 350, size: 18, color: rgb(0, 0, 0) });
  const pdfBytes = await pdfDoc.save();

  const userDir = storageService.getUserStorageDir(testUser.id);
  const physicalFilename = `sample_worker_restart_${Date.now()}.pdf`;
  const physicalPath = path.join(userDir, physicalFilename);
  fs.writeFileSync(physicalPath, Buffer.from(pdfBytes));

  const inputFile = await prisma.file.create({
    data: {
      userId: testUser.id,
      originalName: "sample_restart.pdf",
      mimeType: "application/pdf",
      size: pdfBytes.length,
      storageKey: path.relative(storageService.getStorageRoot(), physicalPath),
    },
  });

  console.log(`✅ [PASS] Step 1: Created test input file (ID: ${inputFile.id})`);

  // ===========================================================================
  // SECTION A: Basic Worker Crash / Offline Recovery (Rotate PDF)
  // ===========================================================================
  const queuedJob = await prisma.job.create({
    data: {
      userId: testUser.id,
      tool: "rotate-pdf",
      status: JobStatus.QUEUED,
      inputFileIds: JSON.stringify([inputFile.id]),
      options: JSON.stringify({ angle: 90 }),
    },
  });

  console.log(`✅ [PASS] Step 2: Simulated offline job creation: Job ${queuedJob.id} is in QUEUED state`);
  assert.strictEqual(queuedJob.status, JobStatus.QUEUED);

  const freshWorker = new JobWorker({
    maxConcurrentJobs: 2,
    pollIntervalMs: 200,
    jobTimeoutMs: 30000,
  });

  jobService.setWorkerNotifier(() => freshWorker.notify());
  freshWorker.start();

  let finalRotateJob: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 300));
    finalRotateJob = await prisma.job.findUnique({
      where: { id: queuedJob.id },
      include: { outputFiles: true },
    });
    if (finalRotateJob?.status === JobStatus.COMPLETED) break;
  }

  assert.strictEqual(finalRotateJob?.status, JobStatus.COMPLETED);
  console.log(`✅ [PASS] Step 3: Worker successfully claimed offline QUEUED job and completed it`);

  // ===========================================================================
  // TEST 1 — Protect Restart (Memory Cache Cleared -> Worker Decrypts Secret)
  // ===========================================================================
  console.log("\n---------------------------------------------------------------");
  console.log("▶ [TEST 1] Protect PDF After Full In-Memory Cache Wipe");
  console.log("---------------------------------------------------------------");

  const protectPassword = "SecretRestartPass123!";
  const protectJobDto = await jobService.createJob(testUser.id, {
    tool: "protect-pdf",
    inputFileIds: [inputFile.id],
    options: {
      userPassword: protectPassword,
      permissions: { print: true, copy: false, modify: false, annotate: false },
    },
  });

  // SIMULATE SERVER REBOOT / CROSS-INSTANCE DISPATCH: Wipe executionOptionsCache completely
  jobService.clearExecutionOptions(protectJobDto.id);

  // Trigger worker to claim and execute
  freshWorker.notify();

  let finalProtectJob: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 300));
    finalProtectJob = await prisma.job.findUnique({
      where: { id: protectJobDto.id },
      include: { outputFile: true },
    });
    if (finalProtectJob?.status === JobStatus.COMPLETED) break;
  }

  assert.strictEqual(finalProtectJob?.status, JobStatus.COMPLETED, "Protect job must complete after cache wipe");
  assert(finalProtectJob.outputFile, "Protect job must produce output file");

  // Verify that the resulting PDF is genuinely encrypted with the password
  const protectedOutPath = path.resolve(storageService.getStorageRoot(), finalProtectJob.outputFile.storageKey);
  const protectedBytes = fs.readFileSync(protectedOutPath);

  let openedWithoutPass = false;
  try {
    const unenc = await PDFDocument.load(protectedBytes);
    if (!unenc.isEncrypted) openedWithoutPass = true;
  } catch {
    openedWithoutPass = false;
  }
  assert.strictEqual(openedWithoutPass, false, "Protected PDF must reject opening without password");

  const openedWithPass = await PDFDocument.load(protectedBytes, { password: protectPassword });
  assert.strictEqual(openedWithPass.getPageCount(), 1, "Protected PDF must open with correct password");
  console.log("✅ [PASS] Test 1: Protect PDF successfully encrypted after restart/cache wipe!");

  // ===========================================================================
  // TEST 2 — Unlock Restart (Memory Cache Cleared -> Worker Decrypts Secret)
  // ===========================================================================
  console.log("\n---------------------------------------------------------------");
  console.log("▶ [TEST 2] Unlock PDF After Full In-Memory Cache Wipe");
  console.log("---------------------------------------------------------------");

  const unlockJobDto = await jobService.createJob(testUser.id, {
    tool: "unlock-pdf",
    inputFileIds: [finalProtectJob.outputFile.id],
    options: {
      password: protectPassword,
    },
  });

  // SIMULATE SERVER REBOOT: Wipe executionOptionsCache
  jobService.clearExecutionOptions(unlockJobDto.id);
  freshWorker.notify();

  let finalUnlockJob: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 300));
    finalUnlockJob = await prisma.job.findUnique({
      where: { id: unlockJobDto.id },
      include: { outputFile: true },
    });
    if (finalUnlockJob?.status === JobStatus.COMPLETED) break;
  }

  assert.strictEqual(finalUnlockJob?.status, JobStatus.COMPLETED, "Unlock job must complete after cache wipe");
  assert(finalUnlockJob.outputFile, "Unlock job must produce output file");

  // Verify that the resulting PDF is clean and unencrypted
  const unlockedOutPath = path.resolve(storageService.getStorageRoot(), finalUnlockJob.outputFile.storageKey);
  const unlockedBytes = fs.readFileSync(unlockedOutPath);
  const unlockedDoc = await PDFDocument.load(unlockedBytes);
  assert.strictEqual(unlockedDoc.getPageCount(), 1, "Unlocked PDF must open cleanly without password");
  console.log("✅ [PASS] Test 2: Unlock PDF successfully decrypted and completed after restart/cache wipe!");

  // ===========================================================================
  // TEST 3 — Wrong Password Handling
  // ===========================================================================
  console.log("\n---------------------------------------------------------------");
  console.log("▶ [TEST 3] Unlock PDF With Wrong Password (INVALID_PDF_PASSWORD)");
  console.log("---------------------------------------------------------------");

  const wrongPasswordJobDto = await jobService.createJob(testUser.id, {
    tool: "unlock-pdf",
    inputFileIds: [finalProtectJob.outputFile.id],
    options: {
      password: "WrongPassword999!",
    },
  });

  jobService.clearExecutionOptions(wrongPasswordJobDto.id);
  freshWorker.notify();

  let finalWrongJob: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 300));
    finalWrongJob = await prisma.job.findUnique({
      where: { id: wrongPasswordJobDto.id },
    });
    if (finalWrongJob?.status === JobStatus.FAILED) break;
  }

  assert.strictEqual(finalWrongJob?.status, JobStatus.FAILED, "Job with incorrect password must fail");
  assert(
    finalWrongJob.errorCode === "INVALID_PDF_PASSWORD" ||
      finalWrongJob.errorMessage?.includes("password"),
    "Failure must indicate invalid password"
  );
  console.log("✅ [PASS] Test 3: Wrong password correctly handled and transitioned to FAILED!");

  // ===========================================================================
  // TEST 4 — Secret DB Inspection & Public API Redaction
  // ===========================================================================
  console.log("\n---------------------------------------------------------------");
  console.log("▶ [TEST 4] Database & Public API Secret Redaction Inspection");
  console.log("---------------------------------------------------------------");

  // 1. Inspect Protect Job in Database
  const dbProtectJob = await prisma.job.findUnique({ where: { id: protectJobDto.id } });
  assert(dbProtectJob, "Protect job must exist in database");

  assert(
    !dbProtectJob.options?.includes(protectPassword),
    "Job.options column MUST NOT contain plaintext password"
  );
  assert(
    !dbProtectJob.options?.includes("userPassword"),
    "Job.options column MUST NOT contain 'userPassword' key"
  );
  assert(
    !dbProtectJob.options?.includes("password"),
    "Job.options column MUST NOT contain 'password' key"
  );

  // Verify secretOptions is encrypted AES-256-GCM (iv:authTag:ciphertext)
  assert(dbProtectJob.secretOptions, "Job.secretOptions MUST be populated for protect jobs");
  const secretParts = dbProtectJob.secretOptions.split(":");
  assert.strictEqual(secretParts.length, 3, "Job.secretOptions must be in iv:authTag:ciphertext format");
  assert(
    !dbProtectJob.secretOptions.includes(protectPassword),
    "Job.secretOptions MUST NOT contain plaintext password"
  );

  // 2. Inspect Unlock Job in Database
  const dbUnlockJob = await prisma.job.findUnique({ where: { id: unlockJobDto.id } });
  assert(dbUnlockJob, "Unlock job must exist in database");
  assert(!dbUnlockJob.options?.includes(protectPassword), "Unlock Job.options MUST NOT contain password");
  assert(dbUnlockJob.secretOptions, "Unlock Job.secretOptions MUST be populated");
  assert(!dbUnlockJob.secretOptions.includes(protectPassword), "secretOptions MUST NOT contain plaintext");

  // 3. Inspect Public API DTO Response
  const publicDto = await jobService.getJobById(testUser.id, protectJobDto.id);
  assert.strictEqual(
    (publicDto as any).secretOptions,
    undefined,
    "Public IJobDto API response MUST NOT expose secretOptions"
  );
  assert.strictEqual(
    (publicDto as any).options?.userPassword,
    undefined,
    "Public IJobDto API response MUST NOT expose userPassword"
  );

  console.log("✅ [PASS] Test 4: Database and API inspection confirmed zero plaintext secrets leak!");

  // Clean shutdown of worker
  await freshWorker.stop(2000);

  console.log("\n===============================================================");
  console.log("🎉 ALL DURABLE WORKER RESTART & SECRET TESTS PASSED (5/5)!");
  console.log("===============================================================");
}

runWorkerRestartTest().catch((err) => {
  console.error("❌ Worker Restart Test Failed:", err);
  process.exit(1);
});
