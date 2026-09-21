import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";

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

export default router;
