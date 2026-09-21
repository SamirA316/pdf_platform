export enum FileStatus {
  UPLOADING = "UPLOADING",
  READY = "READY",
  PROCESSING = "PROCESSING",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
}

export interface IFileDto {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IFileListQuery {
  page?: number;
  limit?: number;
  status?: string;
}

export interface IPaginatedFilesResponse {
  files: IFileDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
