import { apiClient } from "./apiClient";
import type {
  FileSystemItem,
  FileTreeNode,
  WorkspaceTreeData,
  CreateFileRequest,
  CreateFolderRequest,
  RenameRequest,
  MoveRequest,
  UpdateContentRequest,
} from "../types/filesystem";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
}

export const fileApi = {
  /**
   * Retrieve the complete directory tree for a workspace.
   */
  async getWorkspaceTree(workspaceId: string): Promise<FileTreeNode[]> {
    const res = await apiClient<ApiResponse<WorkspaceTreeData>>(
      `/api/workspaces/${workspaceId}/files`
    );
    return res.data?.tree ?? [];
  },

  /**
   * Retrieve a single file's full metadata and content by ID.
   */
  async getFile(fileId: string): Promise<FileSystemItem> {
    const res = await apiClient<ApiResponse<FileSystemItem>>(`/api/files/${fileId}`);
    if (!res.data) throw new Error(res.message || "Failed to load file");
    return res.data;
  },

  /**
   * Save/update a file's content by ID.
   */
  async updateFileContent(fileId: string, content: string): Promise<FileSystemItem> {
    const res = await apiClient<ApiResponse<FileSystemItem>>(`/api/files/${fileId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    if (!res.data) throw new Error(res.message || "Failed to save file content");
    return res.data;
  },

  /**
   * Create a new file in the specified workspace and parent folder.
   */
  async createFile(workspaceId: string, input: CreateFileRequest): Promise<FileSystemItem> {
    const res = await apiClient<ApiResponse<FileSystemItem>>(
      `/api/workspaces/${workspaceId}/files`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
    if (!res.data) throw new Error(res.message || "Failed to create file");
    return res.data;
  },

  /**
   * Create a new folder in the specified workspace and parent folder.
   */
  async createFolder(workspaceId: string, input: CreateFolderRequest): Promise<FileSystemItem> {
    const res = await apiClient<ApiResponse<FileSystemItem>>(
      `/api/workspaces/${workspaceId}/folders`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
    if (!res.data) throw new Error(res.message || "Failed to create folder");
    return res.data;
  },

  /**
   * Rename a file or folder by ID.
   */
  async renameItem(fileId: string, input: RenameRequest): Promise<FileSystemItem> {
    const res = await apiClient<ApiResponse<FileSystemItem>>(`/api/files/${fileId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    if (!res.data) throw new Error(res.message || "Failed to rename item");
    return res.data;
  },

  /**
   * Delete a file or recursively delete a folder and all descendants.
   */
  async deleteItem(fileId: string): Promise<void> {
    await apiClient<ApiResponse<void>>(`/api/files/${fileId}`, {
      method: "DELETE",
    });
  },

  /**
   * Move a file or folder into a destination parent folder or root (null).
   */
  async moveItem(fileId: string, input: MoveRequest): Promise<FileSystemItem> {
    const res = await apiClient<ApiResponse<FileSystemItem>>(`/api/files/${fileId}/move`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!res.data) throw new Error(res.message || "Failed to move item");
    return res.data;
  },
};
