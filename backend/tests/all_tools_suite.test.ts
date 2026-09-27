import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PDFDocument as CantooPDF, rgb } from "@cantoo/pdf-lib";
import sharp from "sharp";
import { prisma } from "../src/common/prisma";
import { app } from "../src/server";
import { jobWorker } from "../src/workers/job.worker";
import { jobService } from "../src/modules/jobs/job.service";
import { storageService } from "../src/modules/files/storage.service";

async function createSamplePdf(text: string, pages: number = 2): Promise<Uint8Array> {
  const doc = await CantooPDF.create();
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`${text} (Page ${i})`, {
      x: 50,
      y: 750,
      size: 18,
      color: rgb(0.1, 0.4, 0.8),
    });
  }
  return await doc.save({ useObjectStreams: false });
}

async function createSampleImage(): Promise<Buffer> {
  return await sharp({
    create: {
      width: 400,
      height: 300,
      channels: 3,
      background: { r: 66, g: 133, b: 244 },
    },
  })
    .jpeg()
    .toBuffer();
}

async function runAllToolsSuite() {
  console.log("===============================================================================");
  console.log("🚀 TESTING COMPREHENSIVE TOOLS SUITE (ZERO COMING SOON TOOLS)");
  console.log("===============================================================================");

  // Ensure worker is started
  jobWorker.start();

  // Create a mock user
  const user = await prisma.user.create({
    data: {
      name: "Tools Suite Tester",
      email: `tools_test_${Date.now()}@example.com`,
      password: "hashed_dummy_password",
      isVerified: true,
    },
  });

  const uploadDir = storageService.getUserStorageDir(user.id);
  fs.mkdirSync(uploadDir, { recursive: true });

  // Helper to register a test file in DB and disk
  async function registerFile(name: string, buffer: Buffer, mime: string) {
    const filename = `file_${crypto.randomBytes(8).toString("hex")}_${name}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    return await prisma.file.create({
      data: {
        userId: user.id,
        originalName: name,
        mimeType: mime,
        size: buffer.length,
        storageKey: `users/${user.id}/${filename}`,
        status: "READY",
      },
    });
  }

  const samplePdfBytes = await createSamplePdf("Sample Test PDF Content for All Tools", 2);
  const samplePdfBuffer = Buffer.from(samplePdfBytes);
  const pdfFile = await registerFile("sample.pdf", samplePdfBuffer, "application/pdf");

  const samplePdf2Bytes = await createSamplePdf("Second Document for Comparison", 2);
  const pdfFile2 = await registerFile("sample2.pdf", Buffer.from(samplePdf2Bytes), "application/pdf");

  const sampleImgBuffer = await createSampleImage();
  const imgFile = await registerFile("sample.jpg", sampleImgBuffer, "image/jpeg");

  const results: Record<string, boolean> = {};

  async function testJob(slug: string, inputFiles: string[], options: Record<string, any> = {}) {
    process.stdout.write(`Testing [${slug}]... `);
    try {
      const job = await jobService.createJob(user.id, {
        tool: slug,
        inputFileIds: inputFiles,
        options,
      });

      // Poll job until complete or timeout
      let finished = false;
      const start = Date.now();
      while (!finished && Date.now() - start < 30000) {
        const j = await jobService.getJobById(user.id, job.id);
        if (j.status === "COMPLETED") {
          finished = true;
          results[slug] = true;
          console.log(`✅ COMPLETED (Output ID: ${j.outputFileId})`);
          return;
        } else if (j.status === "FAILED") {
          finished = true;
          results[slug] = false;
          console.log(`❌ FAILED: ${j.errorMessage}`);
          return;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!finished) {
        results[slug] = false;
        console.log(`❌ TIMEOUT`);
      }
    } catch (e: any) {
      results[slug] = false;
      console.log(`❌ EXCEPTION: ${e.message}`);
    }
  }

  // Run tests for tools
  await testJob("jpg-to-pdf", [imgFile.id]);
  await testJob("scan-to-pdf", [imgFile.id]);
  await testJob("pdf-to-jpg", [pdfFile.id]);
  await testJob("pdf-to-png", [pdfFile.id]);
  await testJob("pdf-to-markdown", [pdfFile.id]);
  await testJob("crop-pdf", [pdfFile.id], { cropMargin: 20 });
  await testJob("sign-pdf", [pdfFile.id], { signatureText: "Samir Ansari" });
  await testJob("redact-pdf", [pdfFile.id], { redactionText: "Confidential" });
  await testJob("pdf-forms", [pdfFile.id], { flatten: true });
  await testJob("compare-pdf", [pdfFile.id, pdfFile2.id]);
  await testJob("pdf-to-word", [pdfFile.id]);
  await testJob("pdf-to-excel", [pdfFile.id]);
  await testJob("pdf-to-powerpoint", [pdfFile.id]);
  await testJob("ocr-pdf", [pdfFile.id]);
  await testJob("ai-summarizer", [pdfFile.id]);
  await testJob("translate-pdf", [pdfFile.id], { targetLanguage: "Spanish" });
  await testJob("chat-with-pdf", [pdfFile.id], { question: "What is this document about?" });

  console.log("\n===============================================================================");
  console.log("📊 ALL TOOLS VERIFICATION SUMMARY:");
  let passed = 0;
  let total = 0;
  for (const [tool, ok] of Object.entries(results)) {
    total++;
    if (ok) passed++;
    console.log(`  - ${tool.padEnd(20)}: ${ok ? "PASSED ✅" : "FAILED ❌"}`);
  }
  console.log(`Total: ${passed}/${total} tools passed.`);
  console.log("===============================================================================");

  // Cleanup
  jobWorker.stop();
  await prisma.job.deleteMany({ where: { userId: user.id } });
  await prisma.file.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAllToolsSuite().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
