"use client";

import React from "react";
import {
  Terminal,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  RotateCcw,
} from "lucide-react";
import type { ExecutionResult, ExecutionStatus } from "@/services/execution";
import { ExecutionMetadata } from "./ExecutionMetadata";

export interface OutputTabProps {
  result: ExecutionResult | null;
  status: ExecutionStatus;
  isExecuting: boolean;
  onClearOutput?: () => void;
  className?: string;
}

export const OutputTab: React.FC<OutputTabProps> = ({
  result,
  status,
  isExecuting,
  onClearOutput,
  className = "",
}) => {
  // 1. Loading State
  if (isExecuting) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center p-6 text-center select-none text-[#858585] gap-3 bg-[#181818] ${className}`}
      >
        <Loader2 className="h-7 w-7 animate-spin text-[#007ACC]" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">Running code...</p>
          <p className="text-xs text-[#858585]">Executing in isolated sandbox environment</p>
        </div>
      </div>
    );
  }

  // 2. Empty State (before first execution)
  if (!result) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center p-6 text-center select-none text-[#858585] gap-3 bg-[#181818] ${className}`}
      >
        <div className="h-10 w-10 rounded-full bg-[#252526] border border-[#303030] flex items-center justify-center text-[#858585]">
          <Terminal className="h-5 w-5" />
        </div>
        <div className="space-y-1 max-w-sm">
          <p className="text-sm font-medium text-[#CCCCCC]">No execution yet</p>
          <p className="text-xs text-[#858585]">
            Run your code to see the output here. You can click{" "}
            <span className="text-[#007ACC] font-medium inline-flex items-center gap-1">
              <Play className="h-3 w-3 inline fill-current" /> Run
            </span>{" "}
            in the toolbar or press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[#252526] border border-[#303030] text-[11px] font-mono text-[#CCCCCC]">
              Ctrl+Enter
            </kbd>
            .
          </p>
        </div>
      </div>
    );
  }

  // Render status badge
  const renderStatusBadge = () => {
    switch (result.status) {
      case "success":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/80">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Accepted / Success</span>
          </span>
        );
      case "compilation_error":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-950/60 text-red-300 border border-red-800/80">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span>Compilation Error</span>
          </span>
        );
      case "runtime_error":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-950/60 text-red-300 border border-red-800/80">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            <span>Runtime Error</span>
          </span>
        );
      case "validation_error":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-800/80">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            <span>Validation Error</span>
          </span>
        );
      case "time_limit_exceeded":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-950/60 text-orange-300 border border-orange-800/80">
            <Clock className="h-3.5 w-3.5 text-orange-400" />
            <span>Time Limit Exceeded</span>
          </span>
        );
      case "memory_limit_exceeded":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-950/60 text-orange-300 border border-orange-800/80">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
            <span>Memory Limit Exceeded</span>
          </span>
        );
      case "internal_error":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-950/60 text-red-300 border border-red-800/80">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span>Internal Error</span>
          </span>
        );
    }
  };

  return (
    <div className={`flex flex-col flex-1 h-full overflow-hidden bg-[#181818] ${className}`}>
      {/* 1. Status Bar & Execution Metadata */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#1A1A1A] border-b border-[#303030]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#858585] uppercase tracking-wider">
            Status:
          </span>
          {renderStatusBadge()}
        </div>

        {onClearOutput && (
          <button
            onClick={onClearOutput}
            title="Clear output"
            className="flex items-center gap-1 text-[11px] text-[#858585] hover:text-[#CCCCCC] px-1.5 py-0.5 rounded hover:bg-[#2A2D2E] transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Metadata bar */}
      <ExecutionMetadata result={result} />

      {/* 2. Structured Output Body */}
      <div className="flex-1 overflow-auto p-3 space-y-3 font-mono text-xs select-text">
        {/* A. Validation Error Display */}
        {result.validationError && (
          <div className="rounded border border-amber-800/60 bg-amber-950/20 p-2.5 text-amber-200">
            <div className="flex items-center gap-1.5 font-semibold mb-1 text-amber-300 text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Validation Notice</span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed">
              {result.validationError}
            </pre>
          </div>
        )}

        {/* B. Compilation Error Display */}
        {result.compilationError && (
          <div className="rounded border border-red-800/60 bg-red-950/25 p-3 text-red-200">
            <div className="flex items-center gap-1.5 font-semibold mb-1.5 text-red-400 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Compilation Diagnostics</span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed overflow-x-auto text-[#FF8B8B]">
              {result.compilationError}
            </pre>
          </div>
        )}

        {/* C. Runtime Error Display */}
        {result.runtimeError && (
          <div className="rounded border border-red-800/60 bg-red-950/25 p-3 text-red-200">
            <div className="flex items-center gap-1.5 font-semibold mb-1.5 text-red-400 text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Runtime Exception Trace</span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed overflow-x-auto text-[#FF9E9E]">
              {result.runtimeError}
            </pre>
          </div>
        )}

        {/* D. Standard Output (stdout) */}
        {result.stdout && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-[#858585] uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="h-3 w-3 text-[#007ACC]" />
              <span>Standard Output (stdout)</span>
            </div>
            <div className="p-2.5 rounded bg-[#121212] border border-[#2A2A2A] text-[#E0E0E0] overflow-x-auto">
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed m-0">
                {result.stdout}
              </pre>
            </div>
          </div>
        )}

        {/* E. Standard Error (stderr) */}
        {result.stderr && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              <span>Standard Error (stderr)</span>
            </div>
            <div className="p-2.5 rounded bg-amber-950/20 border border-amber-800/40 text-amber-200 overflow-x-auto">
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed m-0">
                {result.stderr}
              </pre>
            </div>
          </div>
        )}

        {/* Empty stdout notice if no errors and no output */}
        {!result.stdout &&
          !result.stderr &&
          !result.compilationError &&
          !result.runtimeError &&
          !result.validationError && (
            <div className="text-[#858585] italic text-xs py-2">
              (Program finished with zero output)
            </div>
          )}
      </div>
    </div>
  );
};
