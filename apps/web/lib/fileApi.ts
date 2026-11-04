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
   * Save/update a file's content by ID with mandatory optimistic concurrency revision locking.
   */
  async updateFileContent(
    fileId: string,
    content: string,
    expectedVersion: number
  ): Promise<FileSystemItem> {
    if (typeof expectedVersion !== "number" || Number.isNaN(expectedVersion)) {
      throw new Error("expectedVersion is required to save file content");
    }

    const res = await apiClient<ApiResponse<FileSystemItem>>(`/api/files/${fileId}`, {
      method: "PUT",
      body: JSON.stringify({ content, expectedVersion }),
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

  /**
   * Format code content using language-specific formatter.
   */
  async formatFile(fileId: string, content: string, language: string): Promise<string> {
    const res = await apiClient<ApiResponse<{ formattedContent: string }>>("/api/format", {
      method: "POST",
      body: JSON.stringify({ fileId, content, language }),
    });
    if (!res.data?.formattedContent) {
      throw new Error(res.message || "Failed to format code");
    }
    return res.data.formattedContent;
  },
};
