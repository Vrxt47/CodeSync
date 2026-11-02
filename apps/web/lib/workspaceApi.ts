import { apiClient } from "./apiClient";
import type {
  Workspace,
  CreateWorkspaceInput,
  RenameWorkspaceInput,
  WorkspaceApiResponse,
} from "../types/workspace";

export const workspaceApi = {
  /**
   * Fetch all workspaces for the current authenticated user,
   * optionally filtered by a case-insensitive search string.
   */
  async listWorkspaces(search?: string): Promise<Workspace[]> {
    const query = search && search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    const res = await apiClient<WorkspaceApiResponse<Workspace[]>>(`/api/workspaces${query}`);
    return res.data ?? [];
  },

  /**
   * Fetch detailed workspace information and verify membership access.
   * Updates lastAccessedAt on the server.
   */
  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const res = await apiClient<WorkspaceApiResponse<Workspace>>(`/api/workspaces/${workspaceId}`);
    if (!res.data) {
      throw new Error(res.message || "Failed to load workspace details");
    }
    return res.data;
  },

  /**
   * Create a new workspace, assigning the caller as OWNER.
   */
  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const res = await apiClient<WorkspaceApiResponse<Workspace>>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!res.data) {
      throw new Error(res.message || "Failed to create workspace");
    }
    return res.data;
  },

  /**
   * Rename an existing workspace (OWNER only).
   */
  async renameWorkspace(workspaceId: string, input: RenameWorkspaceInput): Promise<Workspace> {
    const res = await apiClient<WorkspaceApiResponse<Workspace>>(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    if (!res.data) {
      throw new Error(res.message || "Failed to rename workspace");
    }
    return res.data;
  },

  /**
   * Delete an existing workspace and cascade all dependent data (OWNER only).
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    await apiClient<WorkspaceApiResponse<void>>(`/api/workspaces/${workspaceId}`, {
      method: "DELETE",
    });
  },
};
