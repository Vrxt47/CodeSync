"use client";

import React from "react";
import { Keyboard, RotateCcw } from "lucide-react";

export interface InputTabProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  className?: string;
}

export const InputTab: React.FC<InputTabProps> = ({ value, onChange, onClear, className = "" }) => {
  const lineCount = value.length > 0 ? value.split("\n").length : 0;
  const charCount = value.length;

  return (
    <div className={`flex flex-col flex-1 h-full overflow-hidden bg-[#181818] ${className}`}>
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1A1A1A] border-b border-[#303030] shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Keyboard className="h-3.5 w-3.5 text-[#007ACC]" />
          <span className="text-xs font-semibold text-[#CCCCCC]">Standard Input (stdin)</span>
          <span className="text-[11px] text-[#858585] hidden sm:inline">
            — Supplied to program during execution
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Metrics: Lines & Characters */}
          <span className="text-[11px] font-mono text-[#858585]">
            {lineCount} {lineCount === 1 ? "line" : "lines"} ({charCount} chars)
          </span>

          {/* Clear Stdin Button */}
          <button
            onClick={onClear}
            disabled={!value || value.length === 0}
            title="Clear stdin input"
            className="flex items-center gap-1 text-[11px] text-[#858585] hover:text-[#CCCCCC] px-1.5 py-0.5 rounded hover:bg-[#2A2D2E] transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#858585] cursor-pointer disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear Input</span>
          </button>
        </div>
      </div>

      {/* 2. Monospace Multiline Textarea Editor */}
      <div className="flex-1 p-2 bg-[#141414] overflow-hidden flex flex-col">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            "Enter custom input (stdin) for your program here...\n\nExample:\n5\n10 20\nHello World"
          }
          spellCheck={false}
          className="flex-1 w-full h-full bg-transparent text-[#E0E0E0] placeholder-[#606060] font-mono text-[13px] leading-relaxed p-2 border-none resize-none focus:outline-none selection:bg-[#264F78]"
          aria-label="Standard input (stdin)"
        />
      </div>
    </div>
  );
};
