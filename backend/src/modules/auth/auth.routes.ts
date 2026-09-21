import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";

const router = Router();

/**
 * Auth Module Foundation (/api/v1/auth)
 * Full migration scheduled for subsequent phases.
 */
router.get("/", (req, res) => {
  sendSuccess(res, {
    module: "auth",
    status: "foundation",
    description: "Authentication and session management module foundation",
  });
});

export default router;
