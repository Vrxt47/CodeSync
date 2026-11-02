import { Router } from "express";
import { FileController } from "./file.controller";
import { renameFileSchema, moveFileSchema, fileIdParamSchema } from "./file.schema";
import { validate } from "../../middleware/validate.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";

export const fileRouter = Router();

// All file operations require authentication
fileRouter.use(authMiddleware);

// 1. PATCH /api/files/:fileId - Rename a file or folder
fileRouter.patch(
  "/:fileId",
  validate({ params: fileIdParamSchema, body: renameFileSchema }),
  FileController.rename
);

// 2. DELETE /api/files/:fileId - Delete a file or recursively delete a folder
fileRouter.delete("/:fileId", validate({ params: fileIdParamSchema }), FileController.delete);

// 3. POST /api/files/:fileId/move - Move a file or folder to a new parent or workspace root
fileRouter.post(
  "/:fileId/move",
  validate({ params: fileIdParamSchema, body: moveFileSchema }),
  FileController.move
);
