import { Router } from "express";
import { requireStrictAuth } from "../../middlewares/auth.middleware";
import { jobController } from "./job.controller";

const router = Router();

/**
 * PDF Job Processing Routes (/api/v1/jobs)
 * All endpoints strictly require authentication.
 */

// 1. Create Job
router.post(
  "/",
  requireStrictAuth,
  (req, res, next) => jobController.createJob(req, res, next)
);

// 2. List Jobs
router.get(
  "/",
  requireStrictAuth,
  (req, res, next) => jobController.listJobs(req, res, next)
);

// 3. Cancel Job (Must be before /:jobId parameter catch-all if needed, but route has /cancel suffix)
router.post(
  "/:jobId/cancel",
  requireStrictAuth,
  (req, res, next) => jobController.cancelJob(req, res, next)
);

// 4. Get Single Job Details
router.get(
  "/:jobId",
  requireStrictAuth,
  (req, res, next) => jobController.getJob(req, res, next)
);

// 5. Delete Job from History
router.delete(
  "/:jobId",
  requireStrictAuth,
  (req, res, next) => jobController.deleteJob(req, res, next)
);

export default router;
