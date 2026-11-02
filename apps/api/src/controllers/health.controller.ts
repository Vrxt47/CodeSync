import type { Request, Response } from "express";
import { HealthService } from "../services/health.service";

export class HealthController {
  public static async getHealth(_req: Request, res: Response): Promise<void> {
    try {
      const health = await HealthService.getHealth();
      const statusCode = health.isHealthy ? 200 : 503;

      res.status(statusCode).json({
        success: health.isHealthy,
        status: health.isHealthy ? "success" : "error",
        message: health.isHealthy ? "CodeSync API is healthy" : "Database connection unavailable",
        data: {
          status: health.status,
          database: health.database,
          timestamp: health.timestamp,
        },
        timestamp: health.timestamp,
      });
    } catch {
      res.status(503).json({
        success: false,
        status: "error",
        message: "Health check failed",
        data: {
          status: "unhealthy",
          database: "disconnected",
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
