export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface FetchOptions extends RequestInit {
  data?: any;
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
    let responseData;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      let errorMessage = responseData?.error;
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
      throw new Error(errorMessage || "API Error");
    }

    return responseData as T;
  } catch (error: any) {
    // Standardize error format
    throw error;
  }
}
