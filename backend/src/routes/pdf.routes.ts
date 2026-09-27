import express from "express";

const router = express.Router();

/**
 * Legacy /api/pdf/* routes are strictly deprecated and disabled.
 * All PDF processing in production must execute through /api/v1/jobs.
 */
router.use((_req, res) => {
  res.status(410).json({
    error: "API_DEPRECATED",
    message: "Legacy /api/pdf processing is deprecated and disabled in production. All PDF processing must use /api/v1/jobs.",
  });
});

export default router;
