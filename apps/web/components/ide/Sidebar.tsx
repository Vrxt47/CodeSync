"use client";

import React from "react";
import {
  Search as SearchIcon,
  GitBranch,
  Blocks,
  Settings as SettingsIcon,
  Check,
} from "lucide-react";
import { ActivityBarItem, FileNode } from "@/types/ide";
import { FileExplorer } from "./FileExplorer";

interface SidebarProps {
  activeActivity: ActivityBarItem;
  isOpen: boolean;
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

export const Sidebar: React.FC<SidebarProps> = ({
  activeActivity,
  isOpen,
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
  if (!isOpen) {
    return null;
  }

  return (
    <aside className="w-64 bg-[#181818] border-r border-[#303030] flex flex-col h-full overflow-hidden shrink-0 select-none z-10">
      {activeActivity === "explorer" && (
        <FileExplorer
          workspaceName={workspaceName}
          fileTree={fileTree}
          expandedFolders={expandedFolders}
          selectedFileId={selectedFileId}
          onToggleFolder={onToggleFolder}
          onSelectFile={onSelectFile}
          onCollapseAll={onCollapseAll}
          onRefresh={onRefresh}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
        />
      )}

      {activeActivity === "search" && (
        <div className="flex flex-col h-full text-[#CCCCCC]">
          <div className="h-9 px-3 flex items-center border-b border-[#303030]/60">
            <span className="text-[11px] font-semibold tracking-wider text-[#858585] uppercase">
              Search
            </span>
          </div>
          <div className="p-3 space-y-3">
            <div className="relative">
              <SearchIcon className="h-3.5 w-3.5 text-[#858585] absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search"
                className="w-full h-7 bg-[#252526] border border-[#303030] rounded pl-8 pr-2 text-xs text-[#CCCCCC] focus:outline-none focus:border-[#007ACC]"
              />
            </div>
            <input
              type="text"
              placeholder="Replace"
              className="w-full h-7 bg-[#252526] border border-[#303030] rounded px-2.5 text-xs text-[#CCCCCC] focus:outline-none focus:border-[#007ACC]"
            />
            <p className="text-xs text-[#858585] leading-relaxed pt-2">
              Full workspace regex search and symbol navigation will be available in later chunks.
            </p>
          </div>
        </div>
      )}

      {activeActivity === "source-control" && (
        <div className="flex flex-col h-full text-[#CCCCCC]">
          <div className="h-9 px-3 flex items-center border-b border-[#303030]/60">
            <span className="text-[11px] font-semibold tracking-wider text-[#858585] uppercase">
              Source Control
            </span>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs text-white">
              <GitBranch className="h-4 w-4 text-[#007ACC]" />
              <span className="font-medium">Git Integration</span>
            </div>
            <p className="text-xs text-[#858585] leading-relaxed">
              Workspace branch is set to <span className="font-mono text-[#CCCCCC]">main</span>.
              Real-time collaboration tracks concurrent edits losslessly with Yjs CRDTs.
            </p>
            <div className="rounded border border-[#303030] bg-[#252526] p-2.5 text-xs space-y-1">
              <div className="text-[11px] font-semibold text-[#858585] uppercase">Audit Trail</div>
              <div className="text-[#CCCCCC] flex items-center justify-between">
                <span>Working tree</span>
                <span className="text-emerald-400 font-mono text-[11px]">Clean</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeActivity === "extensions" && (
        <div className="flex flex-col h-full text-[#CCCCCC]">
          <div className="h-9 px-3 flex items-center border-b border-[#303030]/60">
            <span className="text-[11px] font-semibold tracking-wider text-[#858585] uppercase">
              Extensions
            </span>
          </div>
          <div className="p-3 space-y-2.5 overflow-y-auto">
            <div className="text-[11px] font-semibold text-[#858585] uppercase tracking-wider">
              Installed Tooling
            </div>

            {[
              {
                name: "C/C++ Runner & Compiler",
                desc: "Judge0 CE Isolated Sandbox",
                tag: "Built-in",
              },
              { name: "TypeScript & React Tools", desc: "Next.js 15 App Router", tag: "Built-in" },
              { name: "Python 3 Runtime", desc: "Isolated process execution", tag: "Built-in" },
              { name: "Yjs CRDT Engine", desc: "Hocuspocus WebSocket sync", tag: "Core" },
            ].map((ext) => (
              <div
                key={ext.name}
                className="p-2 rounded bg-[#252526] border border-[#303030] space-y-1 hover:border-[#007ACC]/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">{ext.name}</span>
                  <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-[#181818] text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                    <Check className="h-2.5 w-2.5" /> {ext.tag}
                  </span>
                </div>
                <div className="text-[11px] text-[#858585]">{ext.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeActivity === "settings" && (
        <div className="flex flex-col h-full text-[#CCCCCC]">
          <div className="h-9 px-3 flex items-center border-b border-[#303030]/60">
            <span className="text-[11px] font-semibold tracking-wider text-[#858585] uppercase">
              Settings
            </span>
          </div>
          <div className="p-3 space-y-3 overflow-y-auto">
            <div className="space-y-1">
              <label className="text-xs text-[#858585]">Theme</label>
              <div className="text-xs font-mono px-2 py-1 bg-[#252526] rounded border border-[#303030] text-white">
                Dark Modern (VS Code)
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#858585]">Editor Font Size</label>
              <div className="text-xs font-mono px-2 py-1 bg-[#252526] rounded border border-[#303030] text-white">
                14px
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#858585]">Tab Size</label>
              <div className="text-xs font-mono px-2 py-1 bg-[#252526] rounded border border-[#303030] text-white">
                4 spaces
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#858585]">Execution Sandbox</label>
              <div className="text-xs font-mono px-2 py-1 bg-[#252526] rounded border border-[#303030] text-white">
                Judge0 CE (Docker)
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
