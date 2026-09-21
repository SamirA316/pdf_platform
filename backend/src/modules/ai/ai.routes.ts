import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";

const router = Router();

/**
 * AI Module Foundation (/api/v1/ai)
 * Document intelligence, summarization, translation, and chat foundation.
 */
router.get("/", (req, res) => {
  sendSuccess(res, {
    module: "ai",
    status: "foundation",
    description: "Artificial intelligence and document analytics module foundation",
  });
});

export default router;
