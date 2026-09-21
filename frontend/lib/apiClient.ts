export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface FetchOptions extends RequestInit {
  data?: unknown;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { data, headers, ...customConfig } = options;

  const config: RequestInit = {
    method: data ? "POST" : "GET",
    ...customConfig,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    credentials: customConfig.credentials || "include", // Default to include for sessions
  };

  if (data) {
    if (data instanceof FormData) {
      // Browser automatically sets the correct Content-Type with boundary for FormData
      const newHeaders = new Headers(config.headers as HeadersInit);
      newHeaders.delete("Content-Type");
      config.headers = newHeaders;
      config.body = data;
    } else {
      config.body = JSON.stringify(data);
    }
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, config);
    
    // Attempt to parse JSON response
    let responseData: Record<string, unknown> | string | undefined;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      responseData = (await response.json()) as Record<string, unknown>;
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      const errObj = typeof responseData === "object" && responseData !== null ? (responseData as Record<string, unknown>) : undefined;
      const nestedErr = errObj?.error as Record<string, unknown> | string | undefined;
      let errorMessage = typeof nestedErr === "object" && nestedErr !== null ? (nestedErr.message as string | undefined) : (nestedErr as string | undefined);
      const errorCode = typeof nestedErr === "object" && nestedErr !== null ? (nestedErr.code as string | undefined) : undefined;

      if (!errorMessage && typeof responseData === "string") {
        const preMatch = responseData.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
        if (preMatch && preMatch[1]) {
          errorMessage = preMatch[1]
            .replace(/<br\s*[\/]?>/gi, "\n")
            .replace(/&nbsp;/gi, " ")
            .split("\n")[0] // First line of stack trace/error
            .trim();
        } else if (responseData.includes("<html") || responseData.includes("<!DOCTYPE")) {
          errorMessage = `Server returned an error (${response.status}). Please try again.`;
        } else {
          errorMessage = responseData;
        }
      }

      const err = new Error(errorMessage || "API Error") as Error & { code?: string };
      if (errorCode) {
        err.code = errorCode;
      }
      throw err;
    }

    return responseData as T;
  } catch (error) {
    // Standardize error format
    throw error;
  }
}

export interface V1UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: string;
}

/**
 * Phase 2: Uploads a PDF file directly to POST /api/v1/files
 */
export async function uploadFileToV1(file: File): Promise<V1UploadedFile> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiClient<{ success: boolean; data: { file: V1UploadedFile } }>(
    "/api/v1/files",
    { data: formData }
  );

  return res.data.file;
}
