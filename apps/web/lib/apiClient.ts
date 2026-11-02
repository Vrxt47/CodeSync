import type { ApiResponse, AuthResponseData } from "../types/auth";

let inMemoryAccessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

function onRefreshed(token: string | null): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string | null) => void): void {
  refreshSubscribers.push(callback);
}

export class ApiError extends Error {
  public statusCode: number;
  public code?: string;
  public errors?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface RequestOptions extends RequestInit {
  skipAuthRefresh?: boolean;
}

/**
 * Robust API Client with in-memory JWT support and automatic token refresh deduplication.
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuthRefresh = false, headers = {}, ...restOptions } = options;

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  const requestHeaders = new Headers(headers);

  // Set default Content-Type to JSON if not specified and body is not FormData
  if (!requestHeaders.has("Content-Type") && !(restOptions.body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }

  // Attach in-memory access token if available
  if (inMemoryAccessToken && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", `Bearer ${inMemoryAccessToken}`);
  }

  const fetchOptions: RequestInit = {
    ...restOptions,
    headers: requestHeaders,
    credentials: "include", // Always include cookies for refresh token handling
  };

  let response = await fetch(url, fetchOptions);

  // Intercept 401 Unauthorized for token refresh (unless skipAuthRefresh is set or auth endpoints)
  const isAuthEndpoint =
    endpoint.includes("/api/auth/refresh") ||
    endpoint.includes("/api/auth/login") ||
    endpoint.includes("/api/auth/register");

  if (response.status === 401 && !skipAuthRefresh && !isAuthEndpoint) {
    if (isRefreshing) {
      // Queue this request until current refresh finishes
      return new Promise<T>((resolve, reject) => {
        addRefreshSubscriber(async (newToken) => {
          if (!newToken) {
            reject(new ApiError("Session expired", 401, "UNAUTHORIZED"));
            return;
          }
          try {
            const retryHeaders = new Headers(requestHeaders);
            retryHeaders.set("Authorization", `Bearer ${newToken}`);
            const retryRes = await fetch(url, {
              ...fetchOptions,
              headers: retryHeaders,
            });
            const data = await parseResponseBody<T>(retryRes);
            resolve(data);
          } catch (err) {
            reject(err);
          }
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!refreshResponse.ok) {
        setAccessToken(null);
        onRefreshed(null);
        throw new ApiError("Session refresh failed", 401, "SESSION_EXPIRED");
      }

      const refreshBody = (await refreshResponse.json()) as ApiResponse<AuthResponseData>;
      const newAccessToken = refreshBody.data?.accessToken || null;

      setAccessToken(newAccessToken);
      onRefreshed(newAccessToken);

      if (!newAccessToken) {
        throw new ApiError("No access token returned on refresh", 401, "SESSION_EXPIRED");
      }

      // Retry original request with new token
      requestHeaders.set("Authorization", `Bearer ${newAccessToken}`);
      response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
      });
    } catch (refreshErr) {
      setAccessToken(null);
      onRefreshed(null);
      throw refreshErr;
    } finally {
      isRefreshing = false;
    }
  }

  return parseResponseBody<T>(response);
}

async function parseResponseBody<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg =
      (isJson && body?.message) ||
      (isJson && body?.error) ||
      response.statusText ||
      "Request failed";
    const errorCode = isJson && body?.code;
    const validationErrors = isJson && body?.errors;

    throw new ApiError(errorMsg, response.status, errorCode, validationErrors);
  }

  return body as T;
}
