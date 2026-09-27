/**
 * Backward compatibility re-export
 * Centralized API client has moved to @/lib/api
 */
import { apiClient } from "./api/client";

export {
  API_BASE_URL,
  apiClient,
  type FetchOptions,
  type ApiSuccessResponse,
  type ApiErrorResponse,
} from "./api/client";

export {
  uploadFileToV1,
  getFile,
  listFiles,
  deleteFile,
  getFileDownloadUrl,
  type V1UploadedFile,
} from "./api/files";

export * from "./api/jobs";
export * from "./api/auth";

export default apiClient;
