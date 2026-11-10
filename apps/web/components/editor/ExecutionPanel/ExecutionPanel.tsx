"use client";

import React from "react";
import type { ExecutionResult, ExecutionStatus } from "@/services/execution";
import type { ExecutionPanelTab } from "@/hooks/useExecution";
import { ResizeHandle } from "./ResizeHandle";
import { ExecutionPanelHeader } from "./ExecutionPanelHeader";
import { OutputTab } from "./OutputTab";
import { InputTab } from "./InputTab";
import { ExecutionHistoryTab } from "./ExecutionHistoryTab";

export interface ExecutionPanelProps {
  isOpen: boolean;
  height: number;
  onResize: (height: number) => void;
  isMaximized: boolean;
  onToggleMaximized?: () => void;
  onClose?: () => void;
  activeTab: ExecutionPanelTab;
  onSelectTab: (tab: ExecutionPanelTab) => void;
  stdin: string;
  onStdinChange: (value: string) => void;
  onClearStdin: () => void;
  executionResult: ExecutionResult | null;
  executionStatus: ExecutionStatus;
  isExecuting: boolean;
  onClearOutput?: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  isOpen,
  height,
  onResize,
  isMaximized,
  onToggleMaximized,
  onClose,
  activeTab,
  onSelectTab,
  stdin,
  onStdinChange,
  onClearStdin,
  executionResult,
  executionStatus,
  isExecuting,
  onClearOutput,
  containerRef,
  className = "",
}) => {
  if (!isOpen) {
    return null;
  }

  const effectiveHeight = isMaximized ? "65vh" : `${height}px`;
  const hasStdin = Boolean(stdin && stdin.length > 0);
  const hasOutput = Boolean(executionResult);

  return (
    <aside
      style={{ height: effectiveHeight }}
      className={`bg-[#181818] border-t border-[#303030] flex flex-col shrink-0 select-none z-10 min-h-[140px] max-h-[65vh] transition-[height] duration-75 ${className}`}
      aria-label="Integrated execution panel"
    >
      {/* 1. Draggable Horizontal Resize Handle */}
      <ResizeHandle
        currentHeight={height}
        onResize={onResize}
        minHeight={140}
        maxHeightRatio={0.65}
        containerRef={containerRef}
      />

      {/* 2. Panel Tab Navigation Header */}
      <ExecutionPanelHeader
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        hasStdin={hasStdin}
        hasOutput={hasOutput}
        isMaximized={isMaximized}
        onToggleMaximized={onToggleMaximized}
        onClose={onClose}
        onClearOutput={onClearOutput}
      />

      {/* 3. Panel Body: All tabs remain mounted to preserve internal state and scroll positions */}
      <div className="flex-1 overflow-hidden min-h-0 bg-[#181818] flex flex-col">
        {/* Output Tab */}
        <div
          className={`flex-1 h-full flex flex-col ${activeTab === "output" ? "flex" : "hidden"}`}
        >
          <OutputTab
            result={executionResult}
            status={executionStatus}
            isExecuting={isExecuting}
            onClearOutput={onClearOutput}
          />
        </div>

        {/* Custom Stdin Tab */}
        <div className={`flex-1 h-full flex flex-col ${activeTab === "input" ? "flex" : "hidden"}`}>
          <InputTab value={stdin} onChange={onStdinChange} onClear={onClearStdin} />
        </div>

        {/* Execution History Tab */}
        <div
          className={`flex-1 h-full flex flex-col ${activeTab === "history" ? "flex" : "hidden"}`}
        >
          <ExecutionHistoryTab />
        </div>
      </div>
    </aside>
  );
};
