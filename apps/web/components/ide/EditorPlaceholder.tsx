"use client";

import React from "react";
import { ChevronRight, FileCode } from "lucide-react";
import { EditorTab } from "@/types/ide";
import { getFileIcon } from "./FileTreeItem";

interface EditorPlaceholderProps {
  activeTab: EditorTab;
  workspaceName?: string;
}

// Lightweight syntax tokenizer for realistic code presentation
function formatCodeLine(line: string, lineIndex: number) {
  // If line is empty
  if (!line) {
    return <span>&nbsp;</span>;
  }

  // Comments (// or # or /* or *)
  const trimmed = line.trimStart();
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*")
  ) {
    return <span className="text-[#6A9955] italic">{line}</span>;
  }

  // Simple token regex matching strings, numbers, keywords, and standard tokens
  const tokenRegex =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`|\b(?:import|export|from|default|const|let|var|function|return|if|else|for|while|class|interface|type|public|private|static|void|int|auto|struct|include|using|namespace)\b|\b\d+\b|[{}()[\];,.<>=+\-*/:]+|\w+)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    // Non-matched whitespace before token
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${lineIndex}-${match.index}`;

    if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) {
      parts.push(
        <span key={key} className="text-[#CE9178]">
          {token}
        </span>
      );
    } else if (
      /^\b(?:import|export|from|default|const|let|var|function|return|if|else|for|while|class|interface|type|public|private|static|void|int|auto|struct|include|using|namespace)\b$/.test(
        token
      )
    ) {
      parts.push(
        <span key={key} className="text-[#569CD6] font-semibold">
          {token}
        </span>
      );
    } else if (/^\b\d+\b$/.test(token)) {
      parts.push(
        <span key={key} className="text-[#B5CEA8]">
          {token}
        </span>
      );
    } else if (/^[A-Z][A-Za-z0-9_]*$/.test(token)) {
      parts.push(
        <span key={key} className="text-[#4EC9B0]">
          {token}
        </span>
      );
    } else if (
      /^[a-z][A-Za-z0-9_]*$/.test(token) &&
      (token === "main" ||
        token === "formatBytes" ||
        token === "cout" ||
        token === "println" ||
        token === "log" ||
        token === "setw")
    ) {
      parts.push(
        <span key={key} className="text-[#DCDCAA]">
          {token}
        </span>
      );
    } else {
      parts.push(
        <span key={key} className="text-[#D4D4D4]">
          {token}
        </span>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return <>{parts}</>;
}

export const EditorPlaceholder: React.FC<EditorPlaceholderProps> = ({
  activeTab,
  workspaceName = "Workspace",
}) => {
  const lines = (activeTab.content || "").split("\n");
  // Default to highlighting line 12 or line 5
  const activeLineIndex = Math.min(10, Math.max(0, lines.length - 2));

  // Breadcrumb path segments
  const breadcrumbSegments = activeTab.path.split("/");

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1E1E1E] overflow-hidden select-text">
      {/* Breadcrumb Bar */}
      <div className="h-7 px-4 bg-[#1E1E1E] border-b border-[#303030]/60 flex items-center gap-1.5 text-xs text-[#858585] select-none shrink-0">
        <span className="hover:text-[#CCCCCC] cursor-pointer">{workspaceName}</span>
        {breadcrumbSegments.map((segment, index) => (
          <React.Fragment key={index}>
            <ChevronRight className="h-3 w-3 text-[#505050] shrink-0" />
            <span
              className={`hover:text-[#CCCCCC] cursor-pointer flex items-center gap-1 ${
                index === breadcrumbSegments.length - 1 ? "text-[#CCCCCC] font-medium" : ""
              }`}
            >
              {index === breadcrumbSegments.length - 1 && getFileIcon(activeTab.extension)}
              {segment}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Code Editor Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Editor Text Area with Line Numbers */}
        <div className="flex-1 overflow-auto font-mono text-[13px] leading-6 py-2">
          {lines.map((line, idx) => {
            const isCurrentLine = idx === activeLineIndex;
            return (
              <div
                key={idx}
                className={`flex items-start w-full group ${
                  isCurrentLine ? "bg-[#282828]" : "hover:bg-[#252525]/40"
                }`}
              >
                {/* Line number gutter */}
                <div
                  className={`w-12 text-right pr-4 select-none shrink-0 font-mono text-xs ${
                    isCurrentLine ? "text-[#C6C6C6] font-bold" : "text-[#858585]"
                  }`}
                >
                  {idx + 1}
                </div>

                {/* Line content */}
                <div className="flex-1 whitespace-pre pr-8 pl-1">{formatCodeLine(line, idx)}</div>
              </div>
            );
          })}
        </div>

        {/* Visual Minimap Sidebar (VS Code Style) */}
        <div className="w-16 bg-[#181818]/60 border-l border-[#303030]/50 hidden lg:flex flex-col py-2 px-1 select-none pointer-events-none opacity-40 shrink-0">
          {lines.slice(0, 45).map((line, idx) => {
            const width = Math.min(100, Math.max(15, line.trim().length * 2.5));
            return (
              <div
                key={idx}
                style={{ width: `${width}%` }}
                className={`h-[3px] my-[1.5px] rounded-[1px] ${
                  idx === activeLineIndex ? "bg-[#007ACC]" : "bg-[#858585]"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
