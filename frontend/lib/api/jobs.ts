import { apiClient } from "@/lib/apiClient";

export interface V1Job {
  id: string;
  tool: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | "EXPIRED";
  progress: number;
  inputFileIds: string[];
  outputFileId?: string | null;
  outputFile?: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    status: string;
  } | null;
  outputFiles?: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    status: string;
  }>;
  options?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobPayload {
  tool: string;
  inputFileIds: string[];
  options?: Record<string, unknown>;
}

export interface JobListQuery {
  page?: number;
  limit?: number;
  status?: string;
  tool?: string;
}

export interface JobListResponse {
  jobs: V1Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Creates a new PDF processing job
 * POST /api/v1/jobs
 */
export async function createJob(payload: CreateJobPayload): Promise<V1Job> {
  const res = await apiClient<{ success: boolean; data: { job: V1Job } }>(
    "/api/v1/jobs",
    { data: payload }
  );
  return res.data.job;
}

/**
 * Fetches status and progress of a single job
 * GET /api/v1/jobs/:jobId
 */
export async function getJob(jobId: string): Promise<V1Job> {
  const res = await apiClient<{ success: boolean; data: { job: V1Job } }>(
    `/api/v1/jobs/${jobId}`
  );
  return res.data.job;
}

/**
 * Lists jobs belonging to the authenticated user
 * GET /api/v1/jobs
 */
export async function getJobs(query: JobListQuery = {}): Promise<JobListResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.status) params.set("status", query.status);
  if (query.tool) params.set("tool", query.tool);

  const qs = params.toString();
  const endpoint = qs ? `/api/v1/jobs?${qs}` : "/api/v1/jobs";

  const res = await apiClient<{ success: boolean; data: JobListResponse }>(endpoint);
  return res.data;
}

/**
 * Cancels an active job
 * POST /api/v1/jobs/:jobId/cancel
 */
export async function cancelJob(jobId: string): Promise<V1Job> {
  const res = await apiClient<{ success: boolean; data: { job: V1Job } }>(
    `/api/v1/jobs/${jobId}/cancel`,
    { data: {} }
  );
  return res.data.job;
}

/**
 * Deletes a job from history
 * DELETE /api/v1/jobs/:jobId
 */
export async function deleteJob(jobId: string): Promise<{ message: string }> {
  const res = await apiClient<{ success: boolean; data: { message: string } }>(
    `/api/v1/jobs/${jobId}`,
    { method: "DELETE" }
  );
  return res.data;
}
