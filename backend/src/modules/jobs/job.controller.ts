import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { jobService } from "./job.service";
import { sendSuccess } from "../../common/responses/apiResponse";
import { UnauthorizedError } from "../../common/errors/AppError";

export class JobController {
  /**
   * POST /api/v1/jobs
   * Creates a new PDF processing job.
   */
  async createJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const job = await jobService.createJob(userId, req.body);
      sendSuccess(res, { job }, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/jobs/:jobId
   * Retrieves single job details and progress.
   */
  async getJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const jobId = String(req.params.jobId);
      const job = await jobService.getJobById(userId, jobId);
      sendSuccess(res, { job });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/jobs
   * Lists jobs for authenticated user.
   */
  async listJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const result = await jobService.getUserJobs(userId, req.query);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/jobs/:jobId/cancel
   * Cancels a queued or processing job.
   */
  async cancelJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const jobId = String(req.params.jobId);
      const job = await jobService.cancelJob(userId, jobId);
      sendSuccess(res, { job });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/jobs/:jobId
   * Deletes a job record from user history.
   */
  async deleteJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        throw new UnauthorizedError("Authentication required.");
      }

      const jobId = String(req.params.jobId);
      await jobService.deleteJob(userId, jobId);
      sendSuccess(res, { message: "Job deleted from history successfully" });
    } catch (err) {
      next(err);
    }
  }
}

export const jobController = new JobController();
