"use client";

import React from "react";
import type { BottomPanelTab } from "@/types/ide";
import type { ExecutionResult, ExecutionStatus } from "@/services/execution";
import type { ExecutionPanelTab } from "@/hooks/useExecution";
import { ExecutionPanel } from "../editor/ExecutionPanel";

export interface BottomPanelProps {
  workspaceName?: string;
  isOpen: boolean;
  isMaximized: boolean;
  activeTab?: BottomPanelTab;
  onSelectTab?: (tab: BottomPanelTab) => void;
  onToggleOpen: () => void;
  onToggleMaximized: () => void;
  height?: number;
  onResize?: (height: number) => void;
  stdin?: string;
  onStdinChange?: (value: string) => void;
  onClearStdin?: () => void;
  executionResult?: ExecutionResult | null;
  executionStatus?: ExecutionStatus;
  isExecuting?: boolean;
  onClearOutput?: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Adapted BottomPanel component.
 * Replaces the static terminal scaffold with the integrated CodeSync ExecutionPanel.
 */
export const BottomPanel: React.FC<BottomPanelProps> = ({
  isOpen,
  isMaximized,
  activeTab = "output",
  onSelectTab,
  onToggleOpen,
  onToggleMaximized,
  height = 260,
  onResize = () => {},
  stdin = "",
  onStdinChange = () => {},
  onClearStdin = () => {},
  executionResult = null,
  executionStatus = "idle",
  isExecuting = false,
  onClearOutput,
  containerRef,
}) => {
  // Normalize active tab to ExecutionPanelTab
  const executionTab: ExecutionPanelTab =
    activeTab === "input" || activeTab === "history" ? activeTab : "output";

  const handleSelectTab = (tab: ExecutionPanelTab) => {
    onSelectTab?.(tab as BottomPanelTab);
  };

  return (
    <ExecutionPanel
      isOpen={isOpen}
      height={height}
      onResize={onResize}
      isMaximized={isMaximized}
      onToggleMaximized={onToggleMaximized}
      onClose={onToggleOpen}
      activeTab={executionTab}
      onSelectTab={handleSelectTab}
      stdin={stdin}
      onStdinChange={onStdinChange}
      onClearStdin={onClearStdin}
      executionResult={executionResult}
      executionStatus={executionStatus}
      isExecuting={isExecuting}
      onClearOutput={onClearOutput}
      containerRef={containerRef}
    />
  );
};
