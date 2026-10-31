export interface ApiResponse<T = unknown> {
  status: "success" | "error";
  message?: string;
  data?: T;
  timestamp: string;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  status: "error";
  message: string;
  errors?: ApiErrorDetail[];
  statusCode: number;
  timestamp: string;
}

export interface HealthCheckResponse {
  status: "success";
  message: string;
  timestamp: string;
  version?: string;
  services?: {
    database?: "healthy" | "unhealthy" | "disconnected";
    redis?: "healthy" | "unhealthy" | "disconnected";
  };
}
