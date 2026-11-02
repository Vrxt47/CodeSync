import { Router } from "express";
import { WorkspaceController } from "./workspace.controller";
import { FileController } from "../files/file.controller";
import {
  createWorkspaceSchema,
  renameWorkspaceSchema,
  workspaceIdParamSchema,
  listWorkspacesQuerySchema,
} from "./workspace.schema";
import { createFileSchema, createFolderSchema } from "../files/file.schema";
import { validate } from "../../middleware/validate.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";

export const workspaceRouter = Router();

// All workspace routes require authentication
workspaceRouter.use(authMiddleware);

// 1. POST /api/workspaces - Create workspace
workspaceRouter.post("/", validate({ body: createWorkspaceSchema }), WorkspaceController.create);

// 2. GET /api/workspaces - List user's workspaces (supports ?search=)
workspaceRouter.get("/", validate({ query: listWorkspacesQuerySchema }), WorkspaceController.list);

// 3. GET /api/workspaces/:workspaceId - Workspace details & access verification
workspaceRouter.get(
  "/:workspaceId",
  validate({ params: workspaceIdParamSchema }),
  WorkspaceController.getById
);

// 4. PATCH /api/workspaces/:workspaceId - Rename workspace (OWNER only)
workspaceRouter.patch(
  "/:workspaceId",
  validate({ params: workspaceIdParamSchema, body: renameWorkspaceSchema }),
  WorkspaceController.rename
);

// 5. DELETE /api/workspaces/:workspaceId - Delete workspace (OWNER only)
workspaceRouter.delete(
  "/:workspaceId",
  validate({ params: workspaceIdParamSchema }),
  WorkspaceController.delete
);

// 6. GET /api/workspaces/:workspaceId/files or /tree - Retrieve workspace directory tree
workspaceRouter.get(
  "/:workspaceId/files",
  validate({ params: workspaceIdParamSchema }),
  FileController.getWorkspaceTree
);
workspaceRouter.get(
  "/:workspaceId/tree",
  validate({ params: workspaceIdParamSchema }),
  FileController.getWorkspaceTree
);

// 7. POST /api/workspaces/:workspaceId/files - Create a file in workspace
workspaceRouter.post(
  "/:workspaceId/files",
  validate({ params: workspaceIdParamSchema, body: createFileSchema }),
  FileController.createFile
);

// 8. POST /api/workspaces/:workspaceId/folders - Create a folder in workspace
workspaceRouter.post(
  "/:workspaceId/folders",
  validate({ params: workspaceIdParamSchema, body: createFolderSchema }),
  FileController.createFolder
);
