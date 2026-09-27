import { apiClient, API_BASE_URL } from "./client";

export interface V1UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FileListResponse {
  files: V1UploadedFile[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Uploads a file directly to V1 API: POST /api/v1/files
 */
export async function uploadFileToV1(file: File): Promise<V1UploadedFile> {
  const formData = new FormData();
  formData.append("file", file);

  const endpoint = file.type.startsWith("image/") ? "/api/v1/files?type=image" : "/api/v1/files";
  const res = await apiClient<{ success: boolean; data: { file: V1UploadedFile } }>(
    endpoint,
    { data: formData }
  );

  return res.data.file;
}

/**
 * Retrieves metadata for a single file: GET /api/v1/files/:id
 */
export async function getFile(id: string): Promise<V1UploadedFile> {
  const res = await apiClient<{ success: boolean; data: { file: V1UploadedFile } }>(
    `/api/v1/files/${id}`
  );
  return res.data.file;
}

/**
 * Lists user files: GET /api/v1/files
 */
export async function listFiles(): Promise<V1UploadedFile[]> {
  const res = await apiClient<{ success: boolean; data: FileListResponse }>(
    "/api/v1/files"
  );
  return res.data.files;
}

/**
 * Deletes a file: DELETE /api/v1/files/:id
 */
export async function deleteFile(id: string): Promise<{ message: string }> {
  const res = await apiClient<{ success: boolean; data: { message: string } }>(
    `/api/v1/files/${id}`,
    { method: "DELETE" }
  );
  return res.data;
}

/**
 * Generates absolute download URL for a file
 */
export function getFileDownloadUrl(id: string): string {
  return `${API_BASE_URL}/api/v1/files/${id}/download`;
}
