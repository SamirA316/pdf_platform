import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PDFDocument as CantooPDF, EncryptedPDFError, rgb } from "@cantoo/pdf-lib";
import sharp from "sharp";
import JSZip from "jszip";
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

async function createSampleScannedPdf(): Promise<Buffer> {
  const svgImage = `
  <svg width="400" height="300">
    <rect x="0" y="0" width="400" height="300" fill="white" />
    <text x="10" y="50" font-family="Arial" font-size="24" fill="black">HELLO WORLD OCR TEST DATA</text>
  </svg>
  `;
  const imgBuffer = await sharp(Buffer.from(svgImage)).jpeg().toBuffer();
  const pdfDoc = await CantooPDF.create();
  const image = await pdfDoc.embedJpg(imgBuffer);
  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
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

  const scannedPdfBuffer = await createSampleScannedPdf();
  const scannedPdfFile = await registerFile("sample-scanned.pdf", scannedPdfBuffer, "application/pdf");

  const samplePdf2Bytes = await createSamplePdf("Second Document for Comparison", 2);
  const pdfFile2 = await registerFile("sample2.pdf", Buffer.from(samplePdf2Bytes), "application/pdf");

  const sampleImgBuffer = await createSampleImage();
  const imgFile = await registerFile("sample.jpg", sampleImgBuffer, "image/jpeg");

  const docxFile = await registerFile("sample.docx", fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.docx')), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const xlsxFile = await registerFile("sample.xlsx", fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.xlsx')), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const pptxFile = await registerFile("sample.pptx", fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.pptx')), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  const htmlFile = await registerFile("sample.html", fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.html')), "text/html");

  const results: Record<string, boolean> = {};

  async function testJob(slug: string, inputFiles: string[], options: Record<string, any> = {}, timeoutMs = 30000): Promise<string | null> {
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
      while (!finished && Date.now() - start < timeoutMs) {
        const j = await jobService.getJobById(user.id, job.id);
        if (j.status === "COMPLETED") {
          finished = true;
          // Verify output
          if (!j.outputFileId) {
            results[slug] = false;
            console.log(`❌ FAILED: Job COMPLETED but no outputFileId`);
            return null;
          }
          const outFile = await prisma.file.findUnique({ where: { id: j.outputFileId } });
          if (!outFile || outFile.size === 0) {
            results[slug] = false;
            console.log(`❌ FAILED: Output file DB record missing or size 0`);
            return null;
          }
          // Note: local storage service might use AWS S3 in production, but we assume local file path for test
          if (outFile.storageKey.startsWith("users/")) {
            const { physicalPath: outPath } = storageService.resolveStorageKey(outFile.storageKey);
            if (!outPath || !fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
              results[slug] = false;
              console.log(`❌ FAILED: Physical output file missing or empty`);
              return null;
            }

            // Output format validation
            try {
              if (outFile.mimeType === 'application/pdf') {
                const doc = await CantooPDF.load(fs.readFileSync(outPath), { ignoreEncryption: true });
                if (doc.getPageCount() <= 0) throw new Error("PDF has no pages");
                
                if (slug === 'ocr-pdf') {
                  // Wait for 1 second before testing since some extractors might need time to flush although fs sync is used
                  const parsed = await require('../src/modules/pdf/utils/pdf-text-extractor').extractPdfText(outPath);
                  if (!parsed.text || parsed.text.trim().length === 0) {
                     throw new Error("Searchable text missing in OCR output");
                  }
                }

                if (slug === 'protect-pdf') {
                  let isEncrypted = false;
                  try {
                    await CantooPDF.load(fs.readFileSync(outPath));
                  } catch (err: any) {
                    if (err instanceof EncryptedPDFError || (err.message && err.message.includes("encrypted"))) {
                      isEncrypted = true;
                    }
                  }
                  if (!isEncrypted) {
                    throw new Error("Protected PDF is not actually encrypted");
                  }
                }
              } else if (outFile.mimeType.startsWith('image/')) {
                const metadata = await sharp(outPath).metadata();
                if (!metadata.width || !metadata.height) throw new Error("Invalid image metadata");
              } else if (outFile.mimeType === 'application/zip' || outFile.mimeType.includes('officedocument') || outFile.mimeType.includes('wordprocessingml') || outFile.mimeType.includes('spreadsheetml') || outFile.mimeType.includes('presentationml')) {
                const header = fs.readFileSync(outPath).toString('hex', 0, 4);
                if (header !== '504b0304') throw new Error("Invalid ZIP/Office document format (header mismatch)");
                const zip = new JSZip();
                await zip.loadAsync(fs.readFileSync(outPath));
                if (outFile.mimeType.includes('wordprocessingml') && !zip.file('word/document.xml')) {
                  throw new Error("Invalid DOCX format: missing word/document.xml");
                }
                if (outFile.mimeType.includes('spreadsheetml') && !zip.file('xl/workbook.xml')) {
                  throw new Error("Invalid XLSX format: missing xl/workbook.xml");
                }
                if (outFile.mimeType.includes('presentationml') && !zip.file('ppt/presentation.xml')) {
                  throw new Error("Invalid PPTX format: missing ppt/presentation.xml");
                }
                if (outFile.mimeType.includes('presentationml') && slug === 'pdf-to-powerpoint') {
                  if (!zip.file('ppt/slides/slide1.xml')) {
                    throw new Error("Invalid PPTX: missing ppt/slides/slide1.xml");
                  }
                }
              } else if (outFile.mimeType === 'text/markdown') {
                const content = fs.readFileSync(outPath, 'utf8');
                if (!content.trim()) throw new Error("Empty markdown file");
              }
            } catch (err: any) {
              results[slug] = false;
              console.log(`❌ FAILED: Output format validation failed: ${err.message}`);
              return null;
            }
          }
          results[slug] = true;
          console.log(`✅ COMPLETED (Output ID: ${j.outputFileId}, Size: ${outFile.size})`);
          return j.outputFileId;
        } else if (j.status === "FAILED") {
          finished = true;
          const genericMsg = "We couldn't process this PDF. Please try another file.";
          if (["ai-summarizer", "translate-pdf", "chat-with-pdf"].includes(slug) && 
              (j.errorMessage === genericMsg || j.errorMessage?.includes("429") || j.errorMessage?.includes("API") || j.errorMessage?.includes("auth") || j.errorMessage?.includes("quota"))) {
            if (process.env.OPENAI_API_KEY) {
              results[slug] = false;
              console.log(`❌ NOT CERTIFIED: AI API Quota / Key present but exhausted: ${j.errorMessage}`);
            } else {
              results[slug] = false;
              console.log(`❌ NOT CERTIFIED: OPENAI_API_KEY missing: ${j.errorMessage}`);
            }
          } else if (["word-to-pdf", "excel-to-pdf", "powerpoint-to-pdf"].includes(slug) && 
              (j.errorMessage === genericMsg || j.errorMessage?.includes("LibreOffice"))) {
            results[slug] = false;
            console.log(`❌ NOT CERTIFIED: LibreOffice unavailable: ${j.errorMessage}`);
          } else {
            results[slug] = false;
            console.log(`❌ FAILED: ${j.errorMessage}`);
          }
          return null;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!finished) {
        results[slug] = false;
        console.log(`❌ TIMEOUT (${timeoutMs}ms)`);
      }
    } catch (e: any) {
      results[slug] = false;
      console.log(`❌ EXCEPTION: ${e.message}`);
    }
    return null;
  }

  try {
    const toolsToTest = [
      { slug: "merge-pdf", inputs: [pdfFile.id, pdfFile2.id], opts: {}, t: 30000 },
      { slug: "split-pdf", inputs: [pdfFile.id], opts: { mode: "ranges", ranges: [{start: 1, end: 1}] }, t: 30000 },
      { slug: "compress-pdf", inputs: [pdfFile.id], opts: {}, t: 60000 },
      { slug: "rotate-pdf", inputs: [pdfFile.id], opts: { angle: 90 }, t: 30000 },
      { slug: "organize-pdf", inputs: [pdfFile.id], opts: { pages: [{sourcePage: 2}, {sourcePage: 1}] }, t: 30000 },
      { slug: "resize-pdf", inputs: [pdfFile.id], opts: { size: "a4" }, t: 30000 },
      { slug: "watermark", inputs: [pdfFile.id], opts: { text: "DRAFT" }, t: 30000 },
      { slug: "page-numbers", inputs: [pdfFile.id], opts: {}, t: 30000 },
      { slug: "protect-pdf", inputs: [pdfFile.id], opts: { password: "test" }, t: 30000 },
      // unlock-pdf will be chained manually later
      { slug: "repair-pdf", inputs: [pdfFile.id], opts: {}, t: 60000 },
      { slug: "pdf-to-pdfa", inputs: [pdfFile.id], opts: {}, t: 60000 },
      
      { slug: "edit-pdf", inputs: [pdfFile.id], opts: {}, t: 30000 },
      { slug: "pdf-to-word", inputs: [pdfFile.id], opts: {}, t: 60000 },
      { slug: "pdf-to-excel", inputs: [pdfFile.id], opts: {}, t: 60000 },
      { slug: "word-to-pdf", inputs: [docxFile.id], opts: {}, t: 120000 },
      { slug: "excel-to-pdf", inputs: [xlsxFile.id], opts: {}, t: 120000 },
      { slug: "powerpoint-to-pdf", inputs: [pptxFile.id], opts: {}, t: 120000 },
      { slug: "pdf-to-jpg", inputs: [pdfFile.id], opts: {}, t: 60000 },
      { slug: "pdf-to-png", inputs: [pdfFile.id], opts: {}, t: 60000 },
      { slug: "jpg-to-pdf", inputs: [imgFile.id], opts: {}, t: 30000 },
      { slug: "html-to-pdf", inputs: [htmlFile.id], opts: {}, t: 60000 },
      
      { slug: "sign-pdf", inputs: [pdfFile.id], opts: { signatureText: "Samir Ansari" }, t: 30000 },
      { slug: "scan-to-pdf", inputs: [imgFile.id], opts: {}, t: 60000 },
      { slug: "compare-pdf", inputs: [pdfFile.id, pdfFile2.id], opts: {}, t: 60000 },
      { slug: "redact-pdf", inputs: [pdfFile.id], opts: { redactionText: "Confidential" }, t: 60000 },
      { slug: "crop-pdf", inputs: [pdfFile.id], opts: { cropMargin: 20 }, t: 30000 },
      { slug: "pdf-forms", inputs: [pdfFile.id], opts: { flatten: true }, t: 60000 },
      
      { slug: "ai-summarizer", inputs: [pdfFile.id], opts: {}, t: 120000 },
      { slug: "translate-pdf", inputs: [pdfFile.id], opts: { targetLanguage: "Spanish" }, t: 120000 },
      { slug: "pdf-to-markdown", inputs: [pdfFile.id], opts: {}, t: 60000 },
      { slug: "chat-with-pdf", inputs: [pdfFile.id], opts: { question: "What is this document about?" }, t: 120000 },
      
      { slug: "ocr-pdf", inputs: [scannedPdfFile.id], opts: { language: "eng" }, t: 120000 },
      { slug: "pdf-to-powerpoint", inputs: [pdfFile.id], opts: {}, t: 120000 }
    ];

    let protectedPdfOutputId: string | null = null;

    for (const t of toolsToTest) {
      const outputId = await testJob(t.slug, t.inputs, t.opts, t.t);
      if (t.slug === "protect-pdf") protectedPdfOutputId = outputId;
    }

    if (protectedPdfOutputId) {
      await testJob("unlock-pdf", [protectedPdfOutputId], { password: "test" }, 30000);
    } else {
      results["unlock-pdf"] = false;
      console.log(`❌ FAILED: unlock-pdf skipped because protect-pdf failed to generate an output`);
    }

    const EXPECTED_TOOL_COUNT = 34;
    console.log("\n===============================================================================");
    console.log("📊 ALL TOOLS VERIFICATION SUMMARY:");
    let passed = 0;
    let total = 0;
    for (const [tool, ok] of Object.entries(results)) {
      total++;
      if (ok) passed++;
      console.log(`  - ${tool.padEnd(20)}: ${ok ? "PASSED ✅" : "FAILED ❌"}`);
    }
    console.log(`Total: ${passed}/${total} tools passed (Catalog: ${EXPECTED_TOOL_COUNT}).`);
    console.log("===============================================================================");

    if (passed === EXPECTED_TOOL_COUNT && total === EXPECTED_TOOL_COUNT) {
      process.exitCode = 0;
    } else {
      console.error(`❌ Suite failed: Expected ${EXPECTED_TOOL_COUNT} passing tools, but got ${passed}/${total}`);
      process.exitCode = 1;
    }
  } finally {
    // Cleanup
    jobWorker.stop();
    await prisma.job.deleteMany({ where: { userId: user.id } });
    await prisma.file.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    try {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

// Only exit if this file is run directly
if (require.main === module) {
  runAllToolsSuite().then(() => {
    // allow event loop to exit naturally after process.exitCode is set
  }).catch((err) => {
    console.error("Test suite crashed:", err);
    process.exitCode = 1;
  });
}
