"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  EditorTheme,
  SaveStatus,
  CursorPosition,
  SupportedMonacoLanguage,
} from "@/lib/editor/editorTypes";
import { getMonacoLanguage, getLanguageDisplayName } from "@/lib/editor/languageUtils";
import { getStoredTheme, setStoredTheme } from "@/lib/editor/editorConfig";
import { useFileContent } from "./useFileContent";
import { useFileSave } from "./useFileSave";

export interface UseEditorStateProps {
  onDirtyChange?: (fileId: string, isDirty: boolean) => void;
  onContentSaved?: (fileId: string, content: string) => void;
}

export function useEditorState(props?: UseEditorStateProps) {
  const { onDirtyChange, onContentSaved } = props || {};

  // Active file identity
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string>("");
  const [activeFilePath, setActiveFilePath] = useState<string>("");

  // Editor content & dirty tracking
  const [currentContent, setCurrentContent] = useState<string>("");
  const [savedContent, setSavedContent] = useState<string>("");
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Theme & cursor position
  const [theme, setThemeState] = useState<EditorTheme>(() => getStoredTheme());
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({
    lineNumber: 1,
    column: 1,
  });

  // Track latest content via ref for safe access inside callbacks/save
  const currentContentRef = useRef<string>("");
  currentContentRef.current = currentContent;

  const savedContentRef = useRef<string>("");
  savedContentRef.current = savedContent;

  // Language computation
  const monacoLanguage: SupportedMonacoLanguage = getMonacoLanguage(activeFileName);
  const languageDisplayName = getLanguageDisplayName(monacoLanguage);

  // File loading hook
  const {
    isLoading: isLoadingFile,
    error: loadError,
    loadFile,
    reset: resetFileContent,
  } = useFileContent();

  // File saving hook
  const {
    saveStatus,
    isSaving,
    saveError,
    save: triggerSave,
    setSaveStatus,
  } = useFileSave({
    fileId: activeFileId,
    getCurrentContent: () => currentContentRef.current,
    onSaveSuccess: (persistedContent) => {
      setSavedContent(persistedContent);
      savedContentRef.current = persistedContent;

      const stillDirty = currentContentRef.current !== persistedContent;
      setIsDirty(stillDirty);
      if (activeFileId) {
        onDirtyChange?.(activeFileId, stillDirty);
        onContentSaved?.(activeFileId, persistedContent);
      }
    },
  });

  // Theme switching with persistent storage
  const setTheme = useCallback((newTheme: EditorTheme) => {
    setThemeState(newTheme);
    setStoredTheme(newTheme);
  }, []);

  // Update editor content and dirty status
  const handleContentChange = useCallback(
    (newContent: string) => {
      setCurrentContent(newContent);
      currentContentRef.current = newContent;

      const dirty = newContent !== savedContentRef.current;
      setIsDirty(dirty);
      setSaveStatus(dirty ? "unsaved" : "saved");

      if (activeFileId) {
        onDirtyChange?.(activeFileId, dirty);
      }
    },
    [activeFileId, onDirtyChange, setSaveStatus]
  );

  // Cursor position listener
  const handleCursorChange = useCallback((lineNumber: number, column: number) => {
    setCursorPosition({ lineNumber, column });
  }, []);

  // Discard changes and revert to last saved content
  const discardChanges = useCallback(() => {
    const original = savedContentRef.current;
    setCurrentContent(original);
    currentContentRef.current = original;
    setIsDirty(false);
    setSaveStatus("saved");
    if (activeFileId) {
      onDirtyChange?.(activeFileId, false);
    }
  }, [activeFileId, onDirtyChange, setSaveStatus]);

  // Open a file into the editor
  const openFile = useCallback(
    async (fileId: string, fileName: string, filePath: string) => {
      setActiveFileId(fileId);
      setActiveFileName(fileName);
      setActiveFilePath(filePath);
      setCursorPosition({ lineNumber: 1, column: 1 });

      const loaded = await loadFile(fileId);
      if (loaded !== null) {
        setCurrentContent(loaded);
        setSavedContent(loaded);
        currentContentRef.current = loaded;
        savedContentRef.current = loaded;
        setIsDirty(false);
        setSaveStatus("saved");
        onDirtyChange?.(fileId, false);
      }
    },
    [loadFile, onDirtyChange, setSaveStatus]
  );

  // Close active file
  const closeActiveFile = useCallback(() => {
    resetFileContent();
    setActiveFileId(null);
    setActiveFileName("");
    setActiveFilePath("");
    setCurrentContent("");
    setSavedContent("");
    currentContentRef.current = "";
    savedContentRef.current = "";
    setIsDirty(false);
    setSaveStatus("saved");
  }, [resetFileContent, setSaveStatus]);

  // Browser beforeunload handler when unsaved modifications exist
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

  return {
    activeFileId,
    activeFileName,
    activeFilePath,
    monacoLanguage,
    languageDisplayName,
    currentContent,
    savedContent,
    isDirty,
    saveStatus,
    isSaving,
    saveError,
    isLoadingFile,
    loadError,
    cursorPosition,
    theme,
    setTheme,
    openFile,
    closeActiveFile,
    handleContentChange,
    handleCursorChange,
    saveCurrentFile: triggerSave,
    discardChanges,
  };
}
