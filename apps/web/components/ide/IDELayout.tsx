"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useIDEState } from "@/hooks/useIDEState";
import { useExecution } from "@/hooks/useExecution";
import type { CollabConnectionStatus, Collaborator } from "@/hooks/useCollab";
import type { WorkspaceRole } from "@/types/workspace";
import { IDEHeader } from "./IDEHeader";
import { ActivityBar } from "./ActivityBar";
import { Sidebar } from "./Sidebar";
import { EditorWorkspace } from "./EditorWorkspace";
import { BottomPanel } from "./BottomPanel";
import { StatusBar } from "./StatusBar";

export interface IDELayoutProps {
  workspaceName?: string;
  workspaceId?: string;
  userRole?: WorkspaceRole;
}

export const IDELayout: React.FC<IDELayoutProps> = ({
  workspaceName = "Workspace",
  workspaceId,
  userRole,
}) => {
  const isReadOnly = userRole === "VIEWER";
  const workspaceContainerRef = useRef<HTMLDivElement | null>(null);

  const {
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
    markTabLoaded,
    markTabDirty,
    registerTabDirtyChecker,
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
    openBottomPanel,
    toggleBottomPanel,
    isBottomPanelMaximized,
    toggleBottomPanelMaximized,
    createFile,
    createFolder,
    renameItem,
    deleteItem,
    moveItem,
    refreshFileTree,
  } = useIDEState({ workspaceId });

  const execution = useExecution({
    onEnsureOpen: openBottomPanel,
  });

  // Collaboration status and remote collaborators state managed across active file sessions
  const [collabStatus, setCollabStatus] = useState<CollabConnectionStatus>("disconnected");
  const [collabIsSynced, setCollabIsSynced] = useState<boolean>(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  const handleCollabStatusChange = useCallback(
    (status: CollabConnectionStatus, isSynced: boolean, collabList: Collaborator[] = []) => {
      setCollabStatus(status);
      setCollabIsSynced(isSynced);
      setCollaborators(collabList);
    },
    []
  );

  // Keyboard shortcut listener (Ctrl+B / Ctrl+`)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar: Ctrl+B or Cmd+B
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }

      // Toggle bottom terminal panel: Ctrl+` or Cmd+`
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        toggleBottomPanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, toggleBottomPanel]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#1E1E1E] text-[#CCCCCC] font-sans antialiased">
      {/* 1. Top Header */}
      <IDEHeader
        workspaceName={workspaceName}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={toggleSidebar}
        isBottomPanelOpen={isBottomPanelOpen}
        onToggleBottomPanel={toggleBottomPanel}
        collabStatus={collabStatus}
        isSynced={collabIsSynced}
        collaborators={collaborators}
      />

      {/* 2. Middle Row: Activity Bar + Sidebar + Main Workspace (Editor + Bottom Panel) */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Left Activity Bar */}
        <ActivityBar
          activeActivity={activeActivity}
          onSelectActivity={setActiveActivity}
          isSidebarOpen={isSidebarOpen}
        />

        {/* Collapsible Sidebar (File Explorer / Search / Source Control / Extensions / Settings) */}
        <Sidebar
          activeActivity={activeActivity}
          isOpen={isSidebarOpen}
          workspaceName={workspaceName}
          fileTree={fileTree}
          isLoadingTree={isLoadingTree}
          treeError={treeError}
          expandedFolders={expandedFolders}
          selectedFileId={selectedFileId}
          onToggleFolder={toggleFolder}
          onSelectFile={selectFile}
          onCollapseAll={collapseAllFolders}
          onRefresh={refreshFileTree}
          onCreateFile={createFile}
          onCreateFolder={createFolder}
          onRenameItem={renameItem}
          onDeleteItem={deleteItem}
          onMoveItem={moveItem}
        />

        {/* Central Workspace: Editor + Bottom Panel */}
        <div
          ref={workspaceContainerRef}
          className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#1E1E1E]"
        >
          {/* Main Editor Canvas / Welcome Screen */}
          <EditorWorkspace
            workspaceName={workspaceName}
            workspaceId={workspaceId}
            tabs={openTabs}
            activeTabId={activeTabId}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onCloseTab={closeTab}
            onUpdateTabContent={updateTabContent}
            onTabDirtyChange={markTabDirty}
            registerTabDirtyChecker={registerTabDirtyChecker}
            onTabSaved={markTabSaved}
            onTabLoaded={markTabLoaded}
            onCursorChange={setCursorPosition}
            onLanguageChange={setActiveLanguage}
            onCollabStatusChange={handleCollabStatusChange}
            isReadOnly={isReadOnly}
            pendingTransition={pendingTransition}
            onCancelPendingTransition={cancelPendingTransition}
            onConfirmPendingTransition={confirmPendingTransition}
            onRunCode={execution.runExecution}
            isExecuting={execution.isExecuting}
          />

          {/* Bottom Execution Panel */}
          <BottomPanel
            workspaceName={workspaceName}
            isOpen={isBottomPanelOpen}
            isMaximized={isBottomPanelMaximized}
            activeTab={execution.activeTab}
            onSelectTab={(tab) => execution.setActiveTab(tab as any)}
            onToggleOpen={toggleBottomPanel}
            onToggleMaximized={toggleBottomPanelMaximized}
            height={execution.panelHeight}
            onResize={execution.setPanelHeight}
            stdin={execution.stdin}
            onStdinChange={execution.setStdin}
            onClearStdin={execution.clearStdin}
            executionResult={execution.executionResult}
            executionStatus={execution.executionStatus}
            isExecuting={execution.isExecuting}
            onClearOutput={execution.clearOutput}
            containerRef={workspaceContainerRef}
          />
        </div>
      </div>

      {/* 3. Bottom Status Bar */}
      <StatusBar
        workspaceName={workspaceName}
        activeTab={activeTab}
        cursorPosition={cursorPosition}
        language={activeLanguage}
        indentation="Spaces: 4"
      />
    </div>
  );
};
