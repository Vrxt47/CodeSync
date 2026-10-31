"use client";

import { useState, useCallback } from "react";
import { ActivityBarItem, BottomPanelTab, EditorTab, FileNode } from "@/types/ide";
import { MOCK_FILE_TREE, findFileById, getAllFolderIds } from "@/data/mockWorkspace";

const DEFAULT_INITIAL_TABS: EditorTab[] = [
  {
    id: "file-main-cpp",
    name: "main.cpp",
    path: "src/main.cpp",
    extension: "cpp",
    language: "C++",
    content: findFileById(MOCK_FILE_TREE, "file-main-cpp")?.content || "",
  },
  {
    id: "file-helper-ts",
    name: "helper.ts",
    path: "src/utils/helper.ts",
    extension: "ts",
    language: "TypeScript",
    content: findFileById(MOCK_FILE_TREE, "file-helper-ts")?.content || "",
  },
  {
    id: "file-readme-md",
    name: "README.md",
    path: "README.md",
    extension: "md",
    language: "Markdown",
    content: findFileById(MOCK_FILE_TREE, "file-readme-md")?.content || "",
  },
];

export function useIDEState() {
  const [activeActivity, setActiveActivityState] = useState<ActivityBarItem>("explorer");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [fileTree, setFileTree] = useState<FileNode[]>(MOCK_FILE_TREE);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([
    "folder-src",
    "folder-components",
    "folder-utils",
    "folder-public",
  ]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>("file-main-cpp");
  const [openTabs, setOpenTabs] = useState<EditorTab[]>(DEFAULT_INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string | null>("file-main-cpp");
  const [bottomPanelTab, setBottomPanelTabState] = useState<BottomPanelTab>("terminal");
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState<boolean>(true);
  const [isBottomPanelMaximized, setIsBottomPanelMaximized] = useState<boolean>(false);

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
    setExpandedFolders(getAllFolderIds(fileTree));
  }, [fileTree]);

  const collapseAllFolders = useCallback(() => {
    setExpandedFolders([]);
  }, []);

  // File selection & Tabs
  const selectFile = useCallback(
    (file: FileNode) => {
      if (file.type === "folder") {
        toggleFolder(file.id);
        return;
      }

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
        };
        return [...prev, newTab];
      });

      setActiveTabId(file.id);
    },
    [toggleFolder]
  );

  const closeTab = useCallback((tabId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

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

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setSelectedFileId(tabId);
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

  // File explorer actions (local mock state)
  const createFile = useCallback(
    (name: string, parentFolderId?: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const ext = trimmed.includes(".") ? trimmed.split(".").pop() : "txt";
      const newFileId = `file-${Date.now()}`;
      const newFile: FileNode = {
        id: newFileId,
        name: trimmed,
        type: "file",
        path: parentFolderId ? `${parentFolderId}/${trimmed}` : trimmed,
        extension: ext,
        language: ext ? ext.toUpperCase() : "Plain Text",
        content: `// ${trimmed}\n// Created in CodeSync mock workspace\n`,
      };

      setFileTree((prev) => {
        if (!parentFolderId) {
          return [...prev, newFile];
        }
        function addRecurse(nodes: FileNode[]): FileNode[] {
          return nodes.map((node) => {
            if (node.id === parentFolderId && node.type === "folder") {
              return {
                ...node,
                children: [...(node.children || []), newFile],
              };
            }
            if (node.children) {
              return { ...node, children: addRecurse(node.children) };
            }
            return node;
          });
        }
        return addRecurse(prev);
      });

      selectFile(newFile);
    },
    [selectFile]
  );

  const createFolder = useCallback((name: string, parentFolderId?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const newFolderId = `folder-${Date.now()}`;
    const newFolder: FileNode = {
      id: newFolderId,
      name: trimmed,
      type: "folder",
      path: parentFolderId ? `${parentFolderId}/${trimmed}` : trimmed,
      children: [],
    };

    setFileTree((prev) => {
      if (!parentFolderId) {
        return [...prev, newFolder];
      }
      function addRecurse(nodes: FileNode[]): FileNode[] {
        return nodes.map((node) => {
          if (node.id === parentFolderId && node.type === "folder") {
            return {
              ...node,
              children: [...(node.children || []), newFolder],
            };
          }
          if (node.children) {
            return { ...node, children: addRecurse(node.children) };
          }
          return node;
        });
      }
      return addRecurse(prev);
    });

    setExpandedFolders((prev) => [...prev, newFolderId]);
  }, []);

  const refreshFileTree = useCallback(() => {
    setFileTree([...MOCK_FILE_TREE]);
  }, []);

  const activeTab = openTabs.find((t) => t.id === activeTabId) || null;

  return {
    activeActivity,
    setActiveActivity,
    isSidebarOpen,
    toggleSidebar,
    fileTree,
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
    bottomPanelTab,
    setBottomPanelTab,
    isBottomPanelOpen,
    toggleBottomPanel,
    isBottomPanelMaximized,
    toggleBottomPanelMaximized,
    createFile,
    createFolder,
    refreshFileTree,
  };
}
