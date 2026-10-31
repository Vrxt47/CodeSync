import type { Request, Response } from "express";
import { HealthService } from "../services/health.service";

export class HealthController {
  public static getHealth(_req: Request, res: Response): void {
    const health = HealthService.getHealth();
    res.status(200).json(health);
  }
}
