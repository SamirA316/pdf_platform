import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";
import { requireStrictAuth, AuthRequest } from "../../middlewares/auth.middleware";
import { filesService } from "../files/files.service";

const router = Router();

/**
 * GET /api/v1/usage
 * Authenticated endpoint returning actual user storage usage, quota, and plan status.
 */
router.get("/", requireStrictAuth, async (req: AuthRequest, res, next) => {
  try {
    const quota = await filesService.getUserStorageQuota(req.user!.id);
    sendSuccess(res, {
      storage: quota,
      plan: "beta_free",
      description: "QuickPDF Free Beta tier",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
