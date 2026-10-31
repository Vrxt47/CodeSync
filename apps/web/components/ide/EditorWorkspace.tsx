"use client";

import React from "react";
import { EditorTab } from "@/types/ide";
import { EditorTabs } from "./EditorTabs";
import { EditorPlaceholder } from "./EditorPlaceholder";
import { WelcomeScreen } from "./WelcomeScreen";

interface EditorWorkspaceProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  activeTab: EditorTab | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  tabs,
  activeTabId,
  activeTab,
  onSelectTab,
  onCloseTab,
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
      {activeTab ? <EditorPlaceholder activeTab={activeTab} /> : <WelcomeScreen />}
    </main>
  );
};
