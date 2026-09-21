import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";

const router = Router();

/**
 * Admin Module Foundation (/api/v1/admin)
 * Platform analytics, user administration, and system audit logs foundation.
 */
router.get("/", (req, res) => {
  sendSuccess(res, {
    module: "admin",
    status: "foundation",
    description: "Platform administration and system monitoring module foundation",
  });
});

export default router;
