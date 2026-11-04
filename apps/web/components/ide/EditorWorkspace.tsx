"use client";

import React from "react";
import type { EditorTab } from "@/types/ide";
import type { CursorPosition } from "@/lib/editor/editorTypes";
import { EditorTabs } from "./EditorTabs";
import { EditorContainer } from "../editor/EditorContainer";
import { WelcomeScreen } from "./WelcomeScreen";

interface EditorWorkspaceProps {
  workspaceName?: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  activeTab: EditorTab | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onUpdateTabContent?: (tabId: string, content: string, isDirty: boolean) => void;
  onTabDirtyChange?: (tabId: string, isDirty: boolean) => void;
  onTabSaved?: (tabId: string, savedContent: string, updatedAt?: string, version?: number) => void;
  onTabLoaded?: (tabId: string, content: string, updatedAt?: string, version?: number) => void;
  onCursorChange?: (cursor: CursorPosition) => void;
  onLanguageChange?: (language: string) => void;
  pendingTransition?: {
    action: () => void;
    targetName: string;
  } | null;
  onCancelPendingTransition?: () => void;
  onConfirmPendingTransition?: () => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  workspaceName,
  tabs,
  activeTabId,
  activeTab,
  onSelectTab,
  onCloseTab,
  onUpdateTabContent,
  onTabDirtyChange,
  onTabSaved,
  onTabLoaded,
  onCursorChange,
  onLanguageChange,
  pendingTransition,
  onCancelPendingTransition,
  onConfirmPendingTransition,
}) => {
  return (
    <main className="flex-1 flex flex-col h-full bg-[#1E1E1E] overflow-hidden min-w-0 z-0">
      {/* Editor Tabs Header */}
      <EditorTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
      />

      {/* Editor Content Area */}
      {activeTab ? (
        <EditorContainer
          workspaceName={workspaceName}
          tabs={tabs}
          activeTab={activeTab}
          onUpdateTabContent={onUpdateTabContent}
          onTabDirtyChange={onTabDirtyChange}
          onTabSaved={onTabSaved}
          onTabLoaded={onTabLoaded}
          onCursorChange={onCursorChange}
          onLanguageChange={onLanguageChange}
          pendingTransition={pendingTransition}
          onCancelPendingTransition={onCancelPendingTransition}
          onConfirmPendingTransition={onConfirmPendingTransition}
        />
      ) : (
        <WelcomeScreen />
      )}
    </main>
  );
};
