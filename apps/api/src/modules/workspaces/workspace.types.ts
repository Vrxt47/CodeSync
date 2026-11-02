import type { z } from "zod";
import type {
  workspaceRoleSchema,
  createWorkspaceSchema,
  renameWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceIdParamSchema,
  listWorkspacesQuerySchema,
  addWorkspaceMemberSchema,
  updateMemberRoleSchema,
} from "./workspace.schema";

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type RenameWorkspaceInput = z.infer<typeof renameWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type WorkspaceIdParam = z.infer<typeof workspaceIdParamSchema>;
export type ListWorkspacesQuery = z.infer<typeof listWorkspacesQuerySchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export interface WorkspaceOwner {
  id: string;
  name: string;
  email: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  lastAccessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  role: WorkspaceRole;
  memberCount: number;
  owner?: WorkspaceOwner;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}
