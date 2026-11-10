"use client";

import React from "react";
import type { EditorTab } from "@/types/ide";
import type { CursorPosition } from "@/lib/editor/editorTypes";
import type { SupportedLanguage, ExecutionResult } from "@/services/execution";
import type { CollabConnectionStatus, Collaborator } from "@/hooks/useCollab";
import { EditorTabs } from "./EditorTabs";
import { EditorContainer } from "../editor/EditorContainer";
import { WelcomeScreen } from "./WelcomeScreen";

interface EditorWorkspaceProps {
  workspaceName?: string;
  workspaceId?: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  activeTab: EditorTab | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  onUpdateTabContent?: (
    tabId: string,
    content: string,
    isDirty: boolean,
    preserveExplicitDirtyFlag?: boolean
  ) => void;
  onTabDirtyChange?: (tabId: string, isDirty: boolean) => void;
  registerTabDirtyChecker?: (checker: ((tabId: string) => boolean) | null) => void;
  onTabSaved?: (
    tabId: string,
    savedContent: string,
    updatedAt?: string,
    version?: number,
    forceClean?: boolean
  ) => void;
  onTabLoaded?: (tabId: string, content: string, updatedAt?: string, version?: number) => void;
  onCursorChange?: (cursor: CursorPosition) => void;
  onLanguageChange?: (language: string) => void;
  onCollabStatusChange?: (
    status: CollabConnectionStatus,
    isSynced: boolean,
    collaborators: Collaborator[]
  ) => void;
  isReadOnly?: boolean;
  pendingTransition?: {
    action: () => void;
    targetName: string;
  } | null;
  onCancelPendingTransition?: () => void;
  onConfirmPendingTransition?: () => void;
  onRunCode?: (params: {
    sourceCode: string;
    language: SupportedLanguage;
    fileName?: string;
  }) => Promise<ExecutionResult | undefined>;
  isExecuting?: boolean;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  workspaceName,
  workspaceId,
  tabs,
  activeTabId,
  activeTab,
  onSelectTab,
  onCloseTab,
  onUpdateTabContent,
  onTabDirtyChange,
  registerTabDirtyChecker,
  onTabSaved,
  onTabLoaded,
  onCursorChange,
  onLanguageChange,
  onCollabStatusChange,
  isReadOnly,
  pendingTransition,
  onCancelPendingTransition,
  onConfirmPendingTransition,
  onRunCode,
  isExecuting,
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
          workspaceId={workspaceId}
          tabs={tabs}
          activeTab={activeTab}
          onUpdateTabContent={onUpdateTabContent}
          onTabDirtyChange={onTabDirtyChange}
          registerTabDirtyChecker={registerTabDirtyChecker}
          onTabSaved={onTabSaved}
          onTabLoaded={onTabLoaded}
          onCursorChange={onCursorChange}
          onLanguageChange={onLanguageChange}
          onCollabStatusChange={onCollabStatusChange}
          isReadOnly={isReadOnly}
          pendingTransition={pendingTransition}
          onCancelPendingTransition={onCancelPendingTransition}
          onConfirmPendingTransition={onConfirmPendingTransition}
          onRunCode={onRunCode}
          isExecuting={isExecuting}
        />
      ) : (
        <WelcomeScreen />
      )}
    </main>
  );
};
