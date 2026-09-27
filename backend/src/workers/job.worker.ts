/**
 * Durable Job Worker (Launch Plan Item 2 & 18)
 *
 * Provides a persistent, DB-backed queue worker that reliably claims and executes QUEUED jobs.
 * Prevents job loss on process crashes/restarts, enforces concurrency limits, and recovers stale jobs.
 */

import { prisma } from "../common/prisma";
import { JobStatus } from "../modules/jobs/job.constants";
import { jobService } from "../modules/jobs/job.service";
import { logger } from "../common/logger";
import { decryptJobSecrets } from "../common/job-crypto";

export interface IJobWorkerConfig {
  maxConcurrentJobs?: number;
  pollIntervalMs?: number;
  jobTimeoutMs?: number;
}

export class JobWorker {
  private isRunning: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private activeJobsCount: number = 0;
  private readonly maxConcurrentJobs: number;
  private readonly pollIntervalMs: number;
  private readonly jobTimeoutMs: number;
  private isTickRunning: boolean = false;

  constructor(config: IJobWorkerConfig = {}) {
    this.maxConcurrentJobs =
      config.maxConcurrentJobs ||
      (process.env.MAX_CONCURRENT_JOBS ? parseInt(process.env.MAX_CONCURRENT_JOBS, 10) : 4);
    this.pollIntervalMs =
      config.pollIntervalMs ||
      (process.env.JOB_POLL_INTERVAL_MS ? parseInt(process.env.JOB_POLL_INTERVAL_MS, 10) : 1000);
    this.jobTimeoutMs =
      config.jobTimeoutMs ||
      (process.env.JOB_TIMEOUT_MS ? parseInt(process.env.JOB_TIMEOUT_MS, 10) : 5 * 60 * 1000); // 5 minutes default
  }

  /**
   * Starts the background worker.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(
      `Job worker started (concurrency: ${this.maxConcurrentJobs}, pollInterval: ${this.pollIntervalMs}ms, timeout: ${this.jobTimeoutMs}ms)`,
      "WORKER"
    );

    // Initial check
    this.scheduleNextTick(100);
  }

  /**
   * Stops the worker and waits for active jobs to finish (graceful shutdown).
   */
  async stop(graceTimeoutMs: number = 10000): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    logger.info(`Job worker stopping, waiting for ${this.activeJobsCount} active jobs to complete...`, "WORKER");

    const startTime = Date.now();
    while (this.activeJobsCount > 0 && Date.now() - startTime < graceTimeoutMs) {
      await new Promise((r) => setTimeout(r, 200));
    }

    logger.info("Job worker stopped cleanly.", "WORKER");
  }

  /**
   * Wakes up the worker immediately when a new job is created.
   * Auto-starts the worker if not already running.
   */
  notify(): void {
    if (!this.isRunning) {
      this.start();
    }
    if (this.activeJobsCount < this.maxConcurrentJobs) {
      setImmediate(() => {
        this.tick().catch(() => {
          logger.error("Error in notified worker tick.", "WORKER");
        });
      });
    }
  }

  private scheduleNextTick(delayMs: number = this.pollIntervalMs): void {
    if (!this.isRunning) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      this.tick()
        .catch(() => {
          logger.error("Error during job worker tick.", "WORKER");
        })
        .finally(() => {
          this.scheduleNextTick();
        });
    }, delayMs);
    if (this.pollTimer && typeof this.pollTimer.unref === "function") {
      this.pollTimer.unref();
    }
  }

  /**
   * Core worker tick: recovers stale jobs and atomically claims available QUEUED jobs up to max concurrency.
   */
  async tick(): Promise<void> {
    if (!this.isRunning || this.isTickRunning) return;
    this.isTickRunning = true;

    try {
      // 1. Stale job recovery
      await this.recoverStaleJobs();

      // 2. Claim jobs while capacity permits
      while (this.isRunning && this.activeJobsCount < this.maxConcurrentJobs) {
        const claimedJob = await this.claimNextJob();
        if (!claimedJob) {
          break; // No more QUEUED jobs available
        }

        // Spawn job execution without awaiting so concurrency works
        this.activeJobsCount++;
        this.executeClaimedJob(claimedJob).finally(() => {
          this.activeJobsCount--;
          // When a slot frees up, immediately check if more jobs are queued
          if (this.isRunning) {
            this.notify();
          }
        });
      }
    } finally {
      this.isTickRunning = false;
    }
  }

  /**
   * Identifies jobs stuck in PROCESSING longer than jobTimeoutMs and marks them FAILED.
   */
  private async recoverStaleJobs(): Promise<void> {
    const staleThreshold = new Date(Date.now() - this.jobTimeoutMs);

    const staleJobs = await prisma.job.findMany({
      where: {
        status: JobStatus.PROCESSING,
        startedAt: {
          lt: staleThreshold,
        },
      },
      select: { id: true, userId: true, tool: true },
      take: 10,
    });

    for (const job of staleJobs) {
      logger.warn(`Recovering stale/timed-out job ${job.id} for user ${job.userId} [${job.tool}]`, "WORKER");
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          errorCode: "JOB_TIMEOUT",
          errorMessage: "Job execution timed out. Please try again.",
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Atomically claims the oldest QUEUED job.
   */
  private async claimNextJob(): Promise<{
    id: string;
    userId: string;
    tool: string;
    inputFileIds: string[];
    options: Record<string, any>;
  } | null> {
    const candidate = await prisma.job.findFirst({
      where: { status: JobStatus.QUEUED },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        tool: true,
        inputFileIds: true,
        options: true,
        secretOptions: true,
      },
    });

    if (!candidate) return null;

    // Atomic conditional claim: only transition if status is still QUEUED
    const claimResult = await prisma.job.updateMany({
      where: {
        id: candidate.id,
        status: JobStatus.QUEUED,
      },
      data: {
        status: JobStatus.PROCESSING,
        startedAt: new Date(),
        progress: 10,
      },
    });

    if (claimResult.count !== 1) {
      // Another worker claimed this job concurrently
      return null;
    }

    let parsedInputs: string[] = [];
    try {
      parsedInputs = JSON.parse(candidate.inputFileIds || "[]");
    } catch {
      parsedInputs = [];
    }

    let parsedOptions: Record<string, any> = {};
    try {
      parsedOptions = JSON.parse(candidate.options || "{}");
    } catch {
      parsedOptions = {};
    }

    // Decrypt durable secrets if present
    let decryptedSecrets: Record<string, any> = {};
    if (candidate.secretOptions) {
      try {
        decryptedSecrets = decryptJobSecrets(candidate.secretOptions);
      } catch (err: any) {
        logger.error(`[WORKER] Failed to decrypt secretOptions for job ${candidate.id}`, "WORKER");
      }
    }

    const inMemoryOptions = jobService.getExecutionOptions(candidate.id);
    const effectiveOptions = {
      ...parsedOptions,
      ...decryptedSecrets,
      ...(inMemoryOptions || {}),
    };

    return {
      id: candidate.id,
      userId: candidate.userId,
      tool: candidate.tool,
      inputFileIds: parsedInputs,
      options: effectiveOptions,
    };
  }

  /**
   * Dispatches the claimed job to jobService for processing.
   */
  private async executeClaimedJob(job: {
    id: string;
    userId: string;
    tool: string;
    inputFileIds: string[];
    options: Record<string, any>;
  }): Promise<void> {
    try {
      await jobService.processClaimedJob(
        job.id,
        job.userId,
        job.tool,
        job.inputFileIds,
        job.options
      );
    } catch {
      logger.error(`Error executing claimed job ${job.id}.`, "WORKER");
    }
  }

  /**
   * Returns current worker status.
   */
  getStatus(): { isRunning: boolean; activeJobsCount: number; maxConcurrentJobs: number } {
    return {
      isRunning: this.isRunning,
      activeJobsCount: this.activeJobsCount,
      maxConcurrentJobs: this.maxConcurrentJobs,
    };
  }
}

export const jobWorker = new JobWorker();
jobService.setWorkerNotifier(() => jobWorker.notify());
