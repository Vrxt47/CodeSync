import type { z } from "zod";
import type {
  workspaceRoleSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceIdParamSchema,
  addWorkspaceMemberSchema,
  updateMemberRoleSchema,
} from "./workspace.schema";

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type WorkspaceIdParam = z.infer<typeof workspaceIdParamSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}
