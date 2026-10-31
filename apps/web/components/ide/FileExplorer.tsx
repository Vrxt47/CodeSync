"use client";

import React, { useState } from "react";
import {
  FilePlus,
  FolderPlus,
  RotateCw,
  FolderArchive,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { FileNode } from "@/types/ide";
import { FileTreeItem } from "./FileTreeItem";

interface FileExplorerProps {
  workspaceName?: string;
  fileTree: FileNode[];
  expandedFolders: string[];
  selectedFileId: string | null;
  onToggleFolder: (folderId: string) => void;
  onSelectFile: (file: FileNode) => void;
  onCollapseAll: () => void;
  onRefresh: () => void;
  onCreateFile: (name: string, parentFolderId?: string) => void;
  onCreateFolder: (name: string, parentFolderId?: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  workspaceName = "MY-WORKSPACE",
  fileTree,
  expandedFolders,
  selectedFileId,
  onToggleFolder,
  onSelectFile,
  onCollapseAll,
  onRefresh,
  onCreateFile,
  onCreateFolder,
}) => {
  const [isRootExpanded, setIsRootExpanded] = useState<boolean>(true);
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleStartCreateFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCreatingFolder(false);
    setIsCreatingFile(true);
    setNewItemName("");
  };

  const handleStartCreateFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCreatingFile(false);
    setIsCreatingFolder(true);
    setNewItemName("");
  };

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (newItemName.trim()) {
        if (isCreatingFile) {
          onCreateFile(newItemName.trim());
        } else if (isCreatingFolder) {
          onCreateFolder(newItemName.trim());
        }
      }
      setIsCreatingFile(false);
      setIsCreatingFolder(false);
      setNewItemName("");
    } else if (e.key === "Escape") {
      setIsCreatingFile(false);
      setIsCreatingFolder(false);
      setNewItemName("");
    }
  };

  const handleInputBlur = () => {
    if (newItemName.trim()) {
      if (isCreatingFile) {
        onCreateFile(newItemName.trim());
      } else if (isCreatingFolder) {
        onCreateFolder(newItemName.trim());
      }
    }
    setIsCreatingFile(false);
    setIsCreatingFolder(false);
    setNewItemName("");
  };

  return (
    <div className="flex flex-col h-full bg-[#181818] select-none text-[#CCCCCC]">
      {/* Sidebar Section Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-[#303030]/60 shrink-0">
        <span className="text-[11px] font-semibold tracking-wider text-[#858585] uppercase">
          Explorer
        </span>

        {/* Explorer toolbar actions */}
        <div className="flex items-center gap-0.5 text-[#858585]">
          <button
            onClick={handleStartCreateFile}
            title="New File..."
            className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
            aria-label="New File"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleStartCreateFolder}
            title="New Folder..."
            className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
            aria-label="New Folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleRefreshClick}
            title="Refresh Explorer"
            className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
            aria-label="Refresh Explorer"
          >
            <RotateCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-[#007ACC]" : ""}`}
            />
          </button>
          <button
            onClick={onCollapseAll}
            title="Collapse Folders in Explorer"
            className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
            aria-label="Collapse Folders"
          >
            <FolderArchive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Workspace Root Header */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-1 pb-4">
        <div
          onClick={() => setIsRootExpanded(!isRootExpanded)}
          className="flex items-center gap-1.5 px-3 py-1 cursor-pointer font-bold text-[11px] tracking-wide text-white hover:bg-[#2A2D2E] transition-colors"
        >
          {isRootExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#858585]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#858585]" />
          )}
          <span className="uppercase">{workspaceName}</span>
        </div>

        {/* Inline file/folder creation input */}
        {(isCreatingFile || isCreatingFolder) && (
          <div className="px-5 py-1">
            <input
              type="text"
              autoFocus
              placeholder={isCreatingFile ? "filename.ext" : "folder name"}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              className="w-full h-6 px-1.5 text-xs bg-[#252526] text-white border border-[#007ACC] rounded focus:outline-none"
            />
          </div>
        )}

        {/* Tree items */}
        {isRootExpanded && (
          <div className="mt-0.5">
            {fileTree.map((node) => (
              <FileTreeItem
                key={node.id}
                node={node}
                depth={0}
                expandedFolders={expandedFolders}
                selectedFileId={selectedFileId}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
