import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";

const router = Router();

/**
 * Usage Module Foundation (/api/v1/usage)
 * User quotas, daily conversions, and tier rate-limit tracking foundation.
 */
router.get("/", (req, res) => {
  sendSuccess(res, {
    module: "usage",
    status: "foundation",
    description: "User quota and service usage tracking module foundation",
  });
});

export default router;
