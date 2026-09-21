import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";
import sharp from "sharp";
import zlib from "zlib";
import fs from "fs";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

export interface CompressOptions {
  level?: "extreme" | "recommended" | "less" | "custom" | string;
  customSize?: string;
}

export interface CompressResult {
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPercentage: number;
  imagesCompressed: number;
  methodUsed: "ghostscript" | "sharp-pure-node";
}

/**
 * Compresses a PDF file using Ghostscript if available, or a pure Node.js
 * sharp + pdf-lib image downscaling & stream re-compression pipeline.
 */
export async function compressPDFFile(
  inputPath: string,
  outputPath: string,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const originalSize = fs.statSync(inputPath).size;
  const level = options.level || "recommended";
  const customSize = options.customSize;

  let maxDimension = 1500;
  let quality = 60;
  let pdfSetting = "/ebook";

  if (level === "extreme") {
    maxDimension = 900;
    quality = 35;
    pdfSetting = "/screen";
  } else if (level === "less") {
    maxDimension = 2200;
    quality = 80;
    pdfSetting = "/printer";
  } else if (level === "custom" && customSize) {
    const match = String(customSize).match(/^(\d+(?:\.\d+)?)\s*(KB|MB)?$/i);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      const unit = (match[2] || "KB").toUpperCase();
      const targetBytes = unit === "MB" ? val * 1024 * 1024 : val * 1024;
      if (originalSize > 0 && targetBytes < originalSize) {
        const ratio = targetBytes / originalSize;
        if (ratio <= 0.25) {
          maxDimension = 800;
          quality = 30;
          pdfSetting = "/screen";
        } else if (ratio <= 0.5) {
          maxDimension = 1100;
          quality = 50;
          pdfSetting = "/ebook";
        } else if (ratio <= 0.75) {
          maxDimension = 1500;
          quality = 65;
          pdfSetting = "/ebook";
        } else {
          maxDimension = 2000;
          quality = 78;
          pdfSetting = "/printer";
        }
      }
    }
  }

  // 1. Try Ghostscript if installed on system
  let gsSuccess = false;
  try {
    await execPromise(
      `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${pdfSetting} -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`
    );
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      gsSuccess = true;
    }
  } catch {
    gsSuccess = false;
  }

  let imagesCompressed = 0;
  let methodUsed: "ghostscript" | "sharp-pure-node" = "ghostscript";

  if (!gsSuccess) {
    methodUsed = "sharp-pure-node";
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const indirectObjects = pdfDoc.context.enumerateIndirectObjects();

    for (const [, obj] of indirectObjects) {
      const streamObj = obj as any;
      if (!streamObj || !streamObj.dict || !streamObj.contents) continue;

      const subtype = streamObj.dict.get(PDFName.of("Subtype"));
      if (subtype !== PDFName.of("Image")) continue;

      // Skip 1-bit or CCITT Fax images (already extremely compressed raster)
      const filter = streamObj.dict.get(PDFName.of("Filter"));
      if (filter === PDFName.of("CCITTFaxDecode")) continue;

      const bitsObj = streamObj.dict.get(PDFName.of("BitsPerComponent"));
      const bits = typeof bitsObj?.asNumber === "function" ? bitsObj.asNumber() : undefined;
      if (bits === 1) continue;

      const isSMask = streamObj.dict.get(PDFName.of("ImageMask"))?.toString() === "true";
      if (isSMask) continue;

      const hasSMask = streamObj.dict.has(PDFName.of("SMask"));
      const rawBytes = Buffer.from(streamObj.contents);
      const originalLen = rawBytes.length;
      if (originalLen < 1024) continue; // Skip tiny icons / markers

      if (filter === PDFName.of("DCTDecode")) {
        try {
          const resizeOptions = hasSMask
            ? {} // Preserve exact pixel grid if soft-mask attached
            : { width: maxDimension, height: maxDimension, fit: "inside" as const, withoutEnlargement: true };

          const compressed = await sharp(rawBytes)
            .resize(resizeOptions)
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();

          if (compressed.length < originalLen) {
            const meta = await sharp(compressed).metadata();
            if (!hasSMask && meta.width && meta.height) {
              streamObj.dict.set(PDFName.of("Width"), PDFNumber.of(meta.width));
              streamObj.dict.set(PDFName.of("Height"), PDFNumber.of(meta.height));
            }
            streamObj.dict.set(PDFName.of("Length"), PDFNumber.of(compressed.length));
            streamObj.contents = compressed;
            imagesCompressed++;
          }
        } catch {
          // Keep original image if sharp decode/encode fails
        }
      } else if (filter === PDFName.of("FlateDecode")) {
        try {
          const widthObj = streamObj.dict.get(PDFName.of("Width"));
          const heightObj = streamObj.dict.get(PDFName.of("Height"));
          const width = typeof widthObj?.asNumber === "function" ? widthObj.asNumber() : undefined;
          const height = typeof heightObj?.asNumber === "function" ? heightObj.asNumber() : undefined;

          if (width && height && !hasSMask) {
            let uncompressed: Buffer;
            try {
              uncompressed = zlib.inflateSync(rawBytes);
            } catch {
              uncompressed = zlib.inflateRawSync(rawBytes);
            }

            let channels = 0;
            if (uncompressed.length === width * height * 3) channels = 3;
            else if (uncompressed.length === width * height * 4) channels = 4;
            else if (uncompressed.length === width * height * 1) channels = 1;

            if (channels > 0) {
              const compressed = await sharp(uncompressed, {
                raw: { width, height, channels: channels === 4 ? 4 : (channels === 1 ? 1 : 3) },
              })
                .resize({ width: maxDimension, height: maxDimension, fit: "inside" as const, withoutEnlargement: true })
                .jpeg({ quality, mozjpeg: true })
                .toBuffer();

              if (compressed.length < originalLen) {
                const meta = await sharp(compressed).metadata();
                streamObj.dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
                streamObj.dict.delete(PDFName.of("DecodeParms"));
                streamObj.dict.set(PDFName.of("ColorSpace"), PDFName.of(channels === 1 ? "DeviceGray" : "DeviceRGB"));
                streamObj.dict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));
                if (meta.width && meta.height) {
                  streamObj.dict.set(PDFName.of("Width"), PDFNumber.of(meta.width));
                  streamObj.dict.set(PDFName.of("Height"), PDFNumber.of(meta.height));
                }
                streamObj.dict.set(PDFName.of("Length"), PDFNumber.of(compressed.length));
                streamObj.contents = compressed;
                imagesCompressed++;
              }
            }
          }
        } catch {
          // Keep original stream
        }
      }
    }

    const savedPdfBytes = await pdfDoc.save({ useObjectStreams: true });
    fs.writeFileSync(outputPath, savedPdfBytes);
  }

  let finalSize = fs.statSync(outputPath).size;
  // If compressed output ended up larger than original (e.g. tiny pure-vector PDF), keep original
  if (finalSize > originalSize) {
    fs.copyFileSync(inputPath, outputPath);
    finalSize = originalSize;
  }

  const savedBytes = Math.max(0, originalSize - finalSize);
  const savedPercentage = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;

  return {
    outputPath,
    originalSize,
    compressedSize: finalSize,
    savedBytes,
    savedPercentage,
    imagesCompressed,
    methodUsed,
  };
}
