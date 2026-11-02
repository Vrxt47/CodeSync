import type { z } from "zod";
import type {
  fileTypeSchema,
  createFileSchema,
  updateFileSchema,
  fileIdParamSchema,
} from "./file.schema";

export type FileType = z.infer<typeof fileTypeSchema>;
export type CreateFileInput = z.infer<typeof createFileSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
export type FileIdParam = z.infer<typeof fileIdParamSchema>;

export interface FileItemResponse {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  type: FileType;
  createdAt: Date;
  updatedAt: Date;
}
