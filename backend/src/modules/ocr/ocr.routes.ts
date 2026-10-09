import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";
import { ocrService } from "./ocr.service";
import { BadRequestError } from "../../common/errors/AppError";

const router = Router();

/**
 * OCR Module Foundation (/api/v1/ocr)
 * Text recognition and scanned document processing foundation.
 */
router.get("/", (req, res) => {
  sendSuccess(res, {
    module: "ocr",
    status: "foundation",
    description: "Optical character recognition module foundation",
  });
});

/**
 * POST /api/v1/ocr/recognize
 * Fast OCR text recognition for PDF editor canvas crops
 */
router.post("/recognize", async (req, res, next) => {
  try {
    const { image, language } = req.body;
    if (!image || typeof image !== "string") {
      throw new BadRequestError("Image data (base64) is required for OCR recognition.");
    }

    const recognizedText = await ocrService.recognizeBase64Image(image, language || "eng");
    sendSuccess(res, {
      text: recognizedText,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
