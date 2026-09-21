import { Router } from "express";
import { sendSuccess } from "../../common/responses/apiResponse";

const router = Router();

/**
 * Editor Module Foundation (/api/v1/editor)
 * Interactive PDF editing, annotations, and signature management foundation.
 */
router.get("/", (req, res) => {
  sendSuccess(res, {
    module: "editor",
    status: "foundation",
    description: "Interactive PDF editing and canvas operations module foundation",
  });
});

export default router;
