"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ActivityBarItem, BottomPanelTab, EditorTab, FileNode } from "@/types/ide";
import type { FileTreeNode } from "@/types/filesystem";
import { fileApi } from "@/lib/fileApi";
import { getExtensionFromName, getLanguageFromExtension } from "@/lib/languageUtils";

export interface UseIDEStateOptions {
  workspaceId?: string;
}

function convertTreeNodeToFileNode(node: FileTreeNode, parentPath = ""): FileNode {
  const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
  const isFolder = node.type === "FOLDER";
  const ext = !isFolder ? getExtensionFromName(node.name) : undefined;
  const lang = !isFolder ? getLanguageFromExtension(ext) : undefined;

  return {
    id: node.id,
    name: node.name,
    type: isFolder ? "folder" : "file",
    path: currentPath,
    parentId: node.parentId,
    workspaceId: node.workspaceId,
    extension: ext,
    language: lang,
    children: node.children
      ? node.children.map((child) => convertTreeNodeToFileNode(child, currentPath))
      : undefined,
  };
}

function getAllFolderIdsFromTree(nodes: FileNode[]): string[] {
  let ids: string[] = [];
  for (const node of nodes) {
    if (node.type === "folder" || (node.type as string) === "FOLDER") {
      ids.push(node.id);
      if (node.children) {
        ids = ids.concat(getAllFolderIdsFromTree(node.children));
      }
    }
  }
  return ids;
}

function findNodeById(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function collectSubtreeIds(node: FileNode): string[] {
  let ids = [node.id];
  if (node.children) {
    for (const child of node.children) {
      ids = ids.concat(collectSubtreeIds(child));
    }
  }
  return ids;
}

export function useIDEState(options?: UseIDEStateOptions) {
  const workspaceId = options?.workspaceId;

  const [activeActivity, setActiveActivityState] = useState<ActivityBarItem>("explorer");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(!!workspaceId);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [bottomPanelTab, setBottomPanelTabState] = useState<BottomPanelTab>("terminal");
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState<boolean>(true);
  const [isBottomPanelMaximized, setIsBottomPanelMaximized] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [cursorPosition, setCursorPosition] = useState<{ lineNumber: number; column: number }>({
    lineNumber: 1,
    column: 1,
  });
  const [activeLanguage, setActiveLanguage] = useState<string>("Plain Text");
  const [pendingTransition, setPendingTransition] = useState<{
    action: () => void;
    targetName: string;
  } | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch real database-backed directory tree
  const loadDirectoryTree = useCallback(async () => {
    if (!workspaceId) return;

    const seq = ++requestSeqRef.current;

    try {
      setIsLoadingTree(true);
      setTreeError(null);
      const rawTree = await fileApi.getWorkspaceTree(workspaceId);
      if (!isMountedRef.current || seq !== requestSeqRef.current) return;

      const convertedTree = rawTree.map((item) => convertTreeNodeToFileNode(item));
      setFileTree(convertedTree);

      // Preserve expanded folders if valid, or auto-expand top-level folders on initial load
      setExpandedFolders((prev) => {
        if (prev.length > 0) return prev;
        return convertedTree
          .filter((item) => item.type === "folder" || (item.type as string) === "FOLDER")
          .map((item) => item.id);
      });
    } catch (err: unknown) {
      if (!isMountedRef.current || seq !== requestSeqRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load directory tree";
      setTreeError(message);
    } finally {
      if (isMountedRef.current && seq === requestSeqRef.current) {
        setIsLoadingTree(false);
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      void loadDirectoryTree();
    }
  }, [workspaceId, loadDirectoryTree]);

  // Activity Bar item selection
  const setActiveActivity = useCallback(
    (item: ActivityBarItem) => {
      if (activeActivity === item) {
        setIsSidebarOpen((prev) => !prev);
      } else {
        setActiveActivityState(item);
        setIsSidebarOpen(true);
      }
    },
    [activeActivity]
  );

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Folder Expansion
  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    );
  }, []);

  const expandAllFolders = useCallback(() => {
    setExpandedFolders(getAllFolderIdsFromTree(fileTree));
  }, [fileTree]);

  const collapseAllFolders = useCallback(() => {
    setExpandedFolders([]);
  }, []);

  const activeTab = openTabs.find((t) => t.id === activeTabId) || null;

  // Tab content & dirty status synchronization
  const updateTabContent = useCallback((tabId: string, content: string, isDirty: boolean) => {
    setOpenTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, content, isDirty } : tab))
    );
  }, []);

  const markTabSaved = useCallback((tabId: string, savedContent: string) => {
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              content: savedContent,
              isDirty: false,
            }
          : tab
      )
    );
  }, []);

  // Internal direct tab/file actions
  const doSelectFile = useCallback((file: FileNode) => {
    setSelectedFileId(file.id);

    setOpenTabs((prev) => {
      const existing = prev.find((t) => t.id === file.id);
      if (existing) {
        return prev;
      }
      const newTab: EditorTab = {
        id: file.id,
        name: file.name,
        path: file.path,
        extension: file.extension,
        language: file.language || "Plain Text",
        content: file.content || "",
        isDirty: false,
      };
      return [...prev, newTab];
    });

    setActiveTabId(file.id);
  }, []);

  // File selection with unsaved changes interception
  const selectFile = useCallback(
    (file: FileNode) => {
      if (file.type === "folder" || (file.type as string) === "FOLDER") {
        toggleFolder(file.id);
        return;
      }

      if (activeTab?.isDirty && activeTab.id !== file.id) {
        setPendingTransition({
          action: () => doSelectFile(file),
          targetName: file.name,
        });
        return;
      }

      doSelectFile(file);
    },
    [activeTab, doSelectFile, toggleFolder]
  );

  const doCloseTab = useCallback((tabId: string) => {
    setOpenTabs((prev) => {
      const index = prev.findIndex((t) => t.id === tabId);
      if (index === -1) return prev;

      const nextTabs = prev.filter((t) => t.id !== tabId);

      // If closed tab was active, determine next active tab
      setActiveTabId((currentActiveId) => {
        if (currentActiveId !== tabId) return currentActiveId;
        if (nextTabs.length === 0) {
          setSelectedFileId(null);
          return null;
        }
        const nextActiveIndex = Math.min(index, nextTabs.length - 1);
        const nextActive = nextTabs[nextActiveIndex];
        if (nextActive) {
          setSelectedFileId(nextActive.id);
          return nextActive.id;
        }
        setSelectedFileId(null);
        return null;
      });

      return nextTabs;
    });
  }, []);

  const closeTab = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }

      const tabToClose = openTabs.find((t) => t.id === tabId);
      if (tabToClose?.isDirty) {
        setPendingTransition({
          action: () => doCloseTab(tabId),
          targetName: tabToClose.name,
        });
        return;
      }

      doCloseTab(tabId);
    },
    [doCloseTab, openTabs]
  );

  const doSetActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setSelectedFileId(tabId);
  }, []);

  const setActiveTab = useCallback(
    (tabId: string) => {
      if (activeTab?.isDirty && activeTab.id !== tabId) {
        const targetTab = openTabs.find((t) => t.id === tabId);
        setPendingTransition({
          action: () => doSetActiveTab(tabId),
          targetName: targetTab?.name || "file",
        });
        return;
      }

      doSetActiveTab(tabId);
    },
    [activeTab, doSetActiveTab, openTabs]
  );

  const cancelPendingTransition = useCallback(() => {
    setPendingTransition(null);
  }, []);

  const confirmPendingTransition = useCallback(() => {
    setPendingTransition(null);
  }, []);

  // Bottom Panel
  const setBottomPanelTab = useCallback((tab: BottomPanelTab) => {
    setBottomPanelTabState(tab);
    setIsBottomPanelOpen(true);
  }, []);

  const toggleBottomPanel = useCallback(() => {
    setIsBottomPanelOpen((prev) => !prev);
  }, []);

  const toggleBottomPanelMaximized = useCallback(() => {
    setIsBottomPanelMaximized((prev) => !prev);
  }, []);

  // Persistent File Explorer Operations
  const createFile = useCallback(
    async (name: string, parentFolderId?: string) => {
      const trimmed = name.trim();
      if (!trimmed || !workspaceId) return;

      try {
        setIsMutating(true);
        const created = await fileApi.createFile(workspaceId, {
          name: trimmed,
          parentId: parentFolderId ?? null,
        });

        await loadDirectoryTree();

        if (parentFolderId) {
          setExpandedFolders((prev) =>
            prev.includes(parentFolderId) ? prev : [...prev, parentFolderId]
          );
        }

        const ext = getExtensionFromName(created.name);
        const node: FileNode = {
          id: created.id,
          name: created.name,
          type: "file",
          path: created.name,
          extension: ext,
          language: getLanguageFromExtension(ext),
          content: created.content || "",
        };
        selectFile(node);
      } finally {
        setIsMutating(false);
      }
    },
    [workspaceId, loadDirectoryTree, selectFile]
  );

  const createFolder = useCallback(
    async (name: string, parentFolderId?: string) => {
      const trimmed = name.trim();
      if (!trimmed || !workspaceId) return;

      try {
        setIsMutating(true);
        const created = await fileApi.createFolder(workspaceId, {
          name: trimmed,
          parentId: parentFolderId ?? null,
        });

        await loadDirectoryTree();

        setExpandedFolders((prev) => [...prev, created.id]);
        if (parentFolderId) {
          setExpandedFolders((prev) =>
            prev.includes(parentFolderId) ? prev : [...prev, parentFolderId]
          );
        }
      } finally {
        setIsMutating(false);
      }
    },
    [workspaceId, loadDirectoryTree]
  );

  const renameItem = useCallback(
    async (fileId: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || !workspaceId) return;

      try {
        setIsMutating(true);
        const updated = await fileApi.renameItem(fileId, { name: trimmed });
        await loadDirectoryTree();

        // If open in tabs, update tab name & path
        setOpenTabs((prev) =>
          prev.map((tab) =>
            tab.id === fileId
              ? {
                  ...tab,
                  name: updated.name,
                  extension: getExtensionFromName(updated.name),
                  language: getLanguageFromExtension(getExtensionFromName(updated.name)),
                }
              : tab
          )
        );
      } finally {
        setIsMutating(false);
      }
    },
    [workspaceId, loadDirectoryTree]
  );

  const deleteItem = useCallback(
    async (fileId: string) => {
      if (!workspaceId) return;

      try {
        setIsMutating(true);

        // Find node to close any open tabs inside its subtree
        const targetNode = findNodeById(fileTree, fileId);
        const idsToClose = targetNode ? collectSubtreeIds(targetNode) : [fileId];

        await fileApi.deleteItem(fileId);
        await loadDirectoryTree();

        // Close associated tabs
        for (const id of idsToClose) {
          closeTab(id);
        }
      } finally {
        setIsMutating(false);
      }
    },
    [workspaceId, fileTree, loadDirectoryTree, closeTab]
  );

  const moveItem = useCallback(
    async (fileId: string, targetParentId: string | null) => {
      if (!workspaceId) return;

      try {
        setIsMutating(true);
        await fileApi.moveItem(fileId, { targetParentId });
        await loadDirectoryTree();

        if (targetParentId) {
          setExpandedFolders((prev) =>
            prev.includes(targetParentId) ? prev : [...prev, targetParentId]
          );
        }
      } finally {
        setIsMutating(false);
      }
    },
    [workspaceId, loadDirectoryTree]
  );

  const refreshFileTree = useCallback(async () => {
    if (workspaceId) {
      await loadDirectoryTree();
    }
  }, [workspaceId, loadDirectoryTree]);

  return {
    activeActivity,
    setActiveActivity,
    isSidebarOpen,
    toggleSidebar,
    fileTree,
    isLoadingTree,
    treeError,
    expandedFolders,
    toggleFolder,
    expandAllFolders,
    collapseAllFolders,
    selectedFileId,
    selectFile,
    openTabs,
    activeTabId,
    activeTab,
    setActiveTab,
    closeTab,
    updateTabContent,
    markTabSaved,
    cursorPosition,
    setCursorPosition,
    activeLanguage,
    setActiveLanguage,
    pendingTransition,
    cancelPendingTransition,
    confirmPendingTransition,
    bottomPanelTab,
    setBottomPanelTab,
    isBottomPanelOpen,
    toggleBottomPanel,
    isBottomPanelMaximized,
    toggleBottomPanelMaximized,
    createFile,
    createFolder,
    renameItem,
    deleteItem,
    moveItem,
    refreshFileTree,
    isMutating,
  };
}
