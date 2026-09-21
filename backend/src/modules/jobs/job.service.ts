import { prisma } from "../../common/prisma";
import { JobStatus } from "./job.constants";
import { ICreateJobDto, IJobDto, IJobListQuery, IPaginatedJobsResponse } from "./job.types";
import { validateCreateJob, validateJobStatusFilter } from "./job.validation";
import { compressProcessor } from "../pdf/processors/compress.processor";
import { mergeProcessor } from "../pdf/processors/merge.processor";
import { splitProcessor } from "../pdf/processors/split.processor";
import { rotateProcessor } from "../pdf/processors/rotate.processor";
import { organizeProcessor } from "../pdf/processors/organize.processor";
import { filesService } from "../files/files.service";
import {
  JobNotFoundError,
  JobAccessDeniedError,
  JobCancelFailedError,
  InvalidJobStatusError,
} from "../../common/errors/AppError";

export class JobService {
  /**
   * Helper to format Prisma Job record to a clean public DTO
   */
  private toDto(job: any): IJobDto {
    let parsedInputFileIds: string[] = [];
    try {
      parsedInputFileIds = JSON.parse(job.inputFileIds || "[]");
    } catch {
      parsedInputFileIds = [];
    }

    let parsedOptions: Record<string, any> | null = null;
    try {
      parsedOptions = job.options ? JSON.parse(job.options) : null;
    } catch {
      parsedOptions = null;
    }

    return {
      id: job.id,
      tool: job.tool,
      status: job.status as JobStatus,
      progress: job.progress,
      inputFileIds: parsedInputFileIds,
      outputFileId: job.outputFileId,
      outputFile: job.outputFile
        ? {
            id: job.outputFile.id,
            originalName: job.outputFile.originalName,
            mimeType: job.outputFile.mimeType,
            size: job.outputFile.size,
            status: job.outputFile.status,
            createdAt: job.outputFile.createdAt,
            updatedAt: job.outputFile.updatedAt,
          }
        : null,
      outputFiles: job.outputFiles
        ? job.outputFiles.map((f: any) => ({
            id: f.id,
            originalName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
            status: f.status,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          }))
        : undefined,
      options: parsedOptions,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      expiresAt: job.expiresAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  /**
   * Creates a new job record in QUEUED status and asynchronously triggers processing.
   */
  async createJob(userId: string, data: ICreateJobDto): Promise<IJobDto> {
    const { validatedTool, validatedInputFileIds, validatedOptions } = await validateCreateJob(userId, data);

    const job = await prisma.job.create({
      data: {
        userId,
        tool: validatedTool,
        status: JobStatus.QUEUED,
        progress: 0,
        inputFileIds: JSON.stringify(validatedInputFileIds),
        options: JSON.stringify(validatedOptions),
      },
    });

    console.log(`[JOB] Created ${job.id} for user ${userId} [tool: ${validatedTool}]`);

    // Asynchronously dispatch the processing pipeline without blocking HTTP response
    setImmediate(() => {
      this.dispatchJob(job.id, userId, validatedTool, validatedInputFileIds, validatedOptions).catch((err) => {
        console.error(`[JOB] Unhandled dispatch failure for ${job.id}:`, err);
      });
    });

    return this.toDto(job);
  }

  /**
   * Asynchronous executor routing jobs to respective processors.
   */
  private async dispatchJob(
    jobId: string,
    userId: string,
    tool: string,
    inputFileIds: string[],
    options: Record<string, any>
  ): Promise<void> {
    // 1. Atomic transition from QUEUED to PROCESSING
    const startResult = await prisma.job.updateMany({
      where: {
        id: jobId,
        status: JobStatus.QUEUED,
      },
      data: {
        status: JobStatus.PROCESSING,
        startedAt: new Date(),
        progress: 25,
      },
    });

    if (startResult.count === 0) {
      console.log(`[JOB] Job ${jobId} was cancelled before processing started`);
      return;
    }

    const generatedOutputFileIds: string[] = [];

    try {
      let resultOutputFileId: string | null = null;
      let resultMetrics: Record<string, any> = {};

      if (tool === "compress-pdf") {
        const result = await compressProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "merge-pdf") {
        const result = await mergeProcessor.process({
          jobId,
          userId,
          inputFileIds,
          options,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "split-pdf") {
        const result = await splitProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options,
        });
        resultOutputFileId = result.outputFileIds[0] || null;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(...result.outputFileIds);
      } else if (tool === "rotate-pdf") {
        const result = await rotateProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "organize-pdf") {
        const result = await organizeProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else {
        throw new Error(`No processor registered for tool '${tool}'.`);
      }

      // 2. Atomic conditional update: ONLY transition from PROCESSING to COMPLETED
      const completeResult = await prisma.job.updateMany({
        where: {
          id: jobId,
          status: JobStatus.PROCESSING,
        },
        data: {
          status: JobStatus.COMPLETED,
          progress: 100,
          outputFileId: resultOutputFileId,
          completedAt: new Date(),
          options: JSON.stringify({
            ...options,
            metrics: resultMetrics,
          }),
        },
      });

      // If completeResult.count === 0, job was cancelled concurrently while processor was running!
      if (completeResult.count === 0) {
        console.log(`[JOB] Job ${jobId} was cancelled or deleted during processing. Cleaning up ${generatedOutputFileIds.length} generated output file(s)`);
        for (const fileId of generatedOutputFileIds) {
          try {
            await filesService.deleteFile(userId, fileId);
          } catch (cleanupErr: any) {
            console.warn(`[JOB] Failed to clean up output file ${fileId} after job cancellation:`, cleanupErr.message || cleanupErr);
          }
        }
        return;
      }
    } catch (err: any) {
      console.error(`[JOB] Failed ${jobId}:`, err.message || err);

      // Clean up all generated output files on dispatch failure to prevent orphaned files
      if (generatedOutputFileIds.length > 0) {
        for (const fileId of generatedOutputFileIds) {
          try {
            console.warn(`[JOB] Cleaning up orphan output file ${fileId} due to dispatch failure for job ${jobId}`);
            await filesService.deleteFile(userId, fileId);
          } catch (cleanupErr: any) {
            console.warn(`[JOB] Failed to clean up orphan output file ${fileId}:`, cleanupErr.message || cleanupErr);
          }
        }
      }

      const failureMessage =
        tool === "merge-pdf"
          ? "We couldn't merge these PDFs. Please try again."
          : tool === "split-pdf"
          ? "We couldn't split this PDF. Please try again."
          : tool === "rotate-pdf"
          ? "We couldn't rotate this PDF. Please try again."
          : tool === "organize-pdf"
          ? "We couldn't organize this PDF. Please try again."
          : "We couldn't process this PDF. Please try another file.";

      try {
        // Atomic failure transition: Only mark FAILED if job is currently PROCESSING
        await prisma.job.updateMany({
          where: {
            id: jobId,
            status: JobStatus.PROCESSING,
          },
          data: {
            status: JobStatus.FAILED,
            progress: 0,
            errorCode: "PROCESSING_FAILED",
            errorMessage: failureMessage,
            completedAt: new Date(),
          },
        });
      } catch (innerErr: any) {
        console.warn(`[JOB] Unable to update job status to FAILED: ${innerErr.message || innerErr}`);
      }
    }
  }

  /**
   * Retrieves single job details strictly verifying ownership.
   */
  async getJobById(userId: string, jobId: string): Promise<IJobDto> {
    if (!jobId || typeof jobId !== "string") {
      throw new JobNotFoundError("Job not found.");
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { outputFile: true, outputFiles: true },
    });

    if (!job) {
      throw new JobNotFoundError("Job not found.");
    }

    if (job.userId !== userId) {
      throw new JobAccessDeniedError("Access to this job is denied.");
    }

    return this.toDto(job);
  }

  /**
   * Lists jobs for authenticated user with pagination and optional filters.
   */
  async getUserJobs(userId: string, query: IJobListQuery): Promise<IPaginatedJobsResponse> {
    const rawPage = parseInt(String(query.page || 1), 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const rawLimit = parseInt(String(query.limit || 20), 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(100, rawLimit);
    const skip = (page - 1) * limit;

    const whereClause: any = { userId };
    if (query.status) {
      whereClause.status = validateJobStatusFilter(query.status);
    }
    if (query.tool) {
      whereClause.tool = String(query.tool).trim();
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: whereClause,
        include: { outputFile: true, outputFiles: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.job.count({ where: whereClause }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      jobs: jobs.map((j: any) => this.toDto(j)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Cancels a queued or processing job.
   */
  async cancelJob(userId: string, jobId: string): Promise<IJobDto> {
    if (!jobId || typeof jobId !== "string") {
      throw new JobNotFoundError("Job not found.");
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new JobNotFoundError("Job not found.");
    }

    if (job.userId !== userId) {
      throw new JobAccessDeniedError("Access to this job is denied.");
    }

    // Atomic conditional cancellation: Only cancel if currently QUEUED or PROCESSING
    const updateResult = await prisma.job.updateMany({
      where: {
        id: jobId,
        userId,
        status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] },
      },
      data: {
        status: JobStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      const refreshed = await prisma.job.findUnique({ where: { id: jobId } });
      throw new JobCancelFailedError(`Cannot cancel job in '${refreshed?.status || job.status}' state.`);
    }

    const updated = await prisma.job.findUnique({
      where: { id: jobId },
      include: { outputFile: true, outputFiles: true },
    });

    console.log(`[JOB] Cancelled ${jobId} by user ${userId}`);
    return this.toDto(updated!);
  }

  /**
   * Deletes a job record from user history.
   */
  async deleteJob(userId: string, jobId: string): Promise<void> {
    if (!jobId || typeof jobId !== "string") {
      throw new JobNotFoundError("Job not found.");
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new JobNotFoundError("Job not found.");
    }

    if (job.userId !== userId) {
      throw new JobAccessDeniedError("Access to this job is denied.");
    }

    if (job.status === JobStatus.QUEUED || job.status === JobStatus.PROCESSING) {
      throw new InvalidJobStatusError(
        "Cannot delete an active job. Please cancel the job before deleting it from history."
      );
    }

    await prisma.job.delete({
      where: { id: jobId },
    });

    console.log(`[JOB] Deleted ${jobId} from history`);
  }
}

export const jobService = new JobService();
