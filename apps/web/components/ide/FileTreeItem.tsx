"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FileSpreadsheet,
  FilePlus,
  FolderPlus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  File as GenericFile,
} from "lucide-react";
import type { FileNode } from "@/types/ide";

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  expandedFolders: string[];
  selectedFileId: string | null;
  onToggleFolder: (folderId: string) => void;
  onSelectFile: (file: FileNode) => void;
  onStartCreateFile: (parentFolderId: string) => void;
  onStartCreateFolder: (parentFolderId: string) => void;
  onStartRename: (node: FileNode) => void;
  onPromptDelete: (node: FileNode) => void;
  onMove: (sourceId: string, targetParentId: string | null) => void;
  creatingUnderFolderId: string | null;
  creatingType: "file" | "folder" | null;
  renamingId: string | null;
  onSubmitCreate: (name: string, parentId?: string) => void;
  onCancelCreate: () => void;
  onSubmitRename: (id: string, newName: string) => void;
  onCancelRename: () => void;
}

export function getFileIcon(extension?: string, name?: string) {
  const ext = extension?.toLowerCase();
  const lowerName = name?.toLowerCase() || "";

  if (lowerName === ".gitignore") {
    return <FileText className="h-4 w-4 text-[#F05032] shrink-0" />;
  }
  if (lowerName === "package.json") {
    return <FileJson className="h-4 w-4 text-[#CB3837] shrink-0" />;
  }

  switch (ext) {
    case "py":
      return <FileCode className="h-4 w-4 text-[#3572A5] shrink-0" />;
    case "java":
      return <FileCode className="h-4 w-4 text-[#B07219] shrink-0" />;
    case "cpp":
    case "cc":
    case "cxx":
    case "c":
    case "h":
    case "hpp":
      return <FileCode className="h-4 w-4 text-[#F34B7D] shrink-0" />;
    case "ts":
      return <FileCode className="h-4 w-4 text-[#3178C6] shrink-0" />;
    case "tsx":
      return <FileCode className="h-4 w-4 text-[#00D8FF] shrink-0" />;
    case "js":
      return <FileCode className="h-4 w-4 text-[#F7DF1E] shrink-0" />;
    case "jsx":
      return <FileCode className="h-4 w-4 text-[#61DAFB] shrink-0" />;
    case "json":
      return <FileJson className="h-4 w-4 text-[#CBCB41] shrink-0" />;
    case "md":
      return <FileText className="h-4 w-4 text-[#519ABA] shrink-0" />;
    case "html":
      return <FileCode className="h-4 w-4 text-[#E34F26] shrink-0" />;
    case "css":
    case "scss":
      return <FileCode className="h-4 w-4 text-[#563D7C] shrink-0" />;
    case "svg":
    case "png":
    case "jpg":
    case "jpeg":
    case "ico":
      return <ImageIcon className="h-4 w-4 text-[#FFB13B] shrink-0" />;
    case "csv":
      return <FileSpreadsheet className="h-4 w-4 text-[#217346] shrink-0" />;
    default:
      return <GenericFile className="h-4 w-4 text-[#858585] shrink-0" />;
  }
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  depth,
  expandedFolders,
  selectedFileId,
  onToggleFolder,
  onSelectFile,
  onStartCreateFile,
  onStartCreateFolder,
  onStartRename,
  onPromptDelete,
  onMove,
  creatingUnderFolderId,
  creatingType,
  renamingId,
  onSubmitCreate,
  onCancelCreate,
  onSubmitRename,
  onCancelRename,
}) => {
  const isFolder = node.type === "folder" || (node.type as string) === "FOLDER";
  const isExpanded = expandedFolders.includes(node.id);
  const isSelected = selectedFileId === node.id;
  const isRenaming = renamingId === node.id;
  const isCreatingChild = creatingUnderFolderId === node.id;

  const [renameValue, setRenameValue] = useState(node.name);
  const [createValue, setCreateValue] = useState("");
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(node.name);
    }
  }, [isRenaming, node.name]);

  useEffect(() => {
    if (isCreatingChild) {
      setCreateValue("");
    }
  }, [isCreatingChild]);

  // Click outside to dismiss context menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenuPos(null);
      }
    };
    if (contextMenuPos) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [contextMenuPos]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRenaming) return;

    if (isFolder) {
      onToggleFolder(node.id);
    } else {
      onSelectFile(node);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId && draggedId !== node.id) {
      onMove(draggedId, node.id);
    }
  };

  const paddingLeft = depth * 14 + 10;

  return (
    <div className="w-full relative">
      {/* Tree Node Row */}
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ paddingLeft: `${paddingLeft}px` }}
        className={`flex items-center gap-1.5 py-1 pr-2 cursor-pointer text-xs transition-colors select-none group relative ${
          isSelected ? "bg-[#094771] text-white font-medium" : "text-[#CCCCCC] hover:bg-[#2A2D2E]"
        } ${isDragOver ? "bg-[#007ACC]/30 ring-1 ring-[#007ACC]" : ""}`}
      >
        {isFolder ? (
          <>
            <span className="text-[#858585] group-hover:text-white transition-colors">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              )}
            </span>
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-[#D9A74A] shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-[#D9A74A] shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            {getFileIcon(node.extension, node.name)}
          </>
        )}

        {isRenaming ? (
          <input
            type="text"
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                onSubmitRename(node.id, renameValue);
              } else if (e.key === "Escape") {
                onCancelRename();
              }
            }}
            onBlur={() => onSubmitRename(node.id, renameValue)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 h-5 px-1 text-xs bg-[#252526] text-white border border-[#007ACC] rounded focus:outline-none"
          />
        ) : (
          <span className="truncate flex-1">{node.name}</span>
        )}
      </div>

      {/* Context Menu Popup */}
      {contextMenuPos && (
        <div
          ref={menuRef}
          style={{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }}
          className="fixed z-50 w-44 bg-[#252526] border border-[#3A3D41] rounded shadow-xl py-1 text-xs text-[#CCCCCC] select-none animate-in fade-in duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {isFolder && (
            <>
              <button
                onClick={() => {
                  setContextMenuPos(null);
                  onStartCreateFile(node.id);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#007ACC] hover:text-white flex items-center gap-2 transition-colors"
              >
                <FilePlus className="h-3.5 w-3.5" />
                New File...
              </button>
              <button
                onClick={() => {
                  setContextMenuPos(null);
                  onStartCreateFolder(node.id);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#007ACC] hover:text-white flex items-center gap-2 transition-colors"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                New Folder...
              </button>
              <div className="my-1 border-t border-[#303030]" />
            </>
          )}

          <button
            onClick={() => {
              setContextMenuPos(null);
              onStartRename(node);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#007ACC] hover:text-white flex items-center gap-2 transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Rename
          </button>

          <button
            onClick={() => {
              setContextMenuPos(null);
              onPromptDelete(node);
            }}
            className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}

      {/* Inline child item creation input under this folder */}
      {isFolder && isCreatingChild && (
        <div
          style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
          className="flex items-center gap-1.5 py-1 pr-2 bg-[#252526]"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="w-3.5 shrink-0" />
          {creatingType === "folder" ? (
            <Folder className="h-4 w-4 text-[#D9A74A] shrink-0" />
          ) : (
            <FileCode className="h-4 w-4 text-[#858585] shrink-0" />
          )}
          <input
            type="text"
            autoFocus
            placeholder={creatingType === "folder" ? "folder name" : "filename.ext"}
            value={createValue}
            onChange={(e) => setCreateValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                onSubmitCreate(createValue, node.id);
              } else if (e.key === "Escape") {
                onCancelCreate();
              }
            }}
            onBlur={() => onSubmitCreate(createValue, node.id)}
            className="flex-1 h-5 px-1 text-xs bg-[#1E1E1E] text-white border border-[#007ACC] rounded focus:outline-none"
          />
        </div>
      )}

      {/* Recursive children */}
      {isFolder && isExpanded && node.children && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              selectedFileId={selectedFileId}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
              onStartCreateFile={onStartCreateFile}
              onStartCreateFolder={onStartCreateFolder}
              onStartRename={onStartRename}
              onPromptDelete={onPromptDelete}
              onMove={onMove}
              creatingUnderFolderId={creatingUnderFolderId}
              creatingType={creatingType}
              renamingId={renamingId}
              onSubmitCreate={onSubmitCreate}
              onCancelCreate={onCancelCreate}
              onSubmitRename={onSubmitRename}
              onCancelRename={onCancelRename}
            />
          ))}
        </div>
      )}
    </div>
  );
};
