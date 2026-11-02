"use client";

import React, { useState } from "react";
import {
  FilePlus,
  FolderPlus,
  RotateCw,
  FolderArchive,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
  AlertCircle,
  FileCode,
  Folder,
} from "lucide-react";
import type { FileNode } from "@/types/ide";
import { FileTreeItem } from "./FileTreeItem";
import { Button } from "@/components/ui/button";

interface FileExplorerProps {
  workspaceName?: string;
  fileTree: FileNode[];
  isLoadingTree?: boolean;
  treeError?: string | null;
  expandedFolders: string[];
  selectedFileId: string | null;
  onToggleFolder: (folderId: string) => void;
  onSelectFile: (file: FileNode) => void;
  onCollapseAll: () => void;
  onRefresh: () => void;
  onCreateFile: (name: string, parentFolderId?: string) => Promise<void> | void;
  onCreateFolder: (name: string, parentFolderId?: string) => Promise<void> | void;
  onRenameItem?: (fileId: string, newName: string) => Promise<void> | void;
  onDeleteItem?: (fileId: string) => Promise<void> | void;
  onMoveItem?: (fileId: string, targetParentId: string | null) => Promise<void> | void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  workspaceName = "Workspace",
  fileTree,
  isLoadingTree = false,
  treeError = null,
  expandedFolders,
  selectedFileId,
  onToggleFolder,
  onSelectFile,
  onCollapseAll,
  onRefresh,
  onCreateFile,
  onCreateFolder,
  onRenameItem,
  onDeleteItem,
  onMoveItem,
}) => {
  const [isRootExpanded, setIsRootExpanded] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Inline creation states
  const [creatingType, setCreatingType] = useState<"file" | "folder" | null>(null);
  const [creatingUnderFolderId, setCreatingUnderFolderId] = useState<string | null>(null);
  const [rootItemName, setRootItemName] = useState<string>("");

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // Delete modal state
  const [nodeToDelete, setNodeToDelete] = useState<FileNode | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Notification / error feedback
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isRootDragOver, setIsRootDragOver] = useState<boolean>(false);

  const showError = (msg: string) => {
    setFeedbackError(msg);
    setTimeout(() => {
      setFeedbackError(null);
    }, 4500);
  };

  const handleStartCreateFile = (parentFolderId?: string) => {
    setCreatingType("file");
    setCreatingUnderFolderId(parentFolderId ?? null);
    if (!parentFolderId) {
      setRootItemName("");
    }
  };

  const handleStartCreateFolder = (parentFolderId?: string) => {
    setCreatingType("folder");
    setCreatingUnderFolderId(parentFolderId ?? null);
    if (!parentFolderId) {
      setRootItemName("");
    }
  };

  const handleRefreshClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    await Promise.resolve(onRefresh());
    setTimeout(() => setIsRefreshing(false), 300);
  };

  // Submit creation (both root and nested)
  const handleSubmitCreate = async (name: string, parentFolderId?: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setCreatingType(null);
      setCreatingUnderFolderId(null);
      setRootItemName("");
      return;
    }

    try {
      if (creatingType === "file") {
        await onCreateFile(trimmed, parentFolderId);
      } else if (creatingType === "folder") {
        await onCreateFolder(trimmed, parentFolderId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create item";
      showError(msg);
    } finally {
      setCreatingType(null);
      setCreatingUnderFolderId(null);
      setRootItemName("");
    }
  };

  const handleCancelCreate = () => {
    setCreatingType(null);
    setCreatingUnderFolderId(null);
    setRootItemName("");
  };

  // Rename handlers
  const handleStartRename = (node: FileNode) => {
    setRenamingId(node.id);
  };

  const handleSubmitRename = async (id: string, newName: string) => {
    const trimmed = newName.trim();
    setRenamingId(null);
    if (!trimmed || !onRenameItem) return;

    try {
      await onRenameItem(id, trimmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to rename item";
      showError(msg);
    }
  };

  const handleCancelRename = () => {
    setRenamingId(null);
  };

  // Move handler
  const handleMove = async (sourceId: string, targetParentId: string | null) => {
    if (!onMoveItem) return;
    try {
      await onMoveItem(sourceId, targetParentId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to move item";
      showError(msg);
    }
  };

  // Delete modal confirmation
  const handleConfirmDelete = async () => {
    if (!nodeToDelete || !onDeleteItem) return;
    try {
      setIsDeleting(true);
      await onDeleteItem(nodeToDelete.id);
      setNodeToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete item";
      showError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#181818] select-none text-[#CCCCCC] relative overflow-hidden">
      {/* Error feedback toast / banner */}
      {feedbackError && (
        <div className="absolute top-10 left-2 right-2 z-50 p-2.5 rounded bg-red-950/90 border border-red-700 text-red-200 text-xs shadow-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <span className="flex-1">{feedbackError}</span>
        </div>
      )}

      {/* Explorer Section Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-[#303030]/60 shrink-0">
        <span className="text-[11px] font-semibold tracking-wider text-[#858585] uppercase">
          Explorer
        </span>

        {/* Explorer toolbar actions */}
        <div className="flex items-center gap-0.5 text-[#858585]">
          <button
            onClick={() => handleStartCreateFile()}
            title="New File..."
            className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
            aria-label="New File"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleStartCreateFolder()}
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

      {/* Workspace Root Header / Drop Target for Root Move */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden pt-1 pb-4"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setIsRootDragOver(true);
        }}
        onDragLeave={() => setIsRootDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsRootDragOver(false);
          const draggedId = e.dataTransfer.getData("text/plain");
          if (draggedId) {
            handleMove(draggedId, null);
          }
        }}
      >
        <div
          onClick={() => setIsRootExpanded(!isRootExpanded)}
          className={`flex items-center gap-1.5 px-3 py-1 cursor-pointer font-bold text-[11px] tracking-wide text-white hover:bg-[#2A2D2E] transition-colors ${
            isRootDragOver ? "bg-[#007ACC]/30 ring-1 ring-[#007ACC]" : ""
          }`}
        >
          {isRootExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#858585]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#858585]" />
          )}
          <span className="uppercase truncate">{workspaceName}</span>
        </div>

        {/* Loading Tree Indicator */}
        {isLoadingTree && (
          <div className="py-8 flex flex-col items-center justify-center text-[#858585] gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#007ACC]" />
            <span className="text-[11px] font-mono">Loading files...</span>
          </div>
        )}

        {/* Tree Error State */}
        {!isLoadingTree && treeError && (
          <div className="p-3 mx-2 my-2 rounded bg-red-950/40 border border-red-800 text-xs text-red-300 space-y-2">
            <p>{treeError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-6 text-[11px] border-red-800 text-red-200 hover:bg-red-900/40"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Root-level inline file or folder creation */}
        {creatingType && creatingUnderFolderId === null && (
          <div className="px-5 py-1 flex items-center gap-1.5 bg-[#252526]">
            {creatingType === "folder" ? (
              <Folder className="h-4 w-4 text-[#D9A74A] shrink-0" />
            ) : (
              <FileCode className="h-4 w-4 text-[#858585] shrink-0" />
            )}
            <input
              type="text"
              autoFocus
              placeholder={creatingType === "file" ? "filename.ext" : "folder name"}
              value={rootItemName}
              onChange={(e) => setRootItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmitCreate(rootItemName);
                } else if (e.key === "Escape") {
                  handleCancelCreate();
                }
              }}
              onBlur={() => handleSubmitCreate(rootItemName)}
              className="flex-1 h-5 px-1.5 text-xs bg-[#1E1E1E] text-white border border-[#007ACC] rounded focus:outline-none"
            />
          </div>
        )}

        {/* Empty Workspace State */}
        {!isLoadingTree && !treeError && fileTree.length === 0 && (
          <div className="p-6 text-center text-[#858585] space-y-3">
            <p className="text-xs">No files in this workspace.</p>
            <div className="flex flex-col gap-1.5 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStartCreateFile()}
                className="h-7 text-xs border-[#303030] bg-[#252526] hover:bg-[#2A2D2E] text-white gap-1.5"
              >
                <FilePlus className="h-3.5 w-3.5 text-[#007ACC]" />
                New File
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStartCreateFolder()}
                className="h-7 text-xs border-[#303030] bg-[#252526] hover:bg-[#2A2D2E] text-white gap-1.5"
              >
                <FolderPlus className="h-3.5 w-3.5 text-[#D9A74A]" />
                New Folder
              </Button>
            </div>
          </div>
        )}

        {/* Tree items */}
        {!isLoadingTree && isRootExpanded && fileTree.length > 0 && (
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
                onStartCreateFile={handleStartCreateFile}
                onStartCreateFolder={handleStartCreateFolder}
                onStartRename={handleStartRename}
                onPromptDelete={(target) => setNodeToDelete(target)}
                onMove={handleMove}
                creatingUnderFolderId={creatingUnderFolderId}
                creatingType={creatingType}
                renamingId={renamingId}
                onSubmitCreate={handleSubmitCreate}
                onCancelCreate={handleCancelCreate}
                onSubmitRename={handleSubmitRename}
                onCancelRename={handleCancelRename}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {nodeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#1E1E1E] border border-red-900/60 rounded-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded bg-red-950/60 border border-red-800/80 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Delete{" "}
                  {nodeToDelete.type === "folder" || (nodeToDelete.type as string) === "FOLDER"
                    ? "Folder"
                    : "File"}
                  ?
                </h3>
                <p className="text-xs text-[#858585] mt-0.5">
                  Are you sure you want to delete{" "}
                  <strong className="text-white">{nodeToDelete.name}</strong>?
                </p>
              </div>
            </div>

            {(nodeToDelete.type === "folder" || (nodeToDelete.type as string) === "FOLDER") && (
              <p className="text-xs text-amber-400 bg-amber-950/30 p-2.5 rounded border border-amber-800/50">
                Warning: This folder and all of its nested files and subfolders will be permanently
                deleted.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#303030]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNodeToDelete(null)}
                disabled={isDeleting}
                className="h-8 text-xs border-[#303030] bg-[#252526] hover:bg-[#2A2D2E] text-white"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
