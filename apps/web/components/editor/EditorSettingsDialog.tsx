"use client";

import React from "react";
import { Settings, X } from "lucide-react";
import type { EditorSettings } from "@/lib/editor/editorTypes";

interface EditorSettingsDialogProps {
  isOpen: boolean;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: Partial<EditorSettings>) => void;
  onClose: () => void;
}

export const EditorSettingsDialog: React.FC<EditorSettingsDialogProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-[#252526] border border-[#3C3C3C] rounded-lg shadow-2xl overflow-hidden text-[#CCCCCC]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#333333] bg-[#1E1E1E]">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[#007ACC]" />
            <h3 id="editor-settings-title" className="text-sm font-semibold text-white">
              Editor Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#333333] transition-colors"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* 1. Theme */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="setting-theme" className="font-medium text-white block">
                Editor Theme
              </label>
              <span className="text-[11px] text-[#858585]">
                Color theme for syntax and workbench
              </span>
            </div>
            <select
              id="setting-theme"
              value={settings.theme}
              onChange={(e) => onUpdateSettings({ theme: e.target.value as any })}
              className="bg-[#3C3C3C] text-white border border-[#555555] rounded px-2.5 py-1 text-xs focus:outline-hidden focus:border-[#007ACC]"
            >
              <option value="vs-dark">Dark+ (Visual Studio)</option>
              <option value="vs">Light+ (Visual Studio)</option>
              <option value="hc-black">High Contrast Dark</option>
            </select>
          </div>

          {/* 2. Font Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="setting-font-size" className="font-medium text-white block">
                  Font Size
                </label>
                <span className="text-[11px] text-[#858585]">
                  Controls the font size in pixels (10–30px)
                </span>
              </div>
              <span className="font-mono text-[#007ACC] font-semibold">{settings.fontSize}px</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="setting-font-size"
                type="range"
                min={10}
                max={30}
                step={1}
                value={settings.fontSize}
                onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
                className="flex-1 accent-[#007ACC] cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Tab Size */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="setting-tab-size" className="font-medium text-white block">
                Tab Size
              </label>
              <span className="text-[11px] text-[#858585]">
                The number of spaces equal to a tab
              </span>
            </div>
            <select
              id="setting-tab-size"
              value={settings.tabSize}
              onChange={(e) => onUpdateSettings({ tabSize: Number(e.target.value) as 2 | 4 | 8 })}
              className="bg-[#3C3C3C] text-white border border-[#555555] rounded px-2.5 py-1 text-xs focus:outline-hidden focus:border-[#007ACC]"
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value={8}>8 spaces</option>
            </select>
          </div>

          {/* 4. Word Wrap */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="setting-word-wrap" className="font-medium text-white block">
                Word Wrap
              </label>
              <span className="text-[11px] text-[#858585]">Controls whether lines should wrap</span>
            </div>
            <select
              id="setting-word-wrap"
              value={settings.wordWrap}
              onChange={(e) => onUpdateSettings({ wordWrap: e.target.value as "on" | "off" })}
              className="bg-[#3C3C3C] text-white border border-[#555555] rounded px-2.5 py-1 text-xs focus:outline-hidden focus:border-[#007ACC]"
            >
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>

          {/* 5. Minimap */}
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="setting-minimap" className="font-medium text-white block">
                Minimap
              </label>
              <span className="text-[11px] text-[#858585]">
                Show a code outline overview on the right
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="setting-minimap"
                type="checkbox"
                checked={settings.minimap}
                onChange={(e) => onUpdateSettings({ minimap: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#3C3C3C] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#007ACC]"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-[#333333] bg-[#1E1E1E]">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded text-xs font-medium bg-[#007ACC] hover:bg-[#0062A3] text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
