import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";

const router = Router();

/**
 * Billing Module Foundation (/api/v1/billing)
 * Subscription plans, payment verification, and invoice foundation.
 */
router.get("/", (req, res) => {
  sendSuccess(res, {
    module: "billing",
    status: "foundation",
    description: "Subscription billing and plan management module foundation",
  });
});

export default router;
