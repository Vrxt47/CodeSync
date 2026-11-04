import type { Request, Response, NextFunction } from "express";
import { FormattingService } from "./formatting.service";

export class FormattingController {
  public static async format(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const result = await FormattingService.format(userId, req.body);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
