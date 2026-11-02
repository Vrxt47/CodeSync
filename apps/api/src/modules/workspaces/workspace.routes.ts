import { Router } from "express";
import { WorkspaceController } from "./workspace.controller";
import {
  createWorkspaceSchema,
  renameWorkspaceSchema,
  workspaceIdParamSchema,
  listWorkspacesQuerySchema,
} from "./workspace.schema";
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
