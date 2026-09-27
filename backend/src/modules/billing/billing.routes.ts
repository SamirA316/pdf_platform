import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";
import { requireStrictAuth } from "../../middlewares/auth.middleware";

const router = Router();

/**
 * GET /api/v1/billing
 * Honest billing status endpoint informing clients that billing is not active during Beta.
 */
router.get("/", requireStrictAuth, (_req, res) => {
  sendSuccess(res, {
    enabled: false,
    code: "BILLING_NOT_ENABLED",
    message: "Billing is not active during the public beta. All 12 core tools are free to use.",
    plan: "beta_free",
  });
});

export default router;
