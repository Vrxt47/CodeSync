"use client";

import React, { useEffect } from "react";
import { useIDEState } from "@/hooks/useIDEState";
import { IDEHeader } from "./IDEHeader";
import { ActivityBar } from "./ActivityBar";
import { Sidebar } from "./Sidebar";
import { EditorWorkspace } from "./EditorWorkspace";
import { BottomPanel } from "./BottomPanel";
import { StatusBar } from "./StatusBar";

export interface IDELayoutProps {
  workspaceName?: string;
  workspaceId?: string;
}

export const IDELayout: React.FC<IDELayoutProps> = ({
  workspaceName = "Workspace",
  workspaceId,
}) => {
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
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#1E1E1E]">
          {/* Main Editor Canvas / Welcome Screen */}
          <EditorWorkspace
            workspaceName={workspaceName}
            tabs={openTabs}
            activeTabId={activeTabId}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onCloseTab={closeTab}
            onUpdateTabContent={updateTabContent}
            onTabSaved={markTabSaved}
            onCursorChange={setCursorPosition}
            onLanguageChange={setActiveLanguage}
            pendingTransition={pendingTransition}
            onCancelPendingTransition={cancelPendingTransition}
            onConfirmPendingTransition={confirmPendingTransition}
          />

          {/* Bottom Output / Terminal / Problems Panel */}
          <BottomPanel
            workspaceName={workspaceName}
            isOpen={isBottomPanelOpen}
            isMaximized={isBottomPanelMaximized}
            activeTab={bottomPanelTab}
            onSelectTab={setBottomPanelTab}
            onToggleOpen={toggleBottomPanel}
            onToggleMaximized={toggleBottomPanelMaximized}
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
