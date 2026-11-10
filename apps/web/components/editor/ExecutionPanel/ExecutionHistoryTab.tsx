"use client";

import React from "react";
import { History } from "lucide-react";

export interface ExecutionHistoryTabProps {
  className?: string;
}

export const ExecutionHistoryTab: React.FC<ExecutionHistoryTabProps> = ({ className = "" }) => {
  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center p-6 text-center select-none text-[#858585] gap-3 bg-[#181818] ${className}`}
    >
      <div className="h-10 w-10 rounded-full bg-[#252526] border border-[#303030] flex items-center justify-center text-[#858585]">
        <History className="h-5 w-5" />
      </div>
      <div className="space-y-1 max-w-sm">
        <p className="text-sm font-medium text-[#CCCCCC]">Execution History</p>
        <p className="text-xs text-[#858585]">
          Execution history will be available in a future update.
        </p>
        <p className="text-[11px] text-[#606060] pt-1">
          Historical execution logs, output snapshots, and sandbox timing metrics will be tracked
          here.
        </p>
      </div>
    </div>
  );
};
