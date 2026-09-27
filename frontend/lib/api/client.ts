export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface FetchOptions extends RequestInit {
  data?: unknown;
}

export interface ApiSuccessResponse<T = unknown> {
  success: boolean;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Reads a cookie value by name from document.cookie in browser context.
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match && match[3] ? decodeURIComponent(match[3]) : null;
}

let csrfTokenPromise: Promise<string | null> | null = null;

/**
 * Obtains the CSRF token either by reading pdf_csrf cookie or by querying GET /api/v1/auth/csrf.
 */
async function getOrFetchCsrfToken(): Promise<string | null> {
  if (typeof document === "undefined") return null;

  // 1. Read existing pdf_csrf cookie from browser
  const existing = getCookie("pdf_csrf");
  if (existing) {
    return existing;
  }

  // 2. Fetch fresh token from backend if not yet initialized
  if (!csrfTokenPromise) {
    csrfTokenPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/csrf`, {
          credentials: "include",
        });
        const json = await res.json();
        return getCookie("pdf_csrf") || json.data?.csrfToken || null;
      } catch {
        return null;
      } finally {
        csrfTokenPromise = null;
      }
    })();
  }
  return csrfTokenPromise;
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

  // Automatically attach X-CSRF-Token for state-changing browser requests (C1 / Issue 2)
  const method = (config.method || "GET").toUpperCase();
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (isMutating && typeof document !== "undefined") {
    const csrfToken = await getOrFetchCsrfToken();
    if (csrfToken) {
      if (config.headers instanceof Headers) {
        config.headers.set("X-CSRF-Token", csrfToken);
      } else {
        (config.headers as Record<string, string>)["X-CSRF-Token"] = csrfToken;
      }
    }
  }

  // Attach session token in Authorization header as bulletproof backup to cookies
  if (typeof window !== "undefined") {
    const sessionToken = localStorage.getItem("pdf_session_token");
    if (sessionToken) {
      if (config.headers instanceof Headers) {
        if (!config.headers.has("Authorization")) {
          config.headers.set("Authorization", `Bearer ${sessionToken}`);
        }
      } else {
        if (!(config.headers as Record<string, string>)["Authorization"]) {
          (config.headers as Record<string, string>)["Authorization"] = `Bearer ${sessionToken}`;
        }
      }
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
            .split("\n")[0]
            ?.trim();
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
    throw error;
  }
}

export default apiClient;
