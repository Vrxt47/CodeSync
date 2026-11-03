import { Router } from "express";
import { FileController } from "./file.controller";
import {
  renameFileSchema,
  moveFileSchema,
  updateFileContentSchema,
  fileIdParamSchema,
} from "./file.schema";
import { validate } from "../../middleware/validate.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";

export const fileRouter = Router();

// All file operations require authentication
fileRouter.use(authMiddleware);

// 1. GET /api/files/:fileId - Retrieve file content and metadata
fileRouter.get("/:fileId", validate({ params: fileIdParamSchema }), FileController.getById);

// 2. PUT /api/files/:fileId - Save file content
fileRouter.put(
  "/:fileId",
  validate({ params: fileIdParamSchema, body: updateFileContentSchema }),
  FileController.updateContent
);

// 3. PUT /api/files/:fileId/content - Save file content (alias)
fileRouter.put(
  "/:fileId/content",
  validate({ params: fileIdParamSchema, body: updateFileContentSchema }),
  FileController.updateContent
);

// 4. PATCH /api/files/:fileId - Rename a file or folder
fileRouter.patch(
  "/:fileId",
  validate({ params: fileIdParamSchema, body: renameFileSchema }),
  FileController.rename
);

// 5. DELETE /api/files/:fileId - Delete a file or recursively delete a folder
fileRouter.delete("/:fileId", validate({ params: fileIdParamSchema }), FileController.delete);

// 6. POST /api/files/:fileId/move - Move a file or folder to a new parent or workspace root
fileRouter.post(
  "/:fileId/move",
  validate({ params: fileIdParamSchema, body: moveFileSchema }),
  FileController.move
);
