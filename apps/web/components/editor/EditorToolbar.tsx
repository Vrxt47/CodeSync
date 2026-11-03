"use client";

import React from "react";
import { Save, Check, Loader2, AlertCircle, Sun, Moon, ChevronRight, Folder } from "lucide-react";
import type { EditorTheme, SaveStatus } from "@/lib/editor/editorTypes";
import { getFileIcon } from "../ide/FileTreeItem";

interface EditorToolbarProps {
  workspaceName?: string;
  fileName: string;
  filePath?: string;
  extension?: string;
  languageDisplayName: string;
  theme: EditorTheme;
  saveStatus: SaveStatus;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onToggleTheme: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  workspaceName = "Workspace",
  fileName,
  filePath,
  extension,
  languageDisplayName,
  theme,
  saveStatus,
  isDirty,
  isSaving,
  onSave,
  onToggleTheme,
}) => {
  // Render status badge
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <div className="flex items-center gap-1.5 text-xs text-[#007ACC] font-medium animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Saving...</span>
          </div>
        );
      case "unsaved":
        return (
          <div className="flex items-center gap-1.5 text-xs text-[#CCA700] font-medium">
            <span className="h-2 w-2 rounded-full bg-[#CCA700]" />
            <span>Unsaved changes</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1.5 text-xs text-[#F14C4C] font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Save failed</span>
          </div>
        );
      case "saved":
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs text-[#89D185] font-medium">
            <Check className="h-3.5 w-3.5" />
            <span>Saved</span>
          </div>
        );
    }
  };

  const isDark = theme === "vs-dark";

  return (
    <div
      className={`h-9 px-3 flex items-center justify-between border-b select-none shrink-0 transition-colors ${
        isDark
          ? "bg-[#1E1E1E] border-[#303030] text-[#CCCCCC]"
          : "bg-[#F3F3F3] border-[#E5E5E5] text-[#333333]"
      }`}
    >
      {/* Left: Breadcrumbs & Language Badge */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1 text-xs text-[#858585] truncate">
          <Folder className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate max-w-[120px]">{workspaceName}</span>
          <ChevronRight className="h-3 w-3 shrink-0" />
          {filePath && filePath !== fileName && (
            <>
              <span className="truncate max-w-[120px] text-[#858585]">{filePath}</span>
              <ChevronRight className="h-3 w-3 shrink-0" />
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-medium text-xs">
          {getFileIcon(extension)}
          <span className={isDark ? "text-white" : "text-black"}>{fileName}</span>
        </div>

        {/* Language Badge */}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wide border ${
            isDark
              ? "bg-[#252526] border-[#3C3C3C] text-[#858585]"
              : "bg-[#EAEAEA] border-[#D5D5D5] text-[#555555]"
          }`}
        >
          {languageDisplayName}
        </span>
      </div>

      {/* Right: Save Status, Save Button, Theme Switcher */}
      <div className="flex items-center gap-3">
        {/* Status Indicator */}
        <div className="hidden sm:flex items-center">{renderSaveStatus()}</div>

        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={isSaving}
          title="Save file (Ctrl+S / Cmd+S)"
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 ${
            isDirty
              ? "bg-[#007ACC] hover:bg-[#0062A3] text-white shadow-sm"
              : isDark
                ? "bg-[#2A2D2E] hover:bg-[#373A3C] text-[#CCCCCC]"
                : "bg-[#E0E0E0] hover:bg-[#D0D0D0] text-[#333333]"
          }`}
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span>Save</span>
          <kbd
            className={`hidden md:inline-block text-[10px] px-1 py-0.2 rounded border ${
              isDirty
                ? "border-white/30 text-white/80"
                : isDark
                  ? "border-[#404040] text-[#858585]"
                  : "border-[#B0B0B0] text-[#666666]"
            }`}
          >
            Ctrl+S
          </kbd>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          title={isDark ? "Switch to Light Theme" : "Switch to VS Code Dark+ Theme"}
          className={`p-1.5 rounded transition-colors ${
            isDark
              ? "hover:bg-[#2A2D2E] text-[#858585] hover:text-[#CCCCCC]"
              : "hover:bg-[#E0E0E0] text-[#666666] hover:text-black"
          }`}
          aria-label="Toggle Editor Theme"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
};
