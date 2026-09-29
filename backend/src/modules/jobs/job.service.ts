import { prisma } from "../../common/prisma";
import { JobStatus } from "./job.constants";
import { ICreateJobDto, IJobDto, IJobListQuery, IPaginatedJobsResponse } from "./job.types";
import { validateCreateJob, validateJobStatusFilter } from "./job.validation";
import { compressProcessor } from "../pdf/processors/compress.processor";
import { mergeProcessor } from "../pdf/processors/merge.processor";
import { splitProcessor } from "../pdf/processors/split.processor";
import { rotateProcessor } from "../pdf/processors/rotate.processor";
import { organizeProcessor } from "../pdf/processors/organize.processor";
import { resizeProcessor } from "../pdf/processors/resize.processor";
import { watermarkProcessor } from "../pdf/processors/watermark.processor";
import { pageNumbersProcessor } from "../pdf/processors/page-numbers.processor";
import { protectProcessor } from "../pdf/processors/protect.processor";
import { unlockProcessor } from "../pdf/processors/unlock.processor";
import { repairProcessor } from "../pdf/processors/repair.processor";
import { pdfaProcessor } from "../pdf/processors/pdfa.processor";
import { imageToPdfProcessor } from "../pdf/processors/image-to-pdf.processor";
import { pdfToImageProcessor } from "../pdf/processors/pdf-to-image.processor";
import { htmlToPdfProcessor } from "../pdf/processors/html-to-pdf.processor";
import { pdfToMarkdownProcessor } from "../pdf/processors/pdf-to-markdown.processor";
import { cropProcessor } from "../pdf/processors/crop.processor";
import { signProcessor } from "../pdf/processors/sign.processor";
import { redactProcessor } from "../pdf/processors/redact.processor";
import { formsProcessor } from "../pdf/processors/forms.processor";
import { compareProcessor } from "../pdf/processors/compare.processor";
import { officeToPdfProcessor } from "../pdf/processors/office-to-pdf.processor";
import { pdfToOfficeProcessor } from "../pdf/processors/pdf-to-office.processor";
import { ocrProcessor } from "../pdf/processors/ocr.processor";
import { aiToolsProcessor } from "../pdf/processors/ai-tools.processor";
import { editProcessor } from "../pdf/processors/edit.processor";
import { filesService } from "../files/files.service";
import {
  JobNotFoundError,
  JobAccessDeniedError,
  JobCancelFailedError,
  InvalidJobStatusError,
} from "../../common/errors/AppError";
import { logger } from "../../common/logger";
import { encryptJobSecrets, decryptJobSecrets } from "../../common/job-crypto";

/**
 * Strips sensitive keys like passwords before persisting options to database.
 */
function sanitizeOptionsForStorage(options: Record<string, any>): Record<string, any> {
  const sanitized = { ...options };
  delete sanitized.userPassword;
  delete sanitized.ownerPassword;
  delete sanitized.password;
  return sanitized;
}

/**
 * Extracts sensitive passwords to be encrypted in secretOptions.
 */
function extractJobSecrets(options: Record<string, any>): Record<string, any> | null {
  const secrets: Record<string, any> = {};
  if (typeof options.userPassword === "string" && options.userPassword) {
    secrets.userPassword = options.userPassword;
  }
  if (typeof options.ownerPassword === "string" && options.ownerPassword) {
    secrets.ownerPassword = options.ownerPassword;
  }
  if (typeof options.password === "string" && options.password) {
    secrets.password = options.password;
  }
  return Object.keys(secrets).length > 0 ? secrets : null;
}

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
            filename: job.outputFile.originalName,
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
            filename: f.originalName,
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

  private executionOptionsCache = new Map<string, any>();

  getExecutionOptions(jobId: string): Record<string, any> | undefined {
    return this.executionOptionsCache.get(jobId);
  }

  setExecutionOptions(jobId: string, options: any): void {
    this.executionOptionsCache.set(jobId, options);
  }

  clearExecutionOptions(jobId: string): void {
    this.executionOptionsCache.delete(jobId);
  }

  private workerNotifier: (() => void) | null = null;

  /**
   * Registers a callback from the durable job worker to trigger immediate claiming on new job creation.
   */
  setWorkerNotifier(notifier: () => void): void {
    this.workerNotifier = notifier;
  }

  /**
   * Creates a new job record in QUEUED status and asynchronously triggers processing.
   */
  async createJob(userId: string, data: ICreateJobDto): Promise<IJobDto> {
    const { validatedTool, validatedInputFileIds, validatedOptions } = await validateCreateJob(userId, data);

    const secrets = extractJobSecrets(validatedOptions);
    const encryptedSecretOptions = secrets ? encryptJobSecrets(secrets) : null;
    const sanitizedOptions = sanitizeOptionsForStorage(validatedOptions);

    const job = await prisma.job.create({
      data: {
        userId,
        tool: validatedTool,
        status: JobStatus.QUEUED,
        progress: 0,
        inputFileIds: JSON.stringify(validatedInputFileIds),
        options: JSON.stringify(sanitizedOptions),
        secretOptions: encryptedSecretOptions,
      },
    });

    // Store in-memory options for execution (including ephemeral passwords for protect/unlock)
    this.setExecutionOptions(job.id, validatedOptions);

    logger.info(`[JOB] Created ${job.id} for user ${userId} [tool: ${validatedTool}]`, "JOB");

    // Notify durable background worker if active
    if (this.workerNotifier) {
      this.workerNotifier();
    } else {
      // Ephemeral fallback for isolated test suites
      setImmediate(() => {
        this.dispatchJob(job.id, userId, validatedTool, validatedInputFileIds, validatedOptions).catch((err) => {
          logger.error(`[JOB] Unhandled dispatch failure for ${job.id}`, "JOB");
        });
      });
    }

    return this.toDto(job);
  }

  /**
   * Dispatches a job atomically from QUEUED to PROCESSING.
   */
  async dispatchJob(
    jobId: string,
    userId: string,
    tool: string,
    inputFileIds: string[],
    options: Record<string, any>
  ): Promise<void> {
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
      const current = await prisma.job.findUnique({ where: { id: jobId } });
      if (current && current.status === JobStatus.PROCESSING) {
        return this.processClaimedJob(jobId, userId, tool, inputFileIds, options);
      }
      return;
    }

    return this.processClaimedJob(jobId, userId, tool, inputFileIds, options);
  }

  /**
   * Executes the processor pipeline for an already-claimed job in PROCESSING status.
   */
  async processClaimedJob(
    jobId: string,
    userId: string,
    tool: string,
    inputFileIds: string[],
    options: Record<string, any>
  ): Promise<void> {
    const generatedOutputFileIds: string[] = [];

    // Ensure sensitive secrets are decrypted and available even if in-memory cache was lost
    let effectiveOptions = { ...options };
    if (!effectiveOptions.userPassword && !effectiveOptions.password) {
      try {
        const jobRecord = await prisma.job.findUnique({
          where: { id: jobId },
          select: { secretOptions: true },
        });
        if (jobRecord?.secretOptions) {
          const decrypted = decryptJobSecrets(jobRecord.secretOptions);
          effectiveOptions = { ...effectiveOptions, ...decrypted };
        }
      } catch (err: any) {
        logger.error(`[JOB] Failed to decrypt job secretOptions for ${jobId}`, "JOB");
      }
    }

    try {
      let resultOutputFileId: string | null = null;
      let resultMetrics: Record<string, any> = {};

      if (tool === "compress-pdf") {
        const result = await compressProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "merge-pdf") {
        const result = await mergeProcessor.process({
          jobId,
          userId,
          inputFileIds,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "split-pdf") {
        const result = await splitProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileIds[0] || null;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(...result.outputFileIds);
      } else if (tool === "rotate-pdf") {
        const result = await rotateProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "organize-pdf") {
        const result = await organizeProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "resize-pdf") {
        const result = await resizeProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "watermark-pdf") {
        const result = await watermarkProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "page-numbers") {
        const result = await pageNumbersProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "protect-pdf") {
        const result = await protectProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "unlock-pdf") {
        const result = await unlockProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "repair-pdf") {
        const result = await repairProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "pdf-to-pdfa") {
        const result = await pdfaProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "jpg-to-pdf" || tool === "scan-to-pdf") {
        const result = await imageToPdfProcessor.process({
          jobId,
          userId,
          inputFileIds,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "pdf-to-jpg" || tool === "pdf-to-png") {
        const result = await pdfToImageProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: {
            ...effectiveOptions,
            format: tool === "pdf-to-png" ? "png" : (effectiveOptions?.format || "jpg"),
          },
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "html-to-pdf") {
        const result = await htmlToPdfProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0],
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "pdf-to-markdown") {
        const result = await pdfToMarkdownProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "crop-pdf") {
        const result = await cropProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "sign-pdf") {
        const result = await signProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "redact-pdf") {
        const result = await redactProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "pdf-forms") {
        const result = await formsProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "compare-pdf") {
        const result = await compareProcessor.process({
          jobId,
          userId,
          inputFileIds,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "word-to-pdf" || tool === "excel-to-pdf" || tool === "powerpoint-to-pdf") {
        const result = await officeToPdfProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          tool,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "pdf-to-word" || tool === "pdf-to-excel" || tool === "pdf-to-powerpoint") {
        const result = await pdfToOfficeProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          tool,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "ocr-pdf" || tool === "scan-text") {
        const result = await ocrProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          tool,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "ai-summarizer" || tool === "translate-pdf" || tool === "chat-with-pdf") {
        const result = await aiToolsProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          tool,
          options: effectiveOptions,
        });
        resultOutputFileId = result.outputFileId;
        resultMetrics = result.metrics;
        generatedOutputFileIds.push(result.outputFileId);
      } else if (tool === "edit-pdf") {
        const result = await editProcessor.process({
          jobId,
          userId,
          inputFileId: inputFileIds[0]!,
          options: effectiveOptions,
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
            ...sanitizeOptionsForStorage(effectiveOptions),
            metrics: resultMetrics,
          }),
        },
      });

      // If completeResult.count === 0, job was cancelled concurrently while processor was running!
      if (completeResult.count === 0) {
        logger.info(`[JOB] Job ${jobId} was cancelled or deleted during processing. Cleaning up ${generatedOutputFileIds.length} generated output file(s)`, "JOB");
        for (const fileId of generatedOutputFileIds) {
          try {
            await filesService.deleteFile(userId, fileId);
          } catch {
            logger.warn(`[JOB] Failed to clean up output file ${fileId} after job cancellation.`, "JOB");
          }
        }
        return;
      }
    } catch (err: any) {
      logger.error(`PDF job ${jobId} failed: ${err?.message}\n${err?.stack}`, "JOB");

      // Clean up all generated output files on dispatch failure to prevent orphaned files
      if (generatedOutputFileIds.length > 0) {
        for (const fileId of generatedOutputFileIds) {
          try {
            logger.info(`[JOB] Cleaning up orphan output file ${fileId} due to dispatch failure for job ${jobId}`, "JOB");
            await filesService.deleteFile(userId, fileId);
          } catch {
            logger.warn(`[JOB] Failed to clean up orphan output file ${fileId}.`, "JOB");
          }
        }
      }

      const failureMessage =
        err.code === "STORAGE_QUOTA_EXCEEDED"
          ? err.message || "Storage quota exceeded. Please free up space."
          : err.code === "PAYLOAD_TOO_LARGE" || err.code === "FILE_TOO_LARGE"
          ? err.message || "Generated output exceeds maximum allowed file size."
          : tool === "merge-pdf"
          ? "We couldn't merge these PDFs. Please try again."
          : tool === "split-pdf"
          ? "We couldn't split this PDF. Please try again."
          : tool === "rotate-pdf"
          ? "We couldn't rotate this PDF. Please try again."
          : tool === "organize-pdf"
          ? "We couldn't organize this PDF. Please try again."
          : tool === "resize-pdf"
          ? "We couldn't resize this PDF. Please try again."
          : tool === "watermark-pdf"
          ? "We couldn't watermark this PDF. Please try again."
          : tool === "page-numbers"
          ? "We couldn't add page numbers to this PDF. Please try again."
          : tool === "protect-pdf"
          ? "We couldn't protect this PDF. Please try again."
          : tool === "unlock-pdf"
          ? (err.code === "PDF_NOT_ENCRYPTED" || err.message?.includes("not password-protected")
              ? "This PDF document is not password-protected."
              : err.code === "INVALID_PDF_PASSWORD" || err.message?.includes("Incorrect PDF password")
              ? "Incorrect PDF password provided."
              : "We couldn't unlock this PDF. Please verify your password and try again.")
          : tool === "repair-pdf"
          ? (err.code === "PDF_REPAIR_FAILED" || err.message?.includes("repair")
              ? "We couldn't repair this PDF. The document may be too severely corrupted."
              : "We couldn't repair this PDF. Please try another file.")
          : tool === "pdf-to-pdfa"
          ? (err.code === "ENCRYPTED_PDF_REJECTED"
              ? "Password-protected encrypted PDFs cannot be converted to PDF/A. Please unlock the file first."
              : "We couldn't convert this PDF to PDF/A. Please try another file.")
          : "We couldn't process this PDF. Please try another file.";

      const errorCode = err.code || "PROCESSING_FAILED";

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
            errorCode,
            errorMessage: failureMessage,
            completedAt: new Date(),
          },
        });
      } catch {
        logger.warn(`[JOB] Unable to update job status to FAILED for job ${jobId}.`, "JOB");
      }
    } finally {
      this.clearExecutionOptions(jobId);
    }
  }

  /**
   * Retrieves single job details strictly verifying ownership.
   */
  async getJobById(userId: string, jobId: string): Promise<IJobDto> {
    if (!jobId || typeof jobId !== "string") {
      throw new JobNotFoundError("Job not found.");
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId,
      },
      include: { outputFile: true, outputFiles: true },
    });

    if (!job) {
      throw new JobNotFoundError("Job not found.");
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

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId,
      },
    });

    if (!job) {
      throw new JobNotFoundError("Job not found.");
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
      const refreshed = await prisma.job.findFirst({ where: { id: jobId, userId } });
      throw new JobCancelFailedError(`Cannot cancel job in '${refreshed?.status || job.status}' state.`);
    }

    const updated = await prisma.job.findFirst({
      where: { id: jobId, userId },
      include: { outputFile: true, outputFiles: true },
    });

    logger.info(`[JOB] Cancelled ${jobId} by user ${userId}`, "JOB");
    return this.toDto(updated!);
  }

  /**
   * Deletes a job record from user history.
   */
  async deleteJob(userId: string, jobId: string): Promise<void> {
    if (!jobId || typeof jobId !== "string") {
      throw new JobNotFoundError("Job not found.");
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        userId,
      },
    });

    if (!job) {
      throw new JobNotFoundError("Job not found.");
    }

    if (job.status === JobStatus.QUEUED || job.status === JobStatus.PROCESSING) {
      throw new InvalidJobStatusError(
        "Cannot delete an active job. Please cancel the job before deleting it from history."
      );
    }

    await prisma.job.deleteMany({
      where: {
        id: jobId,
        userId,
      },
    });

    logger.info(`[JOB] Deleted ${jobId} from history`, "JOB");
  }
}

export const jobService = new JobService();
