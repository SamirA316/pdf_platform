import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";

const router = Router();

/**
 * PDF Module Foundation (/api/v1/pdf)
 * Core PDF manipulations (merge, split, compress, protect, rotate, etc.) foundation.
 */
router.get("/", (req, res) => {
  sendSuccess(res, {
    module: "pdf",
    status: "foundation",
    description: "PDF document manipulation and conversion module foundation",
  });
});

export default router;
