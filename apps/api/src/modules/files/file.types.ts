import type { z } from "zod";
import type {
  fileTypeSchema,
  createFileSchema,
  createFolderSchema,
  renameFileSchema,
  moveFileSchema,
  workspaceIdParamSchema,
  fileIdParamSchema,
} from "./file.schema";

export type FileType = z.infer<typeof fileTypeSchema>;
export type CreateFileInput = z.infer<typeof createFileSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type RenameFileInput = z.infer<typeof renameFileSchema>;
export type MoveFileInput = z.infer<typeof moveFileSchema>;
export type WorkspaceIdParam = z.infer<typeof workspaceIdParamSchema>;
export type FileIdParam = z.infer<typeof fileIdParamSchema>;

export interface FileItemResponse {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  type: FileType;
  content?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileTreeNode {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  type: FileType;
  createdAt: Date;
  updatedAt: Date;
  children?: FileTreeNode[];
}

export interface WorkspaceTreeResponse {
  workspaceId: string;
  tree: FileTreeNode[];
}
