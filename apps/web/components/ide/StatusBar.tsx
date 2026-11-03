"use client";

import React from "react";
import { GitBranch, AlertCircle, AlertTriangle, Radio, Check, Bell } from "lucide-react";
import { EditorTab } from "@/types/ide";

interface StatusBarProps {
  workspaceName?: string;
  activeTab: EditorTab | null;
  cursorPosition?: { lineNumber: number; column: number };
  language?: string;
  indentation?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  workspaceName = "workspace",
  activeTab,
  cursorPosition = { lineNumber: 1, column: 1 },
  language: customLanguage,
  indentation = "Spaces: 4",
}) => {
  const language = customLanguage || activeTab?.language || "Plain Text";

  return (
    <footer className="h-6 bg-[#007ACC] text-white flex items-center justify-between px-2 text-[11px] font-sans select-none shrink-0 z-30">
      {/* Left items */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div
          title="CodeSync Environment (Local / Standby)"
          className="flex items-center gap-1 hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
        >
          <Radio className="h-3 w-3" />
          <span className="font-medium">CodeSync</span>
        </div>

        {/* Git Branch */}
        <div
          title="Git Repository: main branch"
          className="flex items-center gap-1 hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors hidden sm:flex"
        >
          <GitBranch className="h-3 w-3" />
          <span>main*</span>
        </div>

        {/* Error / Warning counters */}
        <div
          title="No problems"
          className="flex items-center gap-2 hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
        >
          <span className="flex items-center gap-0.5">
            <AlertCircle className="h-3 w-3" /> 0
          </span>
          <span className="flex items-center gap-0.5">
            <AlertTriangle className="h-3 w-3" /> 0
          </span>
        </div>
      </div>

      {/* Right items */}
      <div className="flex items-center gap-3">
        {/* Active Line & Column */}
        <div
          title="Cursor Position"
          className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors hidden md:block font-mono"
        >
          Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
        </div>

        {/* Indentation */}
        <div
          title="Indentation: Spaces"
          className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors hidden md:block"
        >
          {indentation}
        </div>

        {/* Encoding */}
        <div
          title="File Encoding"
          className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors hidden sm:block"
        >
          UTF-8
        </div>

        {/* End of Line Sequence */}
        <div
          title="End of Line Sequence: Line Feed"
          className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors hidden sm:block"
        >
          LF
        </div>

        {/* File Language */}
        <div
          title="Select Language Mode"
          className="hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors font-medium"
        >
          {language}
        </div>

        {/* Prettier / Linter indicator */}
        <div
          title="Formatting: Prettier Ready"
          className="flex items-center gap-0.5 hover:bg-black/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
        >
          <Check className="h-3 w-3" />
          <span className="hidden lg:inline">Prettier</span>
        </div>

        {/* Notification Bell */}
        <div
          title="No Notifications"
          className="hover:bg-black/10 p-1 rounded cursor-pointer transition-colors"
        >
          <Bell className="h-3 w-3" />
        </div>
      </div>
    </footer>
  );
};
