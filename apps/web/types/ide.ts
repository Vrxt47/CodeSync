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
  isDirty?: boolean;
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
