import type { Request, Response, NextFunction } from "express";
import { WorkspaceService } from "./workspace.service";

export class WorkspaceController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const workspace = await WorkspaceService.createWorkspace(userId, req.body);

      res.status(201).json({
        success: true,
        message: "Workspace created successfully",
        data: workspace,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const workspaces = await WorkspaceService.getUserWorkspaces(userId, search);

      res.status(200).json({
        success: true,
        data: workspaces,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const workspaceId = req.params.workspaceId as string;
      const workspace = await WorkspaceService.getWorkspaceDetails(workspaceId, userId);

      res.status(200).json({
        success: true,
        data: workspace,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async rename(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const workspaceId = req.params.workspaceId as string;
      const workspace = await WorkspaceService.renameWorkspace(workspaceId, userId, req.body);

      res.status(200).json({
        success: true,
        message: "Workspace updated successfully",
        data: workspace,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const workspaceId = req.params.workspaceId as string;
      await WorkspaceService.deleteWorkspace(workspaceId, userId);

      res.status(200).json({
        success: true,
        message: "Workspace deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}
