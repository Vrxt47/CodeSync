"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import type { EditorTab } from "@/types/ide";
import type { CursorPosition, EditorSettings } from "@/lib/editor/editorTypes";
import { getMonacoLanguage, getLanguageDisplayName } from "@/lib/editor/languageUtils";
import { getStoredSettings, setStoredSettings } from "@/lib/editor/editorConfig";
import { fileApi } from "@/lib/fileApi";
import { useAutosave } from "@/hooks/useAutosave";
import { EditorToolbar } from "./EditorToolbar";
import { CodeEditor } from "./CodeEditor";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { EditorSettingsDialog } from "./EditorSettingsDialog";
import { WelcomeScreen } from "../ide/WelcomeScreen";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

export interface EditorContainerProps {
  workspaceName?: string;
  tabs?: EditorTab[];
  activeTab: EditorTab | null;
  onUpdateTabContent?: (tabId: string, content: string, isDirty: boolean) => void;
  onTabDirtyChange?: (tabId: string, isDirty: boolean) => void;
  onTabSaved?: (tabId: string, savedContent: string, updatedAt?: string, version?: number) => void;
  onTabLoaded?: (tabId: string, content: string, updatedAt?: string, version?: number) => void;
  onCursorChange?: (cursor: CursorPosition) => void;
  onLanguageChange?: (language: string) => void;
  pendingTransition?: {
    action: () => void;
    targetName: string;
  } | null;
  onCancelPendingTransition?: () => void;
  onConfirmPendingTransition?: () => void;
}

export const EditorContainer: React.FC<EditorContainerProps> = ({
  workspaceName = "Workspace",
  tabs,
  activeTab,
  onUpdateTabContent,
  onTabDirtyChange,
  onTabSaved,
  onTabLoaded,
  onCursorChange,
  onLanguageChange,
  pendingTransition,
  onCancelPendingTransition,
  onConfirmPendingTransition,
}) => {
  // Configurable editor settings with persistent storage
  const [settings, setSettings] = useState<EditorSettings>(() => getStoredSettings());
  const [showSettingsDialog, setShowSettingsDialog] = useState<boolean>(false);

  // Active file content state
  const [content, setContent] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Formatting state
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  // Modal dialog for closing dirty tabs
  const [showUnsavedDialog, setShowUnsavedDialog] = useState<boolean>(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  // In-flight request deduplication map (fileId -> Promise)
  const inFlightFetchesRef = useRef<Map<string, Promise<any>>>(new Map());

  // Race condition & latest content references
  const loadSeqRef = useRef<number>(0);
  const currentContentRef = useRef<string>("");
  currentContentRef.current = content;

  const activeTabId = activeTab?.id || null;

  // Compute active file language
  const monacoLanguage = getMonacoLanguage(activeTab?.name);
  const languageDisplayName = getLanguageDisplayName(monacoLanguage);

  // Autosave engine - isolated dirty notifications and persisted save updates
  const autosave = useAutosave({
    onFileSaved: (fileId, savedContent, updatedAt, version) => {
      onTabSaved?.(fileId, savedContent, updatedAt, version);
    },
    onDirtyChange: (fileId, isDirty) => {
      onTabDirtyChange?.(fileId, isDirty);
    },
  });

  const activeSaveState = autosave.getFileSaveState(activeTabId);

  // Track closed tabs and evict autosave records to prevent dangling timers or PUTs
  const prevTabIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentTabIds = new Set(tabs?.map((t) => t.id) ?? (activeTabId ? [activeTabId] : []));
    for (const prevId of prevTabIdsRef.current) {
      if (!currentTabIds.has(prevId)) {
        autosave.removeFile(prevId, { force: true });
      }
    }
    prevTabIdsRef.current = currentTabIds;
  }, [tabs, activeTabId, autosave]);

  // Notify parent of language changes
  useEffect(() => {
    if (activeTab) {
      onLanguageChange?.(languageDisplayName);
    }
  }, [activeTab, languageDisplayName, onLanguageChange]);

  // Hydration state tracking
  const [retryTrigger, setRetryTrigger] = useState<number>(0);
  const lastHydratedTabIdRef = useRef<string | null>(null);

  const handleRetryHydration = useCallback(() => {
    if (!activeTabId) return;
    setLoadError(null);
    setIsLoadingContent(true);
    inFlightFetchesRef.current.delete(activeTabId);
    setRetryTrigger((prev) => prev + 1);
  }, [activeTabId]);

  // Load active tab content from memory or backend on tab switch
  useEffect(() => {
    if (!activeTab || !activeTabId) {
      setContent("");
      setIsLoadingContent(false);
      setLoadError(null);
      return;
    }

    // 1. If tab content is already in memory and marked loaded, switch immediately (0ms lag)
    if (activeTab.isLoaded) {
      // Avoid redundant re-initialization if this exact tab was just hydrated in the same turn
      if (lastHydratedTabIdRef.current !== activeTabId) {
        setContent(activeTab.content);
        currentContentRef.current = activeTab.content;
        autosave.initFile(
          activeTabId,
          activeTab.content,
          activeTab.savedContent ?? activeTab.content,
          activeTab.updatedAt,
          activeTab.version
        );
      }
      setIsLoadingContent(false);
      setLoadError(null);
      return;
    }

    // 2. Initial load from backend for freshly opened or restored unhydrated file
    const targetTabId = activeTabId;
    const seq = ++loadSeqRef.current;
    setIsLoadingContent(true);
    setLoadError(null);

    // Reuse in-flight promise if one already exists for this tab
    const fetchPromise =
      inFlightFetchesRef.current.get(targetTabId) || fileApi.getFile(targetTabId);
    inFlightFetchesRef.current.set(targetTabId, fetchPromise);

    void fetchPromise
      .then((item) => {
        inFlightFetchesRef.current.delete(targetTabId);
        const loadedContent = item.content ?? "";

        // Single coherent atomic state transition in parent openTabs
        onTabLoaded?.(targetTabId, loadedContent, item.updatedAt, item.version);

        // Only update active editor state if targetTabId is still active and request is current
        if (seq !== loadSeqRef.current) return;
        lastHydratedTabIdRef.current = targetTabId;
        setContent(loadedContent);
        currentContentRef.current = loadedContent;
        autosave.initFile(targetTabId, loadedContent, loadedContent, item.updatedAt, item.version);
      })
      .catch((err) => {
        inFlightFetchesRef.current.delete(targetTabId);
        if (seq !== loadSeqRef.current) return;
        const message = err instanceof Error ? err.message : "Failed to load file content";
        setLoadError(message);
      })
      .finally(() => {
        if (seq === loadSeqRef.current) {
          setIsLoadingContent(false);
        }
      });
  }, [activeTabId, activeTab?.isLoaded, retryTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Monaco content change
  const handleContentChange = useCallback(
    (newVal: string) => {
      // Do not process changes for unhydrated tabs
      if (!activeTab?.isLoaded) return;

      setContent(newVal);
      currentContentRef.current = newVal;

      if (activeTabId) {
        autosave.handleContentChange(activeTabId, newVal);
        const state = autosave.getFileSaveState(activeTabId);
        onUpdateTabContent?.(activeTabId, newVal, state.isDirty);
      }
    },
    [activeTab?.isLoaded, activeTabId, autosave, onUpdateTabContent]
  );

  // Handle cursor movement inside editor
  const handleCursorChange = useCallback(
    (lineNumber: number, column: number) => {
      onCursorChange?.({ lineNumber, column });
    },
    [onCursorChange]
  );

  // Manual save trigger (Ctrl+S / Save button) - only allowed once hydrated
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!activeTabId || !activeTab?.isLoaded) return false;
    return autosave.saveImmediately(activeTabId);
  }, [activeTabId, activeTab?.isLoaded, autosave]);

  // Retry save on network failure
  const handleRetrySave = useCallback(async () => {
    if (!activeTabId || !activeTab?.isLoaded) return;
    await autosave.retrySave(activeTabId);
  }, [activeTabId, activeTab?.isLoaded, autosave]);

  // Code formatting (Shift+Alt+F / Shift+Option+F)
  const handleFormat = useCallback(async () => {
    if (!activeTab || !activeTabId || !activeTab.isLoaded || isFormatting) return;
    setIsFormatting(true);
    setFormatError(null);

    try {
      const codeToFormat = currentContentRef.current;
      const formatted = await fileApi.formatFile(activeTabId, codeToFormat, monacoLanguage);

      if (formatted !== codeToFormat) {
        setContent(formatted);
        currentContentRef.current = formatted;
        handleContentChange(formatted);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Formatting failed";
      setFormatError(msg);
      // Auto-clear formatting error after 5 seconds
      setTimeout(() => setFormatError(null), 5000);
    } finally {
      setIsFormatting(false);
    }
  }, [activeTab, activeTabId, isFormatting, monacoLanguage, handleContentChange]);

  // Update editor settings
  const handleUpdateSettings = useCallback((newSettings: Partial<EditorSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      setStoredSettings(updated);
      return updated;
    });
  }, []);

  // Toggle theme between dark and light
  const handleToggleTheme = useCallback(() => {
    const nextTheme = settings.theme === "vs-dark" ? "vs" : "vs-dark";
    handleUpdateSettings({ theme: nextTheme });
  }, [settings.theme, handleUpdateSettings]);

  // Keyboard shortcut listeners (Ctrl+S and Shift+Alt+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save: Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (activeTabId) {
          void handleSave();
        }
      }

      // Format: Shift+Alt+F / Shift+Option+F
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();
        void handleFormat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTabId, handleSave, handleFormat]);

  // Browser beforeunload protection when unsaved modifications exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeSaveState.isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeSaveState.isDirty]);

  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isDiscarding, setIsDiscarding] = useState<boolean>(false);

  // Synchronize with external pending transition (closing a dirty tab)
  useEffect(() => {
    if (pendingTransition) {
      setShowUnsavedDialog(true);
      setDialogError(null);
      pendingActionRef.current = pendingTransition.action;
      // Pause autosave debouncing while user deliberates in the dialog
      if (activeTabId) {
        autosave.pauseAutosave(activeTabId);
      }
    } else {
      setShowUnsavedDialog(false);
      setDialogError(null);
      pendingActionRef.current = null;
    }
  }, [pendingTransition, activeTabId, autosave]);

  // Unsaved changes dialog actions
  const handleDialogSave = async () => {
    setDialogError(null);
    try {
      const success = await handleSave();
      if (success) {
        setShowUnsavedDialog(false);
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        if (activeTabId) {
          autosave.removeFile(activeTabId, { force: false });
        }
        action?.();
        onConfirmPendingTransition?.();
      } else {
        const errorMsg =
          autosave.getFileSaveState(activeTabId).error ||
          "Failed to save changes. Please try again or cancel.";
        setDialogError(errorMsg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save file";
      setDialogError(msg);
    }
  };

  const handleDialogDiscard = async () => {
    setDialogError(null);
    setIsDiscarding(true);

    try {
      if (activeTabId) {
        const success = await autosave.discardChanges(activeTabId);
        if (!success) {
          const errorMsg =
            autosave.getFileSaveState(activeTabId).error ||
            "Failed to discard changes. Please try again or cancel.";
          setDialogError(errorMsg);
          return;
        }
      }

      setShowUnsavedDialog(false);

      // Revert to saved content and mark clean
      const baseline = activeTab?.savedContent ?? "";
      setContent(baseline);
      currentContentRef.current = baseline;
      if (activeTabId) {
        onUpdateTabContent?.(activeTabId, baseline, false);
        onTabDirtyChange?.(activeTabId, false);
      }

      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      action?.();
      onConfirmPendingTransition?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to discard changes";
      setDialogError(msg);
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleDialogCancel = () => {
    setDialogError(null);
    setShowUnsavedDialog(false);
    pendingActionRef.current = null;
    onCancelPendingTransition?.();

    // Resume normal autosave debouncing so user can continue working
    if (activeTabId) {
      autosave.resumeAutosave(activeTabId);
    }
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
        theme={settings.theme}
        saveStatus={activeSaveState.saveStatus}
        isDirty={activeSaveState.isDirty}
        isSaving={activeSaveState.isSaving}
        isFormatting={isFormatting}
        onSave={() => void handleSave()}
        onRetrySave={() => void handleRetrySave()}
        onFormat={() => void handleFormat()}
        onOpenSettings={() => setShowSettingsDialog(true)}
        onToggleTheme={handleToggleTheme}
      />

      {/* Formatting Error Notification Banner */}
      {formatError && (
        <div className="px-3 py-1.5 bg-[#F14C4C]/15 border-b border-[#F14C4C]/30 text-[#F14C4C] text-xs flex items-center justify-between shrink-0 animate-in fade-in">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formatError}</span>
          </div>
          <button
            onClick={() => setFormatError(null)}
            className="p-0.5 rounded hover:bg-[#F14C4C]/20 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. Monaco Code Editor Canvas */}
      {loadError ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#F14C4C] gap-3 select-none">
          <AlertTriangle className="h-8 w-8 text-[#F14C4C] opacity-90" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#CCCCCC]">Failed to open {activeTab.name}</p>
            <p className="text-xs text-[#858585] max-w-md">{loadError}</p>
          </div>
          <button
            onClick={handleRetryHydration}
            className="mt-2 px-3 py-1.5 bg-[#0E639C] hover:bg-[#1177BB] text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <CodeEditor
          value={content}
          language={monacoLanguage}
          theme={settings.theme}
          path={`file://${activeTab.id}/${activeTab.name}`}
          settings={settings}
          onChange={handleContentChange}
          onCursorChange={handleCursorChange}
          isLoading={isLoadingContent}
        />
      )}

      {/* 3. Unsaved Changes Confirmation Modal */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        fileName={pendingTransition?.targetName || activeTab.name}
        isSaving={activeSaveState.isSaving}
        isDiscarding={isDiscarding}
        errorMessage={dialogError || undefined}
        onSave={() => void handleDialogSave()}
        onDiscard={() => void handleDialogDiscard()}
        onCancel={handleDialogCancel}
      />

      {/* 4. Editor Settings Dialog */}
      <EditorSettingsDialog
        isOpen={showSettingsDialog}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setShowSettingsDialog(false)}
      />
    </div>
  );
};
