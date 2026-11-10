"use client";

import React from "react";
import { Terminal, Keyboard, History, Maximize2, Minimize2, X, RotateCcw } from "lucide-react";
import type { ExecutionPanelTab } from "@/hooks/useExecution";

export interface ExecutionPanelHeaderProps {
  activeTab: ExecutionPanelTab;
  onSelectTab: (tab: ExecutionPanelTab) => void;
  hasStdin: boolean;
  hasOutput: boolean;
  isMaximized: boolean;
  onToggleMaximized?: () => void;
  onClose?: () => void;
  onClearOutput?: () => void;
  className?: string;
}

export const ExecutionPanelHeader: React.FC<ExecutionPanelHeaderProps> = ({
  activeTab,
  onSelectTab,
  hasStdin,
  hasOutput,
  isMaximized,
  onToggleMaximized,
  onClose,
  onClearOutput,
  className = "",
}) => {
  const tabs: { id: ExecutionPanelTab; label: string; icon: React.ReactNode; badge?: boolean }[] = [
    {
      id: "output",
      label: "Output",
      icon: <Terminal className="h-3 w-3" />,
      badge: hasOutput,
    },
    {
      id: "input",
      label: "Input",
      icon: <Keyboard className="h-3 w-3" />,
      badge: hasStdin,
    },
    {
      id: "history",
      label: "Execution History",
      icon: <History className="h-3 w-3" />,
    },
  ];

  return (
    <div
      className={`h-8 bg-[#181818] border-b border-[#303030]/80 flex items-center justify-between px-3 shrink-0 select-none ${className}`}
    >
      {/* Left: Tab selection buttons */}
      <div className="flex items-center gap-1 h-full">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`h-full px-3 text-xs uppercase tracking-wider font-semibold transition-colors flex items-center gap-1.5 relative ${
                isActive
                  ? "text-white border-b-2 border-[#007ACC] bg-[#1E1E1E]"
                  : "text-[#858585] hover:text-[#CCCCCC]"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>

              {/* Indicator dot when input or output exists */}
              {tab.badge && !isActive && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#007ACC] ml-0.5"
                  title={`${tab.label} has content`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Right: Window / Panel controls */}
      <div className="flex items-center gap-1 text-[#858585]">
        {/* Clear Output action when Output tab is active */}
        {activeTab === "output" && hasOutput && onClearOutput && (
          <button
            onClick={onClearOutput}
            title="Clear Output"
            className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
            aria-label="Clear Output"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Maximize / Restore Toggle */}
        {onToggleMaximized && (
          <button
            onClick={onToggleMaximized}
            title={isMaximized ? "Restore Panel Size" : "Maximize Panel Size (65%)"}
            className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
            aria-label={isMaximized ? "Restore Size" : "Maximize Size"}
          >
            {isMaximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* Close / Collapse button */}
        {onClose && (
          <button
            onClick={onClose}
            title="Hide Execution Panel (Ctrl+`)"
            className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
            aria-label="Close Panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
