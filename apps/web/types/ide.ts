export type FileType = "file" | "folder" | "FILE" | "FOLDER";

export interface FileNode {
  id: string;
  name: string;
  type: FileType;
  path: string;
  extension?: string;
  parentId?: string | null;
  workspaceId?: string;
  children?: FileNode[];
  content?: string;
  language?: string;
  version?: number;
  updatedAt?: string;
}

export type ActivityBarItem = "explorer" | "search" | "source-control" | "extensions" | "settings";

export type BottomPanelTab = "output" | "terminal" | "problems";

export interface EditorTab {
  id: string;
  name: string;
  path: string;
  language: string;
  extension?: string;
  content: string;
  savedContent?: string;
  isDirty?: boolean;
  isLoaded: boolean;
  version?: number;
  updatedAt?: string;
}

export interface IDEState {
  activeActivity: ActivityBarItem;
  isSidebarOpen: boolean;
  expandedFolders: string[];
  selectedFileId: string | null;
  openTabs: EditorTab[];
  activeTabId: string | null;
  bottomPanelTab: BottomPanelTab;
  isBottomPanelOpen: boolean;
  isBottomPanelMaximized: boolean;
}
