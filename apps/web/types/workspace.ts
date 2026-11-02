export type WorkspaceRole = "OWNER" | "EDITOR" | "VIEWER";

export interface WorkspaceOwner {
  id: string;
  name: string;
  email: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: WorkspaceRole;
  memberCount: number;
  owner?: WorkspaceOwner;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string | null;
}

export interface RenameWorkspaceInput {
  name: string;
  description?: string | null;
}

export interface WorkspaceApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}
