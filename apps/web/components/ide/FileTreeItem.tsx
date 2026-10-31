"use client";

import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  Image as ImageIcon,
  File as GenericFile,
} from "lucide-react";
import { FileNode } from "@/types/ide";

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  expandedFolders: string[];
  selectedFileId: string | null;
  onToggleFolder: (folderId: string) => void;
  onSelectFile: (file: FileNode) => void;
}

export function getFileIcon(extension?: string) {
  const ext = extension?.toLowerCase();
  switch (ext) {
    case "cpp":
    case "cc":
    case "c":
    case "h":
    case "hpp":
      return <FileCode className="h-4 w-4 text-[#5E97D0] shrink-0" />;
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
    case "svg":
    case "png":
    case "jpg":
      return <ImageIcon className="h-4 w-4 text-[#FFB13B] shrink-0" />;
    case "gitignore":
      return <FileText className="h-4 w-4 text-[#E44D26] shrink-0" />;
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
}) => {
  const isFolder = node.type === "folder";
  const isExpanded = expandedFolders.includes(node.id);
  const isSelected = selectedFileId === node.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      onToggleFolder(node.id);
    } else {
      onSelectFile(node);
    }
  };

  const paddingLeft = depth * 14 + 10;

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${paddingLeft}px` }}
        className={`flex items-center gap-1.5 py-1 pr-2 cursor-pointer text-xs transition-colors select-none group ${
          isSelected ? "bg-[#094771] text-white font-medium" : "text-[#CCCCCC] hover:bg-[#2A2D2E]"
        }`}
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
            <span className="truncate">{node.name}</span>
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            {getFileIcon(node.extension)}
            <span className="truncate">{node.name}</span>
          </>
        )}
      </div>

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
            />
          ))}
        </div>
      )}
    </div>
  );
};
