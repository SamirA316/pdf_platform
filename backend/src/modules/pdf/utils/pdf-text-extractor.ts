import { spawn } from "child_process";

export interface IPdfExtractedText {
  text: string;
  numpages: number;
}

/**
 * Isolated PDF text extraction using native node child process.
 * This guarantees TSX/esbuild AST transformers do not corrupt the bundled webpack runtime of pdf-parse.
 */
export async function extractPdfText(pdfPath: string): Promise<IPdfExtractedText> {
  return new Promise((resolve, reject) => {
    const script = `
      const fs = require('fs');
      const pdf = require('pdf-parse');
      const filePath = process.argv[1];
      const buf = fs.readFileSync(filePath);
      pdf(buf).then(d => {
        process.stdout.write(JSON.stringify({ text: d.text || '', numpages: d.numpages || 1 }));
      }).catch(e => {
        process.stderr.write(e.message || String(e));
        process.exit(1);
      });
    `;

    const child = spawn("node", ["-e", script, pdfPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        // Return empty text with 1 page fallback rather than crashing
        resolve({ text: "", numpages: 1 });
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch {
        resolve({ text: stdout, numpages: 1 });
      }
    });

    child.on("error", () => {
      resolve({ text: "", numpages: 1 });
    });
  });
}
