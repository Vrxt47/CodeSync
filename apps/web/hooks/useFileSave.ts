"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { fileApi } from "@/lib/fileApi";
import type { SaveStatus } from "@/lib/editor/editorTypes";

export interface UseFileSaveOptions {
  fileId: string | null;
  getCurrentContent: () => string;
  getVersion: () => number;
  onSaveSuccess?: (savedContent: string, newVersion?: number) => void;
  onSaveError?: (error: Error) => void;
}

export interface UseFileSaveResult {
  saveStatus: SaveStatus;
  isSaving: boolean;
  saveError: string | null;
  save: () => Promise<boolean>;
  setSaveStatus: (status: SaveStatus) => void;
}

/**
 * Handles manual save operations with concurrency protection.
 * If the user types while a save request is in flight, the new content remains
 * correctly marked as unsaved when the older save request resolves.
 */
export function useFileSave({
  fileId,
  getCurrentContent,
  getVersion,
  onSaveSuccess,
  onSaveError,
}: UseFileSaveOptions): UseFileSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  const isSavingRef = useRef<boolean>(false);
  const saveSeqRef = useRef<number>(0);

  const save = useCallback(async (): Promise<boolean> => {
    if (!fileId) return false;
    if (isSavingRef.current) return false; // Prevent concurrent duplicate saves for same file

    const contentToSave = getCurrentContent();
    const seq = ++saveSeqRef.current;

    isSavingRef.current = true;
    setSaveStatus("saving");
    setSaveError(null);

    try {
      const version = getVersion();
      if (typeof version !== "number" || version < 1) {
        throw new Error("Cannot save file: server version is unavailable. Please reload the tab.");
      }
      const item = await fileApi.updateFileContent(fileId, contentToSave, version);

      // Verify this save request is still the latest one
      if (seq === saveSeqRef.current) {
        onSaveSuccess?.(contentToSave, item.version);

        // Check whether the user typed more changes while save was in-flight
        const latestContent = getCurrentContent();
        if (latestContent === contentToSave) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("unsaved");
        }
      }
      return true;
    } catch (err: unknown) {
      if (seq === saveSeqRef.current) {
        const error = err instanceof Error ? err : new Error("Failed to save file");
        setSaveError(error.message);
        setSaveStatus("error");
        onSaveError?.(error);
      }
      return false;
    } finally {
      if (seq === saveSeqRef.current) {
        isSavingRef.current = false;
      }
    }
  }, [fileId, getCurrentContent, getVersion, onSaveSuccess, onSaveError]);

  // Global Ctrl+S / Cmd+S shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (fileId) {
          void save();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fileId, save]);

  return {
    saveStatus,
    isSaving: saveStatus === "saving",
    saveError,
    save,
    setSaveStatus,
  };
}
