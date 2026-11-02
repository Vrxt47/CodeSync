"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Folder,
  Users,
  Clock,
  MoreVertical,
  ExternalLink,
  Edit2,
  Trash2,
  Shield,
  Crown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Workspace } from "@/types/workspace";

interface WorkspaceCardProps {
  workspace: Workspace;
  onOpen: (workspace: Workspace) => void;
  onRename?: (workspace: Workspace) => void;
  onDelete?: (workspace: Workspace) => void;
}

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspace,
  onOpen,
  onRename,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = workspace.role === "OWNER";

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <div
      onClick={() => onOpen(workspace)}
      className="group relative bg-[#1E1E1E] hover:bg-[#252526] border border-[#303030] hover:border-[#007ACC]/60 rounded-lg p-5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between select-none"
    >
      <div>
        {/* Top row: Icon, Role Badge, Menu button */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-[#007ACC]/15 border border-[#007ACC]/30 flex items-center justify-center text-[#007ACC] group-hover:scale-105 transition-transform">
              <Folder className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              {workspace.role === "OWNER" && (
                <Badge
                  variant="outline"
                  className="bg-amber-950/40 border-amber-600/40 text-amber-400 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 gap-1 flex items-center"
                >
                  <Crown className="h-2.5 w-2.5 text-amber-400" />
                  Owner
                </Badge>
              )}
              {workspace.role === "EDITOR" && (
                <Badge
                  variant="outline"
                  className="bg-cyan-950/40 border-cyan-600/40 text-cyan-400 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 gap-1 flex items-center"
                >
                  <Shield className="h-2.5 w-2.5 text-cyan-400" />
                  Editor
                </Badge>
              )}
              {workspace.role === "VIEWER" && (
                <Badge
                  variant="outline"
                  className="bg-zinc-800/60 border-zinc-700 text-zinc-400 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5"
                >
                  Viewer
                </Badge>
              )}
            </div>
          </div>

          {/* Context Action Menu */}
          <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#303030] transition-colors"
              aria-label="Workspace options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-[#252526] border border-[#3A3D41] rounded-md shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen(workspace);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:text-white hover:bg-[#007ACC] flex items-center gap-2 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in IDE
                </button>

                {isOwner && onRename && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onRename(workspace);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:text-white hover:bg-[#007ACC] flex items-center gap-2 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Rename
                  </button>
                )}

                {isOwner && onDelete && (
                  <>
                    <div className="my-1 border-t border-[#303030]" />
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(workspace);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:text-white hover:bg-red-600 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Workspace Name & Description */}
        <div className="space-y-1.5 mb-4">
          <h3 className="font-semibold text-white text-base truncate group-hover:text-[#007ACC] transition-colors">
            {workspace.name}
          </h3>
          <p className="text-xs text-[#858585] line-clamp-2 min-h-[32px]">
            {workspace.description || "No description provided."}
          </p>
        </div>
      </div>

      {/* Footer metadata: Members and Timestamps */}
      <div className="pt-3 border-t border-[#2A2D2E] flex items-center justify-between text-xs text-[#858585] font-mono">
        <div className="flex items-center gap-1.5" title={`${workspace.memberCount} member(s)`}>
          <Users className="h-3.5 w-3.5 text-[#007ACC]" />
          <span>
            {workspace.memberCount} {workspace.memberCount === 1 ? "member" : "members"}
          </span>
        </div>

        <div
          className="flex items-center gap-1.5"
          title={`Last accessed: ${workspace.lastAccessedAt ? new Date(workspace.lastAccessedAt).toLocaleString() : "Never"}`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>
            {workspace.lastAccessedAt
              ? formatRelativeTime(workspace.lastAccessedAt)
              : formatRelativeTime(workspace.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
};

