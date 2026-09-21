import { JobStatus } from "./job.constants";
import { IFileDto } from "../files/files.types";

export interface IJobDto {
  id: string;
  tool: string;
  status: JobStatus;
  progress: number;
  inputFileIds: string[];
  outputFileId?: string | null;
  outputFile?: IFileDto | null;
  outputFiles?: IFileDto[];
  options?: Record<string, any> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ICreateJobDto {
  tool: string;
  inputFileIds: string[];
  options?: Record<string, any>;
}

export interface IJobListQuery {
  page?: number | string;
  limit?: number | string;
  status?: string;
  tool?: string;
}

export interface IPaginatedJobsResponse {
  jobs: IJobDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
