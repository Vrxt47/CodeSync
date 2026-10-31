"use client";

import React from "react";
import { Code2, FilePlus, Search, Terminal, Sparkles } from "lucide-react";

interface WelcomeScreenProps {
  onOpenFilePrompt?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#1E1E1E] text-[#CCCCCC] select-none text-center">
      <div className="max-w-md mx-auto space-y-6">
        {/* CodeSync Logo with subtle ambient glow */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-[#007ACC]/20 blur-xl rounded-full" />
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-[#007ACC] to-[#005A9E] flex items-center justify-center shadow-lg shadow-[#007ACC]/25 border border-[#007ACC]/50">
              <Code2 className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            CodeSync IDE
          </h1>
          <p className="text-sm text-[#858585]">Collaborative coding, together.</p>
        </div>

        {/* Shortcuts list */}
        <div className="bg-[#181818] border border-[#303030] rounded-lg p-4 space-y-2.5 text-xs text-left">
          <div className="text-[11px] font-semibold text-[#858585] uppercase tracking-wider mb-2">
            Common Shortcuts
          </div>

          <div className="flex items-center justify-between py-1 border-b border-[#303030]/50">
            <span className="text-[#CCCCCC] flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-[#007ACC]" />
              Quick Open File
            </span>
            <kbd className="font-mono text-[11px] bg-[#252526] px-2 py-0.5 rounded border border-[#303030] text-[#858585]">
              Ctrl + P
            </kbd>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-[#303030]/50">
            <span className="text-[#CCCCCC] flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#007ACC]" />
              Command Palette
            </span>
            <kbd className="font-mono text-[11px] bg-[#252526] px-2 py-0.5 rounded border border-[#303030] text-[#858585]">
              Ctrl + Shift + P
            </kbd>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-[#303030]/50">
            <span className="text-[#CCCCCC] flex items-center gap-2">
              <FilePlus className="h-3.5 w-3.5 text-[#007ACC]" />
              Toggle Primary Sidebar
            </span>
            <kbd className="font-mono text-[11px] bg-[#252526] px-2 py-0.5 rounded border border-[#303030] text-[#858585]">
              Ctrl + B
            </kbd>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-[#CCCCCC] flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-[#007ACC]" />
              Toggle Terminal Panel
            </span>
            <kbd className="font-mono text-[11px] bg-[#252526] px-2 py-0.5 rounded border border-[#303030] text-[#858585]">
              Ctrl + `
            </kbd>
          </div>
        </div>

        {/* Call to action notice */}
        <p className="text-xs text-[#858585]">
          Select any file in the Explorer on the left to start viewing and editing.
        </p>
      </div>
    </div>
  );
};
