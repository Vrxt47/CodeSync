"use client";

import React, { useState } from "react";
import {
  Terminal as TerminalIcon,
  Maximize2,
  Minimize2,
  X,
  CheckCircle2,
  Play,
  RotateCcw,
} from "lucide-react";
import { BottomPanelTab } from "@/types/ide";

interface BottomPanelProps {
  isOpen: boolean;
  isMaximized: boolean;
  activeTab: BottomPanelTab;
  onSelectTab: (tab: BottomPanelTab) => void;
  onToggleOpen: () => void;
  onToggleMaximized: () => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  isOpen,
  isMaximized,
  activeTab,
  onSelectTab,
  onToggleOpen,
  onToggleMaximized,
}) => {
  const [terminalInput, setTerminalInput] = useState<string>("");
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    "g++ -std=c++17 src/main.cpp -o main && ./main",
    "=========================================",
    "   CodeSync Cloud IDE — Runtime v0.2.0   ",
    "=========================================",
    "Component                Status    Port",
    "-----------------------------------------",
    "Next.js Web Frontend     Online    :3000",
    "Express REST API         Online    :4000",
    "Hocuspocus CRDT Server   Online    :1234",
    "PostgreSQL Database      Ready     :5432",
    "Redis Task Broker        Ready     :6379",
    "-----------------------------------------",
    "Status: All services operational.",
  ]);

  if (!isOpen) {
    return null;
  }

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    setTerminalHistory((prev) => [
      ...prev,
      `codesync@workspace:~/my-workspace$ ${terminalInput}`,
      `[Judge0 CE Sandbox] Execution queued. (Integration active in subsequent chunk)`,
    ]);
    setTerminalInput("");
  };

  const handleClearTerminal = () => {
    setTerminalHistory([]);
  };

  return (
    <div
      className={`bg-[#181818] border-t border-[#303030] flex flex-col shrink-0 select-none z-10 transition-all ${
        isMaximized ? "h-[65vh]" : "h-52"
      }`}
    >
      {/* Panel Tab Header */}
      <div className="h-8 bg-[#181818] border-b border-[#303030]/80 flex items-center justify-between px-3 shrink-0">
        {/* Left tabs */}
        <div className="flex items-center gap-1 h-full">
          {(["output", "terminal", "problems"] as BottomPanelTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => onSelectTab(tab)}
                className={`h-full px-3 text-xs uppercase tracking-wider font-semibold transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? "text-white border-b-2 border-[#007ACC] bg-[#1E1E1E]"
                    : "text-[#858585] hover:text-[#CCCCCC]"
                }`}
              >
                {tab === "terminal" && <TerminalIcon className="h-3 w-3" />}
                {tab.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-1 text-[#858585]">
          {activeTab === "terminal" && (
            <button
              onClick={handleClearTerminal}
              title="Clear Terminal Output"
              className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
              aria-label="Clear Terminal"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={onToggleMaximized}
            title={isMaximized ? "Restore Panel Size" : "Maximize Panel Size"}
            className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            onClick={onToggleOpen}
            title="Hide Panel (Ctrl+`)"
            className="p-1 rounded hover:bg-[#2A2D2E] hover:text-white transition-colors"
            aria-label="Close Panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-auto bg-[#181818] p-3 font-mono text-xs select-text">
        {/* OUTPUT TAB */}
        {activeTab === "output" && (
          <div className="space-y-1 text-[#CCCCCC] leading-relaxed">
            <div className="text-[#858585]">
              [CodeSync Build System] Workspace initialized: MY-WORKSPACE
            </div>
            <div className="text-[#858585]">
              [Hocuspocus Server] CRDT document sync engine ready at :1234
            </div>
            <div className="text-[#858585]">
              [Next.js App Router] Development server operational on port 3000
            </div>
            <div className="text-emerald-400">
              [Language Server] C++, TypeScript, Python runtimes connected.
            </div>
            <div className="pt-2 text-[#858585] italic">Program output will appear here.</div>
          </div>
        )}

        {/* TERMINAL TAB */}
        {activeTab === "terminal" && (
          <div className="flex flex-col h-full font-mono text-[12px] text-[#CCCCCC]">
            <div className="text-[#858585] mb-2 select-none">
              CodeSync Integrated Terminal (v0.2.0) — Sandbox environment
            </div>

            {/* History output */}
            <div className="space-y-0.5 mb-2">
              {terminalHistory.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.startsWith("==") || line.startsWith("--")
                      ? "text-[#5E97D0]"
                      : line.includes("Status: All services")
                        ? "text-emerald-400 font-semibold"
                        : line.startsWith("codesync@")
                          ? "text-white font-medium"
                          : "text-[#CCCCCC]"
                  }
                >
                  {line}
                </div>
              ))}
            </div>

            {/* Interactive Prompt line */}
            <form onSubmit={handleTerminalSubmit} className="flex items-center gap-1 mt-auto pt-1">
              <span className="text-[#007ACC] font-semibold shrink-0">
                codesync@workspace:~/my-workspace$
              </span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="type command (e.g. ./main, npm test)..."
                className="flex-1 bg-transparent text-white focus:outline-none border-none p-0 text-[12px] font-mono"
              />
              <span className="animate-pulse text-[#007ACC] font-bold">█</span>
            </form>
          </div>
        )}

        {/* PROBLEMS TAB */}
        {activeTab === "problems" && (
          <div className="flex flex-col items-center justify-center h-full text-center py-6 text-[#858585]">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
            <div className="text-sm font-medium text-[#CCCCCC]">
              No problems have been detected in the workspace.
            </div>
            <div className="text-xs text-[#858585] mt-1">
              Zero syntax or linting diagnostics found.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
