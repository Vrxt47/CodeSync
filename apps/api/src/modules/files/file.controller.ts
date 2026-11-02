import type { Request, Response, NextFunction } from "express";
import { FileService } from "./file.service";

export class FileController {
  public static async getWorkspaceTree(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const workspaceId = req.params.workspaceId as string;
      const data = await FileService.getWorkspaceTree(workspaceId, userId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async createFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const workspaceId = req.params.workspaceId as string;
      const file = await FileService.createFile(workspaceId, userId, req.body);

      res.status(201).json({
        success: true,
        message: "File created successfully",
        data: file,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async createFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const workspaceId = req.params.workspaceId as string;
      const folder = await FileService.createFolder(workspaceId, userId, req.body);

      res.status(201).json({
        success: true,
        message: "Folder created successfully",
        data: folder,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async rename(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const fileId = req.params.fileId as string;
      const updated = await FileService.renameItem(fileId, userId, req.body);

      res.status(200).json({
        success: true,
        message: "Renamed successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const fileId = req.params.fileId as string;
      await FileService.deleteItem(fileId, userId);

      res.status(200).json({
        success: true,
        message: "Deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  public static async move(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const fileId = req.params.fileId as string;
      const moved = await FileService.moveItem(fileId, userId, req.body);

      res.status(200).json({
        success: true,
        message: "Moved successfully",
        data: moved,
      });
    } catch (error) {
      next(error);
    }
  }
}
