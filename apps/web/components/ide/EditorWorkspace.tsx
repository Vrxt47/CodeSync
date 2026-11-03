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
  onTabSaved?: (tabId: string, savedContent: string) => void;
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
  onTabSaved,
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
          activeTab={activeTab}
          onUpdateTabContent={onUpdateTabContent}
          onTabSaved={onTabSaved}
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
