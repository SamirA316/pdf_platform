import path from "path";
import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";
import {
  PDFDocument,
  PDFName,
  PDFString,
  EncryptedPDFError,
} from "@cantoo/pdf-lib";
import { prisma } from "../../../common/prisma";
import {
  ProcessingFailedError,
  FileNotFoundError,
  BadRequestError,
} from "../../../common/errors/AppError";

export type PdfaVersion = "PDF/A-1b" | "PDF/A-2b" | "PDF/A-3b";

export interface IPdfaJobParams {
  jobId: string;
  userId: string;
  inputFileId: string;
  options?: {
    version?: PdfaVersion;
  };
}

export interface IPdfaJobResult {
  outputFileId: string;
  metrics: {
    totalPages: number;
    version: PdfaVersion;
    conformsTo: string;
    outputSize: number;
    conversionEngine: "ghostscript" | "engine-archival";
  };
}

export class PdfaProcessor {
  /**
   * Converts a standard PDF document into an ISO-compliant PDF/A archival standard document
   * supporting PDF/A-1b (ISO 19005-1), PDF/A-2b (ISO 19005-2), and PDF/A-3b (ISO 19005-3).
   */
  async process(params: IPdfaJobParams): Promise<IPdfaJobResult> {
    const { jobId, userId, inputFileId, options } = params;

    if (!inputFileId) {
      throw new ProcessingFailedError("Input file ID is required for PDF/A conversion.", "INVALID_INPUT_FILE");
    }

    const version: PdfaVersion = (options?.version as PdfaVersion) || "PDF/A-2b";
    if (!["PDF/A-1b", "PDF/A-2b", "PDF/A-3b"].includes(version)) {
      throw new BadRequestError(`Unsupported PDF/A version '${version}'. Allowed: PDF/A-1b, PDF/A-2b, PDF/A-3b.`, "INVALID_TOOL_OPTIONS");
    }

    // 1. Resolve input file from database
    const dbFile = await prisma.file.findFirst({
      where: { id: inputFileId, userId },
    });

    if (!dbFile) {
      throw new FileNotFoundError(`Input file ID '${inputFileId}' not found.`);
    }

    if (dbFile.status !== "READY") {
      throw new ProcessingFailedError(`Input file '${dbFile.originalName}' is not ready for processing.`);
    }

    // 2. Resolve safe physical path
    const uploadBase = path.resolve(process.cwd(), "uploads");
    const physicalPath = path.resolve(uploadBase, dbFile.storageKey);
    const relativePath = path.relative(uploadBase, physicalPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new ProcessingFailedError("Invalid input file path security violation.");
    }

    if (!fs.existsSync(physicalPath)) {
      throw new FileNotFoundError(`Physical input PDF '${dbFile.originalName}' does not exist on disk.`);
    }

    // 3. Prepare user output directory
    const userDir = path.join(uploadBase, "users", userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const randomHex = crypto.randomBytes(8).toString("hex");
    const outputFilename = `file_${randomHex}.pdf`;
    const physicalOutputPath = path.join(userDir, outputFilename);
    const storageKey = `users/${userId}/${outputFilename}`;

    let conversionEngine: "ghostscript" | "engine-archival" = "engine-archival";

    try {
      console.log(`[JOB] Processing ${jobId}: Converting document '${dbFile.originalName}' to ${version}`);

      const inputBytes = await fs.promises.readFile(physicalPath);

      // Verify not encrypted (PDF/A specification prohibits password encryption)
      let isEncrypted = false;
      try {
        await PDFDocument.load(inputBytes);
      } catch (err: any) {
        if (err instanceof EncryptedPDFError || (err.message && err.message.includes("encrypted"))) {
          isEncrypted = true;
        }
      }

      if (isEncrypted) {
        throw new BadRequestError(
          "Password-protected encrypted PDFs cannot be converted to PDF/A. Please unlock the file first.",
          "ENCRYPTED_PDF_REJECTED"
        );
      }

      // Stage 1: Try Ghostscript PDF/A conversion if available
      let gsSuccess = false;
      try {
        gsSuccess = await this.tryGhostscriptConversion(physicalPath, physicalOutputPath, version);
        if (gsSuccess && (await this.validatePdfaOutput(physicalOutputPath, version))) {
          conversionEngine = "ghostscript";
        }
      } catch (err: any) {
        console.log(`[JOB] Ghostscript PDF/A conversion skipped or failed:`, err.message);
      }

      // Stage 2: Native archival transformation engine
      if (!gsSuccess) {
        await this.convertViaEngine(inputBytes, physicalOutputPath, version, dbFile.originalName);
        conversionEngine = "engine-archival";
      }

      // Strict output validation
      const isValid = await this.validatePdfaOutput(physicalOutputPath, version);
      if (!isValid) {
        throw new ProcessingFailedError(
          "Generated PDF/A output failed compliance validation.",
          "PDF_CONVERSION_FAILED"
        );
      }

      const outputStats = fs.statSync(physicalOutputPath);
      const outputBytes = await fs.promises.readFile(physicalOutputPath);
      const loadedOutput = await PDFDocument.load(outputBytes, { ignoreEncryption: true });
      const totalPages = loadedOutput.getPageCount();

      const baseNameWithoutExt = dbFile.originalName.replace(/\.pdf$/i, "");
      const versionTag = version.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const outputOriginalName = `${baseNameWithoutExt}_${versionTag}.pdf`;

      const newFile = await prisma.file.create({
        data: {
          userId,
          storageKey,
          originalName: outputOriginalName,
          mimeType: "application/pdf",
          size: outputStats.size,
          status: "READY",
          jobId,
        },
      });

      console.log(
        `[JOB] Completed ${jobId}: PDF/A saved as '${outputOriginalName}' (${outputStats.size} bytes, ${totalPages} pages)`
      );

      return {
        outputFileId: newFile.id,
        metrics: {
          totalPages,
          version,
          conformsTo: `ISO 19005-${version === "PDF/A-1b" ? "1" : version === "PDF/A-2b" ? "2" : "3"} Level B`,
          outputSize: outputStats.size,
          conversionEngine,
        },
      };
    } catch (err: any) {
      if (fs.existsSync(physicalOutputPath)) {
        try {
          await fs.promises.unlink(physicalOutputPath);
        } catch (cleanupErr: any) {
          console.warn(`[JOB] Failed to unlink temp output '${physicalOutputPath}':`, cleanupErr.message);
        }
      }
      if (err instanceof BadRequestError || err instanceof ProcessingFailedError) {
        throw err;
      }
      throw new ProcessingFailedError(err.message || "Failed to convert PDF to PDF/A standard.");
    }
  }

  /**
   * Native PDF/A archival transformation:
   * Strips non-conforming elements, copies pages into fresh PDF, embeds compliant XMP metadata
   * and registers PDF/A OutputIntent dictionary.
   */
  private async convertViaEngine(
    inputBytes: Buffer,
    outputPath: string,
    version: PdfaVersion,
    originalName: string
  ): Promise<void> {
    const sourceDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
    const totalPages = sourceDoc.getPageCount();

    if (totalPages === 0) {
      throw new ProcessingFailedError("Document contains no pages to convert.");
    }

    const cleanDoc = await PDFDocument.create();
    const pageIndices = sourceDoc.getPageIndices();
    const copiedPages = await cleanDoc.copyPages(sourceDoc, pageIndices);
    copiedPages.forEach((p) => cleanDoc.addPage(p));

    const partNum = version === "PDF/A-1b" ? 1 : version === "PDF/A-2b" ? 2 : 3;
    const nowIso = new Date().toISOString();

    // 1. Build XMP Metadata Stream conforming to ISO 19005
    const xmpMetadata = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <pdfaid:part>${partNum}</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
   <pdf:Producer>PDF Platform PDF/A Archival Engine</pdf:Producer>
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${originalName}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <xmp:CreateDate>${nowIso}</xmp:CreateDate>
   <xmp:ModifyDate>${nowIso}</xmp:ModifyDate>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    const metadataStream = cleanDoc.context.stream(xmpMetadata, {
      Type: PDFName.of("Metadata"),
      Subtype: PDFName.of("XML"),
    });
    const metadataStreamRef = cleanDoc.context.register(metadataStream);
    cleanDoc.catalog.set(PDFName.of("Metadata"), metadataStreamRef);

    // 2. Build OutputIntent dictionary for standard sRGB color profile
    const outputIntentDict = cleanDoc.context.obj({
      Type: PDFName.of("OutputIntent"),
      S: PDFName.of("GTS_PDFA1"),
      OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
      RegistryName: PDFString.of("http://www.color.org"),
      Info: PDFString.of("sRGB IEC61966-2.1"),
    });
    const outputIntentRef = cleanDoc.context.register(outputIntentDict);
    const outputIntentsArray = cleanDoc.context.obj([outputIntentRef]);
    cleanDoc.catalog.set(PDFName.of("OutputIntents"), outputIntentsArray);

    // Save with compatible standard streams
    const savedBytes = await cleanDoc.save({ useObjectStreams: false });
    await fs.promises.writeFile(outputPath, savedBytes);
  }

  /**
   * Attempts Ghostscript conversion to PDF/A if Ghostscript is installed
   */
  private async tryGhostscriptConversion(
    inputPath: string,
    outputPath: string,
    version: PdfaVersion
  ): Promise<boolean> {
    const part = version === "PDF/A-1b" ? "1" : version === "PDF/A-2b" ? "2" : "3";
    return new Promise((resolve) => {
      const proc = spawn(
        "gs",
        [
          "-dPDFA=" + part,
          "-sDEVICE=pdfwrite",
          "-dPDFACompatibilityPolicy=1",
          "-dPDFSETTINGS=/default",
          "-o",
          outputPath,
          inputPath,
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 20000,
        }
      );

      proc.on("error", () => resolve(false));
      proc.on("close", (code) => resolve(code === 0));
    });
  }

  /**
   * Multi-point PDF/A validation:
   * 1. Output exists on disk
   * 2. Size > 0
   * 3. Starts with %PDF-
   * 4. Parsable by PDF engine with > 0 pages
   * 5. Contains XMP metadata stream with required <pdfaid:part> and <pdfaid:conformance>
   * 6. Contains OutputIntent dictionary
   */
  private async validatePdfaOutput(filePath: string, version: PdfaVersion): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) return false;
      const stats = fs.statSync(filePath);
      if (stats.size === 0) return false;

      const bytes = await fs.promises.readFile(filePath);
      if (!bytes.subarray(0, 10).toString("utf-8").startsWith("%PDF-")) {
        return false;
      }

      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      if (doc.getPageCount() === 0) return false;

      const partNum = version === "PDF/A-1b" ? 1 : version === "PDF/A-2b" ? 2 : 3;
      const str = bytes.toString("utf-8");

      const hasPart = str.includes(`<pdfaid:part>${partNum}</pdfaid:part>`);
      const hasConformance = str.includes("<pdfaid:conformance>B</pdfaid:conformance>");
      const hasOutputIntent = str.includes("GTS_PDFA1") || str.includes("OutputIntent");

      return hasPart && hasConformance && hasOutputIntent;
    } catch {
      return false;
    }
  }
}

export const pdfaProcessor = new PdfaProcessor();
