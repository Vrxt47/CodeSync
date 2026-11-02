"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Code2,
  LogOut,
  Plus,
  Search,
  X,
  Clock,
  LayoutGrid,
  FolderPlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { workspaceApi } from "@/lib/workspaceApi";
import { WorkspaceCard } from "@/components/workspace/WorkspaceCard";
import { CreateWorkspaceDialog } from "@/components/workspace/CreateWorkspaceDialog";
import { RenameWorkspaceDialog } from "@/components/workspace/RenameWorkspaceDialog";
import { DeleteWorkspaceDialog } from "@/components/workspace/DeleteWorkspaceDialog";
import type { Workspace } from "@/types/workspace";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, isAuthenticated, logout } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [workspaceToRename, setWorkspaceToRename] = useState<Workspace | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch workspaces
  const loadWorkspaces = useCallback(async () => {
    try {
      setIsLoadingWorkspaces(true);
      setError(null);
      const list = await workspaceApi.listWorkspaces();
      setWorkspaces(list);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load workspaces.";
      setError(message);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadWorkspaces();
    }
  }, [isAuthenticated, loadWorkspaces]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleOpenWorkspace = (ws: Workspace) => {
    router.push(`/workspace/${ws.id}`);
  };

  const handleWorkspaceCreated = (newWs: Workspace) => {
    setWorkspaces((prev) => [newWs, ...prev]);
    showToast(`Workspace "${newWs.name}" created successfully!`);
  };

  const handleWorkspaceRenamed = (updatedWs: Workspace) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === updatedWs.id ? updatedWs : w)));
    showToast(`Workspace renamed to "${updatedWs.name}"!`);
  };

  const handleWorkspaceDeleted = (deletedId: string) => {
    setWorkspaces((prev) => prev.filter((w) => w.id !== deletedId));
    showToast("Workspace deleted successfully.");
  };

  // Filter workspaces by search query
  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery.trim()) return workspaces;
    const q = searchQuery.toLowerCase().trim();
    return workspaces.filter((ws) => ws.name.toLowerCase().includes(q));
  }, [workspaces, searchQuery]);

  // Recent workspaces: up to 4, sorted by lastAccessedAt DESC NULLS LAST, updatedAt DESC
  const recentWorkspaces = useMemo(() => {
    return [...workspaces]
      .sort((a, b) => {
        const timeA = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
        const timeB = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, 4);
  }, [workspaces]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#181818] flex flex-col items-center justify-center text-[#CCCCCC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#007ACC] mb-3" />
        <p className="text-sm font-mono text-[#858585]">Restoring session...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userInitials =
    user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "CS";

  return (
    <div className="min-h-screen bg-[#181818] text-[#CCCCCC] flex flex-col font-sans">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-md bg-[#252526] border border-[#007ACC] text-white shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="h-4 w-4 text-[#007ACC]" />
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-[#858585] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Application Header */}
      <header className="h-14 border-b border-[#303030] bg-[#1E1E1E] px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded bg-[#007ACC]/20 border border-[#007ACC]/40 flex items-center justify-center text-[#007ACC] shadow-sm">
              <Code2 className="h-5 w-5" />
            </div>
            <span className="font-bold text-base text-white">CodeSync</span>
          </Link>
          <span className="text-xs text-[#858585] font-mono">/ Dashboard</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-8 bg-[#007ACC] hover:bg-[#0062A3] text-white text-xs gap-1.5 font-medium shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Workspace
          </Button>

          <div className="h-4 w-[1px] bg-[#303030] mx-1" />

          {/* User Profile avatar pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#252526] border border-[#303030]">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#007ACC] to-[#005A9E] flex items-center justify-center text-white text-[11px] font-bold">
              {userInitials}
            </div>
            <span className="text-xs text-white max-w-[120px] truncate hidden sm:inline">
              {user.name}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="h-8 text-xs border-[#303030] bg-[#252526] text-[#CCCCCC] hover:bg-[#2A2D2E] hover:text-white gap-1.5"
            title="Sign out of account"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Error Banner */}
        {error && (
          <div className="flex items-center justify-between p-4 rounded bg-red-950/40 border border-red-800 text-xs text-red-300">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadWorkspaces}
              className="h-7 text-xs border-red-800 text-red-200 hover:bg-red-900/40"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Dashboard Banner & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Workspaces</h1>
            <p className="text-xs text-[#858585] mt-1">
              Select an existing workspace to resume coding or create a new one.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-[#858585] absolute left-3 top-2.5 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-[#1E1E1E] border-[#303030] rounded-md pl-9 pr-8 text-xs text-white placeholder-[#858585] focus:border-[#007ACC]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-[#858585] hover:text-white"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Loading Indicator */}
        {isLoadingWorkspaces && (
          <div className="py-16 flex flex-col items-center justify-center text-[#858585]">
            <Loader2 className="h-7 w-7 animate-spin text-[#007ACC] mb-3" />
            <p className="text-xs font-mono">Loading your workspaces...</p>
          </div>
        )}

        {/* Workspace Content */}
        {!isLoadingWorkspaces && workspaces.length === 0 && (
          /* Empty State: No Workspaces */
          <div className="bg-[#1E1E1E] border border-dashed border-[#303030] rounded-xl p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto space-y-4">
            <div className="h-14 w-14 rounded-full bg-[#007ACC]/15 border border-[#007ACC]/30 flex items-center justify-center text-[#007ACC]">
              <FolderPlus className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">No workspaces yet</h3>
              <p className="text-xs text-[#858585] mt-1.5 max-w-sm">
                Create your first workspace to collaborate on code in real time with syntax
                highlighting and multi-participant live presence.
              </p>
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-[#007ACC] hover:bg-[#0062A3] text-white text-xs font-medium gap-1.5 mt-2"
            >
              <Plus className="h-4 w-4" />
              Create Your First Workspace
            </Button>
          </div>
        )}

        {!isLoadingWorkspaces && workspaces.length > 0 && (
          <div className="space-y-8">
            {/* 1. Recent Workspaces Section (shown when not actively searching) */}
            {!searchQuery.trim() && recentWorkspaces.length > 0 && (
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#858585]">
                  <Clock className="h-3.5 w-3.5 text-[#007ACC]" />
                  <span>Recent Workspaces</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recentWorkspaces.map((ws) => (
                    <WorkspaceCard
                      key={`recent-${ws.id}`}
                      workspace={ws}
                      onOpen={handleOpenWorkspace}
                      onRename={(w) => setWorkspaceToRename(w)}
                      onDelete={(w) => setWorkspaceToDelete(w)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 2. All Workspaces Section */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#858585]">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-3.5 w-3.5 text-[#007ACC]" />
                  <span>{searchQuery.trim() ? "Search Results" : "All Workspaces"}</span>
                </div>
                <span className="font-mono text-[11px] lowercase text-[#858585]">
                  {filteredWorkspaces.length}{" "}
                  {filteredWorkspaces.length === 1 ? "workspace" : "workspaces"}
                </span>
              </div>

              {filteredWorkspaces.length === 0 ? (
                /* Search Filter Empty State */
                <div className="bg-[#1E1E1E] border border-[#303030] rounded-lg p-8 text-center flex flex-col items-center justify-center space-y-3">
                  <Search className="h-6 w-6 text-[#858585]" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">No matching workspaces</h4>
                    <p className="text-xs text-[#858585] mt-1">
                      No workspaces found matching &quot;{searchQuery}&quot;.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="border-[#303030] bg-[#252526] text-xs hover:bg-[#2A2D2E]"
                  >
                    Clear Search
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredWorkspaces.map((ws) => (
                    <WorkspaceCard
                      key={ws.id}
                      workspace={ws}
                      onOpen={handleOpenWorkspace}
                      onRename={(w) => setWorkspaceToRename(w)}
                      onDelete={(w) => setWorkspaceToDelete(w)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals & Dialogs */}
      <CreateWorkspaceDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleWorkspaceCreated}
      />

      <RenameWorkspaceDialog
        workspace={workspaceToRename}
        isOpen={!!workspaceToRename}
        onClose={() => setWorkspaceToRename(null)}
        onSuccess={handleWorkspaceRenamed}
      />

      <DeleteWorkspaceDialog
        workspace={workspaceToDelete}
        isOpen={!!workspaceToDelete}
        onClose={() => setWorkspaceToDelete(null)}
        onSuccess={handleWorkspaceDeleted}
      />
    </div>
  );
}
