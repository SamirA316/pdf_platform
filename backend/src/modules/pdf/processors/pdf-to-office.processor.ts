import path from "path";
import fs from "fs";
import crypto from "crypto";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { prisma } from "../../../common/prisma";
import { filesService } from "../../files/files.service";
import { storageService } from "../../files/storage.service";
import {
  ProcessingFailedError,
  FileNotFoundError,
} from "../../../common/errors/AppError";
import { logger } from "../../../common/logger";
import { extractPdfText } from "../utils/pdf-text-extractor";

export interface IPdfToOfficeJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  tool: "pdf-to-word" | "pdf-to-excel" | "pdf-to-powerpoint";
  options?: Record<string, any>;
}

export interface IPdfToOfficeJobResult {
  outputFileId: string;
  metrics: {
    pageCount: number;
    outputSize: number;
  };
}

export class PdfToOfficeProcessor {
  async process(params: IPdfToOfficeJobParams): Promise<IPdfToOfficeJobResult> {
    const { jobId, userId, inputFileId, tool } = params;

    if (!inputFileId) throw new ProcessingFailedError("Input file ID is required.");

    const dbFile = await prisma.file.findFirst({
      where: { id: inputFileId, userId },
    });
    if (!dbFile) throw new FileNotFoundError(`Input file ID '${inputFileId}' not found.`);

    const uploadBase = storageService.getStorageRoot();
    const physicalPath = path.resolve(uploadBase, dbFile.storageKey);
    if (!fs.existsSync(physicalPath)) {
      throw new FileNotFoundError(`Physical input file not found on disk.`);
    }

    const userDir = storageService.getUserStorageDir(userId);
    const randomHex = crypto.randomBytes(8).toString("hex");
    const baseName = dbFile.originalName.replace(/\.[^/.]+$/, "") || "document";
    let physicalOutputPath = "";

    try {
      logger.info(`[JOB] Processing ${jobId}: Converting ${tool} from '${dbFile.originalName}'`, "JOB");

      const parsed = await extractPdfText(physicalPath);
      const fullText: string = parsed.text || "";
      const lines = fullText.split("\n").map((l: string) => l.trim()).filter(Boolean);

      let outputFilename = "";
      let outputMime = "";

      if (tool === "pdf-to-excel") {
        outputFilename = `${baseName}.xlsx`;
        outputMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const diskFile = `file_${randomHex}.xlsx`;
        physicalOutputPath = path.join(userDir, diskFile);

        const rows: string[][] = [];
        for (const line of lines) {
          const cols = line.split(/\t+|\s{2,}|,\s*/);
          rows.push(cols);
        }
        if (rows.length === 0) rows.push(["Content"]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Extracted Data");
        XLSX.writeFile(wb, physicalOutputPath);

      } else if (tool === "pdf-to-word") {
        outputFilename = `${baseName}.docx`;
        outputMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const diskFile = `file_${randomHex}.docx`;
        physicalOutputPath = path.join(userDir, diskFile);

        const zip = new JSZip();
        zip.file(
          "[Content_Types].xml",
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
          </Types>`
        );

        zip.file(
          "_rels/.rels",
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
          </Relationships>`
        );

        let paragraphsXml = "";
        for (const line of lines) {
          const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          paragraphsXml += `<w:p><w:r><w:t>${escaped}</w:t></w:r></w:p>`;
        }

        zip.file(
          "word/document.xml",
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
              ${paragraphsXml}
            </w:body>
          </w:document>`
        );

        const docxBuffer = await zip.generateAsync({ type: "nodebuffer" });
        await fs.promises.writeFile(physicalOutputPath, docxBuffer);

      } else {
        // pdf-to-powerpoint: render each PDF page to PNG via Puppeteer, embed in valid PPTX OOXML
        outputFilename = `${baseName}.pptx`;
        outputMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        const diskFile = `file_${randomHex}.pptx`;
        physicalOutputPath = path.join(userDir, diskFile);

        const pdfBuffer = await fs.promises.readFile(physicalPath);
        const pdfBase64 = pdfBuffer.toString("base64");

        let browser: any;
        const renderedImages: { width: number; height: number; dataB64: string }[] = [];

        try {
          const puppeteer = await import("puppeteer");
          browser = await puppeteer.default.launch({
            headless: true,
            args: ["--disable-dev-shm-usage"],
          });
          const page = await browser.newPage();
          await page.setRequestInterception(true);
          page.on("request", (req: any) => {
            if (req.url() === "http://localhost/") {
              req.respond({
                status: 200, contentType: "text/html",
                body: `<!DOCTYPE html><html><body style="margin:0;background:white;"><canvas id="c"></canvas><script type="module">import*as L from 'http://localhost/pdf.mjs';L.GlobalWorkerOptions.workerSrc='http://localhost/pdf.worker.mjs';window.L=L;</script></body></html>`
              });
            } else if (req.url().endsWith("pdf.mjs")) {
              req.respond({ status: 200, contentType: "application/javascript", body: fs.readFileSync(require.resolve("pdfjs-dist/build/pdf.min.mjs")) });
            } else if (req.url().endsWith("pdf.worker.mjs")) {
              req.respond({ status: 200, contentType: "application/javascript", body: fs.readFileSync(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs")) });
            } else { req.continue(); }
          });

          await page.goto("http://localhost/", { waitUntil: "networkidle0" });
          await page.waitForFunction("window.L !== undefined");

          const totalPages = await page.evaluate(async (b64: string) => {
            const raw = atob(b64);
            const u = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) u[i] = raw.charCodeAt(i);
            const pdf = await (window as any).L.getDocument({ data: u }).promise;
            (window as any)._pdf = pdf;
            return pdf.numPages;
          }, pdfBase64);

          if (totalPages === 0) throw new ProcessingFailedError("PDF has no pages.");

          const canvasHandle = await page.$("#c");
          if (!canvasHandle) throw new ProcessingFailedError("Canvas init failed.");

          for (let n = 1; n <= totalPages; n++) {
            const dims = await page.evaluate(async (num: number) => {
              const p = await (window as any)._pdf.getPage(num);
              const vp = p.getViewport({ scale: 1.5 });
              const c = document.getElementById("c") as HTMLCanvasElement;
              c.width = vp.width; c.height = vp.height;
              const ctx = c.getContext("2d")!;
              ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
              await p.render({ canvasContext: ctx, viewport: vp }).promise;
              return { width: Math.round(vp.width), height: Math.round(vp.height) };
            }, n);
            const imgBuf = (await canvasHandle.screenshot({ type: "png" })) as Buffer;
            renderedImages.push({ width: dims.width, height: dims.height, dataB64: imgBuf.toString("base64") });
          }

          await browser.close();
          browser = undefined;
        } catch (renderErr: any) {
          if (browser) await browser.close().catch(() => {});
          throw new ProcessingFailedError(`PDF page rendering failed: ${renderErr.message}`);
        }

        // Build valid PPTX OOXML package
        const EMU_PER_PX = 9525; // 1px = 9525 EMU at 96dpi
        const firstW = renderedImages[0]?.width ?? 960;
        const firstH = renderedImages[0]?.height ?? 540;
        const toEmu = (px: number) => Math.round(px * EMU_PER_PX);
        const slideWidthEmu = toEmu(firstW);
        const slideHeightEmu = toEmu(firstH);

        const zip = new JSZip();

        const slideOverrides = renderedImages.map((_, i) =>
          `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
        ).join("\n  ");

        zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`);

        zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

        const slideIdList = renderedImages.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("\n    ");
        const presRelsRefs = renderedImages.map((_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
        ).join("\n  ");

        zip.file("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdM1"/></p:sldMasterIdLst>
  <p:sldIdLst>
    ${slideIdList}
  </p:sldIdLst>
  <p:sldSz cx="${slideWidthEmu}" cy="${slideHeightEmu}" type="custom"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);

        zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presRelsRefs}
  <Relationship Id="rIdM1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rIdT1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`);

        zip.file("ppt/theme/theme1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr lastClr="000000" val="windowText"/></a:dk1>
      <a:lt1><a:sysClr lastClr="ffffff" val="window"/></a:lt1>
      <a:dk2><a:srgbClr val="44546A"/></a:dk2>
      <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
      <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
      <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
      <a:accent3><a:srgbClr val="A9D18E"/></a:accent3>
      <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
      <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
      <a:accent6><a:srgbClr val="70AD47"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`);

        zip.file("ppt/slideMasters/slideMaster1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>
  <p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
  <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle><a:lvl1pPr><a:defRPr lang="en-US"/></a:lvl1pPr></p:titleStyle>
    <p:bodyStyle><a:lvl1pPr><a:defRPr lang="en-US"/></a:lvl1pPr></p:bodyStyle>
    <p:otherStyle><a:lvl1pPr><a:defRPr lang="en-US"/></a:lvl1pPr></p:otherStyle>
  </p:txStyles>
</p:sldMaster>`);

        zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

        zip.file("ppt/slideLayouts/slideLayout1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`);

        zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

        // Individual slides — one per PDF page
        for (let i = 0; i < renderedImages.length; i++) {
          const img = renderedImages[i]!;
          const imgFilename = `image${i + 1}.png`;
          const wEmu = toEmu(img.width);
          const hEmu = toEmu(img.height);

          zip.file(`ppt/media/${imgFilename}`, img.dataB64, { base64: true });

          zip.file(`ppt/slides/slide${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/><a:chOff x="0" y="0"/><a:chExt cx="${wEmu}" cy="${hEmu}"/></a:xfrm></p:grpSpPr>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="Page ${i + 1}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`);

          zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imgFilename}"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
        }

        const pptxBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
        await fs.promises.writeFile(physicalOutputPath, pptxBuffer);
      }

      const stat = await fs.promises.stat(physicalOutputPath);
      const storageKey = `users/${userId}/${path.basename(physicalOutputPath)}`;

      const outputFile = await filesService.createFile(
        userId,
        outputFilename,
        storageKey,
        outputMime,
        stat.size,
        jobId
      );

      return {
        outputFileId: outputFile.id,
        metrics: {
          pageCount: parsed.numpages || 1,
          outputSize: stat.size,
        },
      };
    } catch (err: any) {
      if (physicalOutputPath && fs.existsSync(physicalOutputPath)) {
        try { await fs.promises.unlink(physicalOutputPath); } catch {}
      }
      throw err;
    }
  }
}

export const pdfToOfficeProcessor = new PdfToOfficeProcessor();
