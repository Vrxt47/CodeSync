"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import type { EditorTab } from "@/types/ide";
import type { CursorPosition, EditorTheme, SaveStatus } from "@/lib/editor/editorTypes";
import { getMonacoLanguage, getLanguageDisplayName } from "@/lib/editor/languageUtils";
import { getStoredTheme, setStoredTheme } from "@/lib/editor/editorConfig";
import { fileApi } from "@/lib/fileApi";
import { EditorToolbar } from "./EditorToolbar";
import { CodeEditor } from "./CodeEditor";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { WelcomeScreen } from "../ide/WelcomeScreen";

export interface EditorContainerProps {
  workspaceName?: string;
  activeTab: EditorTab | null;
  onUpdateTabContent?: (tabId: string, content: string, isDirty: boolean) => void;
  onTabSaved?: (tabId: string, savedContent: string) => void;
  onCursorChange?: (cursor: CursorPosition) => void;
  onLanguageChange?: (language: string) => void;
  // External unsaved changes confirmation (e.g. triggered by tab close or sidebar click)
  pendingTransition?: {
    action: () => void;
    targetName: string;
  } | null;
  onCancelPendingTransition?: () => void;
  onConfirmPendingTransition?: () => void;
}

export const EditorContainer: React.FC<EditorContainerProps> = ({
  workspaceName = "Workspace",
  activeTab,
  onUpdateTabContent,
  onTabSaved,
  onCursorChange,
  onLanguageChange,
  pendingTransition,
  onCancelPendingTransition,
  onConfirmPendingTransition,
}) => {
  // Theme state
  const [theme, setTheme] = useState<EditorTheme>(() => getStoredTheme());

  // Editor content states for active file
  const [content, setContent] = useState<string>("");
  const [savedContent, setSavedContent] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Save states
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Internal dialog state for transitions
  const [showUnsavedDialog, setShowUnsavedDialog] = useState<boolean>(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  // References for concurrency safety
  const loadSeqRef = useRef<number>(0);
  const saveSeqRef = useRef<number>(0);
  const currentContentRef = useRef<string>("");
  currentContentRef.current = content;
  const savedContentRef = useRef<string>("");
  savedContentRef.current = savedContent;

  const activeTabId = activeTab?.id || null;

  // Compute active file language
  const monacoLanguage = getMonacoLanguage(activeTab?.name);
  const languageDisplayName = getLanguageDisplayName(monacoLanguage);

  // Notify parent of language changes
  useEffect(() => {
    if (activeTab) {
      onLanguageChange?.(languageDisplayName);
    }
  }, [activeTab, languageDisplayName, onLanguageChange]);

  // Load active tab content from backend whenever activeTabId changes
  useEffect(() => {
    if (!activeTab || !activeTabId) {
      setContent("");
      setSavedContent("");
      setSaveStatus("saved");
      return;
    }

    const seq = ++loadSeqRef.current;
    setIsLoadingContent(true);
    setLoadError(null);

    // If tab already has content stored in memory and was dirty, preserve it
    if (activeTab.content !== undefined && activeTab.content !== "" && activeTab.isDirty) {
      setContent(activeTab.content);
      currentContentRef.current = activeTab.content;
      // Saved content baseline is retrieved or default
      const baseline = (activeTab as any).savedContent ?? activeTab.content;
      setSavedContent(baseline);
      savedContentRef.current = baseline;
      setSaveStatus("unsaved");
      setIsLoadingContent(false);
      return;
    }

    void fileApi
      .getFile(activeTabId)
      .then((item) => {
        if (seq !== loadSeqRef.current) return;
        const loadedContent = item.content ?? "";
        setContent(loadedContent);
        setSavedContent(loadedContent);
        currentContentRef.current = loadedContent;
        savedContentRef.current = loadedContent;
        setSaveStatus("saved");
        onUpdateTabContent?.(activeTabId, loadedContent, false);
      })
      .catch((err) => {
        if (seq !== loadSeqRef.current) return;
        const message = err instanceof Error ? err.message : "Failed to load file content";
        setLoadError(message);
      })
      .finally(() => {
        if (seq === loadSeqRef.current) {
          setIsLoadingContent(false);
        }
      });
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Monaco theme toggle
  const handleToggleTheme = useCallback(() => {
    const nextTheme: EditorTheme = theme === "vs-dark" ? "vs" : "vs-dark";
    setTheme(nextTheme);
    setStoredTheme(nextTheme);
  }, [theme]);

  // Handle Monaco content change
  const handleContentChange = useCallback(
    (newVal: string) => {
      setContent(newVal);
      currentContentRef.current = newVal;

      const isDirty = newVal !== savedContentRef.current;
      setSaveStatus(isDirty ? "unsaved" : "saved");

      if (activeTabId) {
        onUpdateTabContent?.(activeTabId, newVal, isDirty);
      }
    },
    [activeTabId, onUpdateTabContent]
  );

  // Handle cursor movement inside editor
  const handleCursorChange = useCallback(
    (lineNumber: number, column: number) => {
      onCursorChange?.({ lineNumber, column });
    },
    [onCursorChange]
  );

  // Save current file to backend
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!activeTabId || isSaving) return false;

    const contentToSave = currentContentRef.current;
    const seq = ++saveSeqRef.current;

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      await fileApi.updateFileContent(activeTabId, contentToSave);

      if (seq === saveSeqRef.current) {
        setSavedContent(contentToSave);
        savedContentRef.current = contentToSave;

        // Verify if user kept typing while save was resolving
        const stillDirty = currentContentRef.current !== contentToSave;
        setSaveStatus(stillDirty ? "unsaved" : "saved");

        onTabSaved?.(activeTabId, contentToSave);
        onUpdateTabContent?.(activeTabId, currentContentRef.current, stillDirty);
      }
      return true;
    } catch {
      if (seq === saveSeqRef.current) {
        setSaveStatus("error");
      }
      return false;
    } finally {
      if (seq === saveSeqRef.current) {
        setIsSaving(false);
      }
    }
  }, [activeTabId, isSaving, onTabSaved, onUpdateTabContent]);

  // Global save shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (activeTabId) {
          void handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTabId, handleSave]);

  // Browser beforeunload protection when unsaved modifications exist
  const isDirty = content !== savedContent;
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Synchronize with external pending transition (if passed from parent)
  useEffect(() => {
    if (pendingTransition && isDirty) {
      setShowUnsavedDialog(true);
      pendingActionRef.current = pendingTransition.action;
    } else if (pendingTransition && !isDirty) {
      // Clean tab, execute directly
      pendingTransition.action();
      onConfirmPendingTransition?.();
    }
  }, [pendingTransition, isDirty, onConfirmPendingTransition]);

  // Dialog actions
  const handleDialogSave = async () => {
    const success = await handleSave();
    if (success) {
      setShowUnsavedDialog(false);
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      action?.();
      onConfirmPendingTransition?.();
    }
  };

  const handleDialogDiscard = () => {
    // Revert to saved content
    setContent(savedContent);
    currentContentRef.current = savedContent;
    setSaveStatus("saved");
    if (activeTabId) {
      onUpdateTabContent?.(activeTabId, savedContent, false);
    }

    setShowUnsavedDialog(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
    onConfirmPendingTransition?.();
  };

  const handleDialogCancel = () => {
    setShowUnsavedDialog(false);
    pendingActionRef.current = null;
    onCancelPendingTransition?.();
  };

  if (!activeTab) {
    return <WelcomeScreen />;
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden min-w-0 bg-[#1E1E1E]">
      {/* 1. Top Editor Toolbar */}
      <EditorToolbar
        workspaceName={workspaceName}
        fileName={activeTab.name}
        filePath={activeTab.path}
        extension={activeTab.extension}
        languageDisplayName={languageDisplayName}
        theme={theme}
        saveStatus={saveStatus}
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={() => void handleSave()}
        onToggleTheme={handleToggleTheme}
      />

      {/* 2. Monaco Code Editor Canvas */}
      {loadError ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#F14C4C] gap-2">
          <p className="text-sm font-semibold">Failed to open file</p>
          <p className="text-xs text-[#858585]">{loadError}</p>
        </div>
      ) : (
        <CodeEditor
          value={content}
          language={monacoLanguage}
          theme={theme}
          onChange={handleContentChange}
          onCursorChange={handleCursorChange}
          isLoading={isLoadingContent}
        />
      )}

      {/* 3. Unsaved Changes Confirmation Modal */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        fileName={activeTab.name}
        isSaving={isSaving}
        onSave={() => void handleDialogSave()}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />
    </div>
  );
};
