"use client";

import React from "react";
import { Clock, Cpu, CheckCircle2, AlertCircle, Info } from "lucide-react";
import type { ExecutionResult } from "@/services/execution";

export interface ExecutionMetadataProps {
  result: ExecutionResult;
  className?: string;
}

export const ExecutionMetadata: React.FC<ExecutionMetadataProps> = ({ result, className = "" }) => {
  const isZeroExit = result.exitCode === 0;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#1F1F1F] border-b border-[#303030] text-xs font-mono text-[#CCCCCC] select-none ${className}`}
    >
      {/* Left: Execution metrics */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Execution Time */}
        <div className="flex items-center gap-1.5 text-[#CCCCCC]" title="Simulated execution time">
          <Clock className="h-3.5 w-3.5 text-[#007ACC]" />
          <span className="text-[#858585]">Time:</span>
          <span className="font-semibold text-white">{result.executionTime} ms</span>
        </div>

        {/* Memory Usage */}
        <div className="flex items-center gap-1.5 text-[#CCCCCC]" title="Simulated memory usage">
          <Cpu className="h-3.5 w-3.5 text-[#CCA700]" />
          <span className="text-[#858585]">Memory:</span>
          <span className="font-semibold text-white">{result.memoryUsage} MB</span>
        </div>

        {/* Exit Code */}
        <div className="flex items-center gap-1.5">
          {isZeroExit ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          )}
          <span className="text-[#858585]">Exit Code:</span>
          <span
            className={`font-semibold px-1 py-0.2 rounded text-[11px] ${
              isZeroExit
                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                : "bg-red-950/60 text-red-300 border border-red-800/60"
            }`}
          >
            {result.exitCode !== null ? result.exitCode : "None"}
          </span>
        </div>
      </div>

      {/* Right: Explicit Simulated Mock Indicator */}
      {result.isSimulated && (
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#2A2D2E] text-[10px] text-[#A0A0A0] border border-[#3C3C3C]"
          title="These metrics are simulated by the Mock Execution Adapter for local testing."
        >
          <Info className="h-3 w-3 text-[#007ACC]" />
          <span>Simulated Execution (Mock Adapter)</span>
        </div>
      )}
    </div>
  );
};
