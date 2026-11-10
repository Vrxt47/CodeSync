"use client";

import React from "react";
import Link from "next/link";
import {
  Code2,
  ChevronDown,
  Search,
  UserPlus,
  Settings,
  PanelLeft,
  PanelBottom,
  CircleDot,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import type { CollabConnectionStatus, Collaborator } from "@/hooks/useCollab";
import { CollaboratorPresence } from "./CollaboratorPresence";

interface IDEHeaderProps {
  workspaceName?: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isBottomPanelOpen: boolean;
  onToggleBottomPanel: () => void;
  collabStatus?: CollabConnectionStatus;
  isSynced?: boolean;
  collaborators?: Collaborator[];
}

export const IDEHeader: React.FC<IDEHeaderProps> = ({
  workspaceName = "Workspace",
  isSidebarOpen,
  onToggleSidebar,
  isBottomPanelOpen,
  onToggleBottomPanel,
  collabStatus = "disconnected",
  isSynced = false,
  collaborators = [],
}) => {
  const { user, isAuthenticated } = useAuth();
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "CS";

  // Derive collaboration status badge visual styles and copy
  let statusColor = "bg-[#858585]";
  let statusText = "Offline";
  let statusFullText = "Not connected";
  let statusTitle = "Collaboration Server: Disconnected (Local editing mode)";
  let dotAnimation = "";

  if (collabStatus === "connected") {
    if (isSynced) {
      statusColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
      statusText = "Live";
      statusFullText = "Live (Synced)";
      statusTitle = "Collaboration Server: Connected & Synced (Real-time CRDT active)";
    } else {
      statusColor = "bg-sky-400";
      statusText = "Syncing";
      statusFullText = "Syncing...";
      statusTitle = "Collaboration Server: Connected, synchronizing document changes...";
      dotAnimation = "animate-pulse";
    }
  } else if (collabStatus === "connecting") {
    statusColor = "bg-amber-400";
    statusText = "Connecting";
    statusFullText = "Connecting...";
    statusTitle = "Collaboration Server: Connecting to collaborative session...";
    dotAnimation = "animate-pulse";
  } else if (collabStatus === "error") {
    statusColor = "bg-rose-500";
    statusText = "Error";
    statusFullText = "Connection Error";
    statusTitle = "Collaboration Server: Connection error (Falling back to local autosave)";
  }

  return (
    <header className="h-11 bg-[#181818] border-b border-[#303030] flex items-center justify-between px-3 text-[#CCCCCC] select-none z-30 shrink-0">
      {/* Left section: Logo, Brand, Workspace */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Toggle sidebar button for compact views */}
        <button
          onClick={onToggleSidebar}
          title={isSidebarOpen ? "Hide Primary Sidebar (Ctrl+B)" : "Show Primary Sidebar (Ctrl+B)"}
          className="p-1 rounded hover:bg-[#2A2D2E] text-[#858585] hover:text-[#CCCCCC] transition-colors md:hidden"
          aria-label="Toggle Sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        {/* CodeSync Logo & Brand */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-[#007ACC]/20 border border-[#007ACC]/40 flex items-center justify-center text-[#007ACC] shadow-sm">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white hidden sm:inline">
            CodeSync
          </span>
        </div>

        {/* Workspace Dropdown Pill */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#252526] hover:bg-[#2A2D2E] text-xs font-mono text-[#CCCCCC] cursor-pointer border border-[#303030] transition-colors ml-1"
          title="Switch workspace (Dashboard)"
        >
          <span className="truncate max-w-[120px] sm:max-w-[160px]">{workspaceName}</span>
          <ChevronDown className="h-3 w-3 text-[#858585] shrink-0" />
        </Link>
      </div>

      {/* Center section: Search / Command input */}
      <div className="flex-1 max-w-md mx-4 hidden sm:block">
        <div className="relative flex items-center">
          <Search className="h-3.5 w-3.5 text-[#858585] absolute left-3 pointer-events-none" />
          <input
            type="text"
            readOnly
            placeholder="Search files, commands, and more..."
            className="w-full h-7 bg-[#252526] border border-[#303030] rounded pl-8 pr-16 text-xs text-[#CCCCCC] placeholder-[#858585] focus:outline-none focus:border-[#007ACC] cursor-pointer hover:bg-[#2A2D2E] transition-colors"
          />
          <kbd className="absolute right-2 text-[10px] font-mono text-[#858585] bg-[#1E1E1E] px-1.5 py-0.5 rounded border border-[#303030] pointer-events-none">
            Ctrl+P
          </kbd>
        </div>
      </div>

      {/* Right section: Collaboration status, Collaborator presence, Invite, Layout controls, Profile */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Active Remote Collaborators Presence Avatars */}
        <CollaboratorPresence collaborators={collaborators} />

        {/* Collaboration Status Pill */}
        <div
          title={statusTitle}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#252526] border border-[#303030] text-[11px] text-[#CCCCCC] transition-colors"
        >
          <span className={`h-2 w-2 rounded-full ${statusColor} ${dotAnimation} shrink-0`} />
          <span className="hidden md:inline font-medium">{statusFullText}</span>
          <span className="md:hidden font-medium">{statusText}</span>
        </div>

        {/* Invite Button (Visual placeholder) */}
        <Button
          variant="outline"
          size="sm"
          title="Invite collaborators to this workspace (Coming in Chunk 4)"
          className="h-7 px-2.5 text-xs font-medium border-[#303030] bg-[#252526] text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white gap-1.5"
        >
          <UserPlus className="h-3.5 w-3.5 text-[#007ACC]" />
          <span className="hidden sm:inline">Invite</span>
        </Button>

        {/* Panel toggle buttons */}
        <button
          onClick={onToggleSidebar}
          title={
            isSidebarOpen ? "Toggle Primary Sidebar (Ctrl+B)" : "Show Primary Sidebar (Ctrl+B)"
          }
          className={`p-1.5 rounded transition-colors hidden md:block ${
            isSidebarOpen
              ? "text-[#007ACC] bg-[#252526]"
              : "text-[#858585] hover:text-[#CCCCCC] hover:bg-[#252526]"
          }`}
          aria-label="Toggle Sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        <button
          onClick={onToggleBottomPanel}
          title={isBottomPanelOpen ? "Toggle Bottom Panel (Ctrl+`)" : "Show Bottom Panel (Ctrl+`)"}
          className={`p-1.5 rounded transition-colors ${
            isBottomPanelOpen
              ? "text-[#007ACC] bg-[#252526]"
              : "text-[#858585] hover:text-[#CCCCCC] hover:bg-[#252526]"
          }`}
          aria-label="Toggle Bottom Panel"
        >
          <PanelBottom className="h-4 w-4" />
        </button>

        {/* Settings Icon */}
        <button
          title="IDE Settings"
          className="p-1.5 rounded text-[#858585] hover:text-[#CCCCCC] hover:bg-[#252526] transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* User Profile Avatar / Sign In */}
        {isAuthenticated && user ? (
          <Link
            href="/dashboard"
            title={`Logged in as ${user.name} (${user.email}) - View Dashboard`}
          >
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#007ACC] to-[#005A9E] flex items-center justify-center text-white text-xs font-semibold cursor-pointer ring-1 ring-[#303030] shadow-sm ml-0.5 hover:ring-[#007ACC] transition-all">
              {userInitials}
            </div>
          </Link>
        ) : (
          <Link href="/login">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-medium border-[#303030] bg-[#252526] text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white gap-1.5 ml-1"
            >
              <LogIn className="h-3.5 w-3.5 text-[#007ACC]" />
              <span>Sign In</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
};
