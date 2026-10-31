import type { HealthCheckResponse } from "@codesync/shared";

export class HealthService {
  public static getHealth(): HealthCheckResponse {
    return {
      status: "success",
      message: "CodeSync API is running",
      timestamp: new Date().toISOString(),
    };
  }
}
