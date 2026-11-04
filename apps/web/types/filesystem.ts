export type FileType = "FILE" | "FOLDER";

export interface FileSystemItem {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  type: FileType;
  content?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface FileTreeNode {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  type: FileType;
  path: string;
  extension?: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
  children?: FileTreeNode[];
}

export interface WorkspaceTreeData {
  workspaceId: string;
  tree: FileTreeNode[];
}

export interface CreateFileRequest {
  name: string;
  parentId?: string | null;
}

export interface CreateFolderRequest {
  name: string;
  parentId?: string | null;
}

export interface RenameRequest {
  name: string;
}

export interface MoveRequest {
  targetParentId: string | null;
}

export interface UpdateContentRequest {
  content: string;
  expectedVersion: number;
}
