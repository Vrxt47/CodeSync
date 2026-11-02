import { checkDatabaseHealth } from "../config/database";

export interface HealthCheckResult {
  isHealthy: boolean;
  status: "healthy" | "degraded";
  database: "connected" | "disconnected";
  timestamp: string;
}

export class HealthService {
  public static async getHealth(): Promise<HealthCheckResult> {
    const isDbConnected = await checkDatabaseHealth();

    return {
      isHealthy: isDbConnected,
      status: isDbConnected ? "healthy" : "degraded",
      database: isDbConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  }
}
