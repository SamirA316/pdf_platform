export enum FileStatus {
  UPLOADING = "UPLOADING",
  READY = "READY",
  PROCESSING = "PROCESSING",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
}

export interface IFileDto {
  id: string;
  filename?: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type AllowedSortField = "createdAt" | "updatedAt" | "filename" | "originalName" | "size";
export type AllowedSortOrder = "asc" | "desc";

export interface IFileListQuery {
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
}

export interface IValidatedListFilesQuery {
  page: number;
  limit: number;
  sortBy: AllowedSortField;
  sortOrder: AllowedSortOrder;
  status?: FileStatus | undefined;
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

export interface IFileDownloadData {
  physicalPath: string;
  originalName: string;
  safeAsciiName: string;
  encodedUtf8Name: string;
  mimeType: string;
  size: number;
}

export interface IStorageQuotaDto {
  usage: number;
  quota: number;
  remaining: number;
}



