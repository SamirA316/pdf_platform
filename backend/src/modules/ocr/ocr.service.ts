import { createWorker, Worker } from "tesseract.js";
import { logger } from "../../common/logger";

class OcrService {
  private worker: Worker | null = null;
  private initializingPromise: Promise<Worker> | null = null;

  private async getWorker(lang = "eng"): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }

    if (!this.initializingPromise) {
      this.initializingPromise = (async () => {
        try {
          const w = await createWorker(lang);
          this.worker = w;
          return w;
        } catch (err) {
          logger.error("Failed to initialize Tesseract OCR worker", "OCR", err as any);
          this.initializingPromise = null;
          throw err;
        }
      })();
    }

    return this.initializingPromise;
  }

  public async recognizeBase64Image(base64Data: string, lang = "eng"): Promise<string> {
    const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    try {
      const worker = await this.getWorker(lang);
      const { data } = await worker.recognize(buffer);
      return data.text ? data.text.trim() : "";
    } catch (err) {
      logger.warn("Tesseract recognize failed, attempting worker recreation...", "OCR");
      // Try recreating worker once
      try {
        if (this.worker) {
          await this.worker.terminate().catch(() => {});
          this.worker = null;
          this.initializingPromise = null;
        }
        const freshWorker = await this.getWorker(lang);
        const { data } = await freshWorker.recognize(buffer);
        return data.text ? data.text.trim() : "";
      } catch (retryErr) {
        logger.error("Tesseract retry also failed", "OCR", retryErr as any);
        throw retryErr;
      }
    }
  }
}

export const ocrService = new OcrService();
