"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type * as Monaco from "monaco-editor";
import type { EditorTab } from "@/types/ide";
import type { CursorPosition, EditorSettings } from "@/lib/editor/editorTypes";
import {
  getMonacoLanguage,
  getLanguageDisplayName,
  isExecutableLanguage,
} from "@/lib/editor/languageUtils";
import type { SupportedLanguage, ExecutionResult } from "@/services/execution";
import { getStoredSettings, setStoredSettings } from "@/lib/editor/editorConfig";
import {
  selectResumeTargetEngine,
  shouldAutosaveInitMarkDirty,
} from "@/lib/editor/save-reconciliation";
import { fileApi } from "@/lib/fileApi";
import { useAutosave } from "@/hooks/useAutosave";
import { getUserColor, type CollabConnectionStatus, type Collaborator } from "@/hooks/useCollab";
import { useCollabTabs } from "@/hooks/useCollabTabs";
import { useAuth } from "@/providers/auth-provider";
import { EditorToolbar } from "./EditorToolbar";
import { CodeEditor } from "./CodeEditor";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { EditorSettingsDialog } from "./EditorSettingsDialog";
import { WelcomeScreen } from "../ide/WelcomeScreen";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

export interface EditorContainerProps {
  workspaceName?: string;
  workspaceId?: string;
  tabs?: EditorTab[];
  activeTab: EditorTab | null;
  onUpdateTabContent?: (
    tabId: string,
    content: string,
    isDirty: boolean,
    preserveExplicitDirtyFlag?: boolean
  ) => void;
  onTabDirtyChange?: (tabId: string, isDirty: boolean) => void;
  registerTabDirtyChecker?: (checker: ((tabId: string) => boolean) | null) => void;
  onTabSaved?: (
    tabId: string,
    savedContent: string,
    updatedAt?: string,
    version?: number,
    forceClean?: boolean
  ) => void;
  onTabLoaded?: (tabId: string, content: string, updatedAt?: string, version?: number) => void;
  onCursorChange?: (cursor: CursorPosition) => void;
  onLanguageChange?: (language: string) => void;
  onCollabStatusChange?: (
    status: CollabConnectionStatus,
    isSynced: boolean,
    collaborators: Collaborator[]
  ) => void;
  isReadOnly?: boolean;
  pendingTransition?: {
    action: () => void;
    targetName: string;
  } | null;
  onCancelPendingTransition?: () => void;
  onConfirmPendingTransition?: () => void;
  onRunCode?: (params: {
    sourceCode: string;
    language: SupportedLanguage;
    fileName?: string;
  }) => Promise<ExecutionResult | undefined>;
  isExecuting?: boolean;
}

export const EditorContainer: React.FC<EditorContainerProps> = ({
  workspaceName = "Workspace",
  workspaceId,
  tabs,
  activeTab,
  onUpdateTabContent,
  onTabDirtyChange,
  registerTabDirtyChecker,
  onTabSaved,
  onTabLoaded,
  onCursorChange,
  onLanguageChange,
  onCollabStatusChange,
  isReadOnly = false,
  pendingTransition,
  onCancelPendingTransition,
  onConfirmPendingTransition,
  onRunCode,
  isExecuting = false,
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

  // Authenticated user profile for real-time presence and remote cursors
  const { user: authUser } = useAuth();
  const collabUser = useMemo(() => {
    if (!authUser) return null;
    return {
      id: authUser.id,
      name: authUser.name || "Anonymous",
      color: getUserColor(authUser.id),
      avatarUrl: authUser.avatarUrl,
      email: authUser.email,
    };
  }, [authUser]);

  // Monaco editor instance & shortcut command references
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const [mountedEditor, setMountedEditor] = useState<Monaco.editor.IStandaloneCodeEditor | null>(
    null
  );
  const commandIdRef = useRef<string | null>(null);

  const resolvedTabs = useMemo(() => tabs ?? (activeTab ? [activeTab] : []), [tabs, activeTab]);

  // Forward live collaboration connection status, sync state, and collaborators to parent layout / header
  const onCollabStatusChangeRef = useRef(onCollabStatusChange);
  onCollabStatusChangeRef.current = onCollabStatusChange;

  const collabIsDirtyGetterRef = useRef<((fileId?: string | null) => boolean) | null>(null);
  const autosaveSyncExternalSaveRef = useRef<
    | ((
        fileId: string,
        savedContent: string,
        updatedAt?: string,
        version?: number,
        options?: { markClean?: boolean }
      ) => void)
    | null
  >(null);

  // Real-time collaborative synchronization engine across open tabs (Yjs + Hocuspocus + MonacoBinding)
  const collab = useCollabTabs({
    workspaceId: workspaceId || null,
    tabs: resolvedTabs,
    activeTabId,
    editor: mountedEditor,
    user: collabUser,
    enabled: Boolean(workspaceId && resolvedTabs.length > 0),
    onTabDirtyChange: (fileId, isDirty) => {
      onTabDirtyChange?.(fileId, isDirty);
    },
    onTabSaved: (fileId, savedContent, updatedAt, version) => {
      const isClean = collabIsDirtyGetterRef.current
        ? !collabIsDirtyGetterRef.current(fileId)
        : false;
      autosaveSyncExternalSaveRef.current?.(fileId, savedContent, updatedAt, version, {
        markClean: isClean,
      });
      onTabSaved?.(fileId, savedContent, updatedAt, version, isClean);
    },
    onActiveStateChange: (status, isSynced, collaborators) => {
      onCollabStatusChangeRef.current?.(status, isSynced, collaborators);
    },
  });

  collabIsDirtyGetterRef.current = collab.getIsDirty;

  const isCollabActive = Boolean(
    workspaceId && activeTabId && collab.status === "connected" && collab.isSynced
  );

  const isCollabSyncing = Boolean(
    workspaceId && activeTabId && !collab.isSynced && collab.status !== "error"
  );

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
  autosaveSyncExternalSaveRef.current = autosave.syncExternalSave;

  const activeSaveState = autosave.getFileSaveState(activeTabId);

  // Collaborative save & dirty indicators
  const activeSaveStatus = isCollabActive ? collab.saveStatus : activeSaveState.saveStatus;

  const activeIsDirty = isCollabActive ? collab.isDirty : activeSaveState.isDirty;

  const activeIsSaving = isCollabActive ? collab.isSaving : activeSaveState.isSaving;

  // Register synchronous dirty checker for useIDEState closeTab/file transition guards (active & inactive tabs)
  useEffect(() => {
    registerTabDirtyChecker?.((tabId: string) => {
      const targetTab =
        resolvedTabs.find((t) => t.id === tabId) ?? (tabId === activeTabId ? activeTab : null);

      // 1. In collaborative mode, consult the synchronous CRDT dirty state for this tab
      if (collab.isTabCollabActive(tabId)) {
        if (collab.getIsDirty(tabId)) {
          return true;
        }
      } else {
        // 2. For active or cached Monaco models outside active collaboration, compare against saved baseline
        if (tabId === activeTabId && editorRef.current && targetTab?.savedContent !== undefined) {
          if (editorRef.current.getValue() !== targetTab.savedContent) {
            return true;
          }
        } else if (monacoRef.current && targetTab?.savedContent !== undefined) {
          const cachedModel = monacoRef.current.editor
            .getModels()
            .find((m) => m.uri.toString().startsWith(`file://${tabId}/`));
          if (cachedModel && cachedModel.getValue() !== targetTab.savedContent) {
            return true;
          }
        }
      }

      if (collab.getIsDirty(tabId)) {
        return true;
      }

      if (autosave.isDirty(tabId)) {
        return true;
      }

      return false;
    });

    return () => {
      registerTabDirtyChecker?.(null);
    };
  }, [registerTabDirtyChecker, resolvedTabs, activeTabId, activeTab, collab, autosave]);

  const disposeTabModels = useCallback((fileId: string) => {
    if (!monacoRef.current) return;
    const prefix = `file://${fileId}/`;
    for (const model of monacoRef.current.editor.getModels()) {
      if (model.uri.toString().startsWith(prefix) && !model.isDisposed()) {
        model.dispose();
      }
    }
  }, []);

  // Track closed tabs and evict autosave records + cached Monaco models cleanly
  const prevTabIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentTabIds = new Set(resolvedTabs.map((t) => t.id));
    for (const prevId of prevTabIdsRef.current) {
      if (!currentTabIds.has(prevId)) {
        autosave.removeFile(prevId, { force: true });
        disposeTabModels(prevId);
      }
    }
    prevTabIdsRef.current = currentTabIds;
  }, [resolvedTabs, autosave, disposeTabModels]);

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
        lastHydratedTabIdRef.current = activeTabId;
        setContent(activeTab.content);
        currentContentRef.current = activeTab.content;
        const collabOwnsTab = collab.isTabCollabActive(activeTabId);
        const baselineContent = activeTab.savedContent ?? activeTab.content;
        const markDirty = shouldAutosaveInitMarkDirty(
          collabOwnsTab,
          activeTab.content,
          baselineContent
        );
        // Keep REST autosave clean while collaboration owns activeTabId so tab switching never
        // schedules a competing REST PUT against Hocuspocus persistence.
        autosave.initFile(
          activeTabId,
          markDirty ? activeTab.content : baselineContent,
          baselineContent,
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
        if (isCollabActive) {
          // If local keystroke triggers before MonacoBinding finishes syncing ytext,
          // ytext still holds the prior text so (ytext.toString() !== newVal) captures local dirty immediately,
          // whereas remote Yjs/discard updates mutate ytext first so (ytext.toString() === newVal).
          const ytextDiffersFromModel = collab.ytext !== null && collab.ytext.toString() !== newVal;
          const isDirty = collab.getIsDirty(activeTabId) || ytextDiffersFromModel;
          onUpdateTabContent?.(activeTabId, newVal, isDirty, true);
        } else {
          autosave.handleContentChange(activeTabId, newVal);
          const state = autosave.getFileSaveState(activeTabId);
          onUpdateTabContent?.(activeTabId, newVal, state.isDirty, false);
        }
      }
    },
    [activeTab?.isLoaded, activeTabId, isCollabActive, collab, autosave, onUpdateTabContent]
  );

  // Handle cursor movement inside editor
  const handleCursorChange = useCallback(
    (lineNumber: number, column: number) => {
      onCursorChange?.({ lineNumber, column });
    },
    [onCursorChange]
  );

  // Prevent any residual REST debounce/retry timer from running while Hocuspocus owns the tab
  const pauseLocalAutosave = autosave.pauseAutosave;
  const pauseCollabAutosave = collab.pauseAutosave;
  useEffect(() => {
    if (isCollabActive && activeTabId) {
      pauseLocalAutosave(activeTabId);
    }
  }, [isCollabActive, activeTabId, pauseLocalAutosave]);

  // Manual save trigger (Ctrl+S / Save button) - only allowed once hydrated
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!activeTabId || !activeTab?.isLoaded) return false;
    if (isCollabActive) {
      const saved = await collab.saveDocument(activeTabId);
      if (saved && !collab.getIsDirty(activeTabId)) {
        const cleanContent = collab.ytext?.toString() ?? currentContentRef.current;
        autosave.syncExternalSave(
          activeTabId,
          cleanContent,
          activeTab.updatedAt,
          activeTab.version,
          { markClean: true }
        );
        if (activeTab.isDirty || autosave.isDirty(activeTabId)) {
          onTabSaved?.(activeTabId, cleanContent, activeTab.updatedAt, activeTab.version, true);
        }
      }
      return saved;
    }

    const latestLocalContent = editorRef.current?.getValue() ?? currentContentRef.current;
    const savedBaseline = activeTab.savedContent ?? activeTab.content;
    if (latestLocalContent !== savedBaseline && !autosave.isDirty(activeTabId)) {
      autosave.initFile(
        activeTabId,
        latestLocalContent,
        savedBaseline,
        activeTab.updatedAt,
        activeTab.version
      );
    }
    return autosave.saveImmediately(activeTabId);
  }, [activeTabId, activeTab, isCollabActive, collab, autosave, onTabSaved]);

  // Retry save on network failure
  const handleRetrySave = useCallback(async () => {
    if (!activeTabId || !activeTab?.isLoaded) return;
    await handleSave();
  }, [activeTabId, activeTab?.isLoaded, handleSave]);

  // Code formatting (Shift+Alt+F / Shift+Option+F)
  const handleFormat = useCallback(async () => {
    if (!activeTab || !activeTabId || !activeTab.isLoaded || isFormatting) return;
    setIsFormatting(true);
    setFormatError(null);

    try {
      const codeToFormat = editorRef.current?.getValue() ?? currentContentRef.current;
      const formatted = await fileApi.formatFile(activeTabId, codeToFormat, monacoLanguage);

      if (formatted !== codeToFormat) {
        if (isCollabActive && collab.ytext) {
          collab.ytext.delete(0, collab.ytext.length);
          collab.ytext.insert(0, formatted);
        } else {
          setContent(formatted);
          currentContentRef.current = formatted;
          handleContentChange(formatted);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Formatting failed";
      setFormatError(msg);
      // Auto-clear formatting error after 5 seconds
      setTimeout(() => setFormatError(null), 5000);
    } finally {
      setIsFormatting(false);
    }
  }, [
    activeTab,
    activeTabId,
    isFormatting,
    isCollabActive,
    collab.ytext,
    monacoLanguage,
    handleContentChange,
  ]);

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

  const isExecutingRef = useRef(isExecuting);
  isExecutingRef.current = isExecuting;
  const onRunCodeRef = useRef(onRunCode);
  onRunCodeRef.current = onRunCode;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const monacoLanguageRef = useRef(monacoLanguage);
  monacoLanguageRef.current = monacoLanguage;

  const isExecutable = isExecutableLanguage(monacoLanguage);

  // Clean, unified run handler for both Run button and Ctrl+Enter / Cmd+Enter
  const handleRun = useCallback(async () => {
    const currentTab = activeTabRef.current;
    if (!currentTab) return;

    const lang = monacoLanguageRef.current;
    if (!isExecutableLanguage(lang)) {
      return;
    }

    if (isExecutingRef.current) {
      return;
    }

    // Always retrieve latest content directly from active Monaco model
    const latestContent =
      editorRef.current?.getValue() ?? currentContentRef.current ?? currentTab.content;

    await onRunCodeRef.current?.({
      sourceCode: latestContent,
      language: lang,
      fileName: currentTab.name,
    });
  }, []);

  const handleRunRef = useRef(handleRun);
  handleRunRef.current = handleRun;

  // Editor mount handler: saves ref and registers native Ctrl+Enter / Cmd+Enter command
  const handleEditorMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      setMountedEditor(editor);

      // Bind native Ctrl+Enter / Cmd+Enter command directly inside Monaco editor
      commandIdRef.current = editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        void handleRunRef.current?.();
      });
    },
    []
  );

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
      if (activeIsDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeIsDirty]);

  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isDialogSaving, setIsDialogSaving] = useState<boolean>(false);
  const [isDiscarding, setIsDiscarding] = useState<boolean>(false);
  const pausedDialogTabIdRef = useRef<string | null>(null);

  // Synchronize with external pending transition (closing a dirty tab)
  useEffect(() => {
    if (pendingTransition) {
      setShowUnsavedDialog(true);
      setDialogError(null);
      pendingActionRef.current = pendingTransition.action;
      // Pause background autosave once per dialog cycle while user deliberates
      if (activeTabId && pausedDialogTabIdRef.current !== activeTabId) {
        pausedDialogTabIdRef.current = activeTabId;
        pauseLocalAutosave(activeTabId);
        pauseCollabAutosave(activeTabId);
      }
    } else {
      pausedDialogTabIdRef.current = null;
      setShowUnsavedDialog(false);
      setDialogError(null);
      pendingActionRef.current = null;
    }
  }, [pendingTransition, activeTabId, pauseLocalAutosave, pauseCollabAutosave]);

  // Unsaved changes dialog actions
  const handleDialogSave = async () => {
    setDialogError(null);
    setIsDialogSaving(true);
    try {
      const success = await handleSave();
      if (success) {
        pausedDialogTabIdRef.current = null;
        setShowUnsavedDialog(false);
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        if (activeTabId) {
          autosave.removeFile(activeTabId, { force: false });
          disposeTabModels(activeTabId);
        }
        action?.();
        onConfirmPendingTransition?.();
      } else {
        const errorMsg = isCollabActive
          ? collab.saveError || "Failed to persist changes to database. Please retry or cancel."
          : autosave.getFileSaveState(activeTabId).error ||
            "Failed to save changes. Please try again or cancel.";
        setDialogError(errorMsg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save file";
      setDialogError(msg);
    } finally {
      setIsDialogSaving(false);
    }
  };

  const handleDialogDiscard = async () => {
    setDialogError(null);
    setIsDiscarding(true);

    try {
      if (isCollabActive) {
        // Ensure we never falsely claim edits were discarded if autosave already persisted & acknowledged them
        if (activeTabId && !collab.getIsDirty(activeTabId) && activeTab && !activeTab.isDirty) {
          setDialogError(
            "These changes were already persisted by autosave and cannot be discarded. Click Cancel and close cleanly."
          );
          return;
        }
        const discardOk = await collab.discardLocalChanges(activeTabId);
        if (!discardOk) {
          setDialogError(
            collab.saveError ||
              "Failed to discard collaborative changes. Please try again or cancel."
          );
          return;
        }
      } else if (activeTabId) {
        if (!autosave.isDirty(activeTabId) && activeTab && !activeTab.isDirty) {
          setDialogError(
            "These changes were already persisted by autosave and cannot be discarded. Click Cancel and close cleanly."
          );
          return;
        }
        const success = await autosave.discardChanges(activeTabId);
        if (!success) {
          const errorMsg =
            autosave.getFileSaveState(activeTabId).error ||
            "Failed to discard changes. Please try again or cancel.";
          setDialogError(errorMsg);
          return;
        }
      }

      pausedDialogTabIdRef.current = null;
      setShowUnsavedDialog(false);

      if (!isCollabActive) {
        // Revert to saved content and mark clean for local non-collaborative files
        const baseline = activeTab?.savedContent ?? "";
        setContent(baseline);
        currentContentRef.current = baseline;
        if (activeTabId) {
          onUpdateTabContent?.(activeTabId, baseline, false, true);
          onTabDirtyChange?.(activeTabId, false);
        }
      }

      if (activeTabId) {
        disposeTabModels(activeTabId);
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
    const targetTabId = pausedDialogTabIdRef.current ?? activeTabId;
    pausedDialogTabIdRef.current = null;
    setDialogError(null);
    setShowUnsavedDialog(false);
    pendingActionRef.current = null;
    onCancelPendingTransition?.();

    // Resume only the active persistence engine so REST and Hocuspocus never compete on File.version
    if (targetTabId) {
      if (selectResumeTargetEngine(collab.isTabCollabActive(targetTabId)) === "collab") {
        collab.resumeAutosave(targetTabId);
      } else {
        const targetTab = resolvedTabs.find((t) => t.id === targetTabId) ?? activeTab;
        if (
          targetTab &&
          targetTab.savedContent !== undefined &&
          targetTab.content !== targetTab.savedContent &&
          !autosave.isDirty(targetTabId)
        ) {
          autosave.initFile(
            targetTabId,
            targetTab.content,
            targetTab.savedContent,
            targetTab.updatedAt,
            targetTab.version
          );
        }
        autosave.resumeAutosave(targetTabId);
      }
    }
  };

  if (!activeTab) {
    return <WelcomeScreen />;
  }

  const isEditorLoading = isLoadingContent || isCollabSyncing;
  const editorLoadingMessage = isLoadingContent
    ? "Loading file content..."
    : "Connecting to collaborative workspace...";

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
        saveStatus={activeSaveStatus}
        isDirty={activeIsDirty}
        isSaving={activeIsSaving}
        isFormatting={isFormatting}
        onSave={() => void handleSave()}
        onRetrySave={() => void handleRetrySave()}
        onFormat={() => void handleFormat()}
        onRun={handleRun}
        isExecuting={isExecuting}
        isExecutable={isExecutable}
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
          onEditorMount={handleEditorMount}
          isLoading={isEditorLoading}
          loadingMessage={editorLoadingMessage}
          isCollaborative={isCollabActive}
          readOnly={isReadOnly}
        />
      )}

      {/* 3. Unsaved Changes Confirmation Modal */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        fileName={pendingTransition?.targetName || activeTab.name}
        isSaving={isDialogSaving}
        isDiscarding={isDiscarding}
        errorMessage={dialogError || undefined}
        isCollaborative={isCollabActive}
        activeCollaboratorCount={collab.collaboratorCount}
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
