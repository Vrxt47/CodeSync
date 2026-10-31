"use client";

import React from "react";
import { X } from "lucide-react";
import { EditorTab } from "@/types/ide";
import { getFileIcon } from "./FileTreeItem";

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
}) => {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="h-9 bg-[#181818] border-b border-[#303030] flex items-center overflow-x-auto select-none shrink-0 no-scrollbar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            title={tab.path}
            className={`group relative h-full flex items-center gap-2 px-3 text-xs border-r border-[#303030] cursor-pointer transition-colors shrink-0 ${
              isActive
                ? "bg-[#1E1E1E] text-white font-medium border-t-2 border-t-[#007ACC]"
                : "bg-[#181818] text-[#858585] hover:bg-[#1E1E1E]/50 hover:text-[#CCCCCC]"
            }`}
          >
            {/* File icon */}
            {getFileIcon(tab.extension)}

            {/* File name */}
            <span className="truncate max-w-[140px]">{tab.name}</span>

            {/* Close tab button */}
            <button
              onClick={(e) => onCloseTab(tab.id, e)}
              title="Close (Ctrl+W)"
              className="p-0.5 rounded-sm hover:bg-[#303030] hover:text-white text-[#858585] transition-colors"
              aria-label={`Close ${tab.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
