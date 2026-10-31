"use client";

import React from "react";
import { Files, Search, GitBranch, Blocks, Settings } from "lucide-react";
import { ActivityBarItem } from "@/types/ide";

interface ActivityBarProps {
  activeActivity: ActivityBarItem;
  onSelectActivity: (item: ActivityBarItem) => void;
  isSidebarOpen: boolean;
}

interface ActivityBarButton {
  id: ActivityBarItem;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOP_ACTIONS: ActivityBarButton[] = [
  {
    id: "explorer",
    label: "Explorer",
    shortcut: "Ctrl+Shift+E",
    icon: Files,
  },
  {
    id: "search",
    label: "Search",
    shortcut: "Ctrl+Shift+F",
    icon: Search,
  },
  {
    id: "source-control",
    label: "Source Control",
    shortcut: "Ctrl+Shift+G",
    icon: GitBranch,
  },
  {
    id: "extensions",
    label: "Extensions",
    shortcut: "Ctrl+Shift+X",
    icon: Blocks,
  },
];

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeActivity,
  onSelectActivity,
  isSidebarOpen,
}) => {
  return (
    <aside className="w-12 bg-[#181818] border-r border-[#303030] flex flex-col items-center justify-between py-2 select-none shrink-0 z-20">
      {/* Top action icons */}
      <div className="flex flex-col items-center w-full gap-1">
        {TOP_ACTIONS.map(({ id, label, shortcut, icon: Icon }) => {
          const isActive = activeActivity === id && isSidebarOpen;
          return (
            <button
              key={id}
              onClick={() => onSelectActivity(id)}
              title={`${label} (${shortcut})`}
              aria-label={label}
              className={`relative w-full h-11 flex items-center justify-center transition-colors group ${
                isActive ? "text-white" : "text-[#858585] hover:text-[#CCCCCC]"
              }`}
            >
              {/* Active left indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#007ACC] rounded-r" />
              )}
              <Icon className="h-5 w-5 transition-transform group-hover:scale-105" />
            </button>
          );
        })}
      </div>

      {/* Bottom settings icon */}
      <div className="w-full">
        <button
          onClick={() => onSelectActivity("settings")}
          title="Settings (Manage)"
          aria-label="Settings"
          className={`relative w-full h-11 flex items-center justify-center transition-colors group ${
            activeActivity === "settings" && isSidebarOpen
              ? "text-white"
              : "text-[#858585] hover:text-[#CCCCCC]"
          }`}
        >
          {activeActivity === "settings" && isSidebarOpen && (
            <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#007ACC] rounded-r" />
          )}
          <Settings className="h-5 w-5 transition-transform group-hover:scale-105" />
        </button>
      </div>
    </aside>
  );
};
