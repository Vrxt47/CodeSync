"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { fileApi } from "@/lib/fileApi";
import { ApiError } from "@/lib/apiClient";
import type { SaveStatus } from "@/lib/editor/editorTypes";

export interface FileSaveRecord {
  fileId: string;
  currentContent: string;
  savedContent: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  isSaving: boolean;
  retryCount: number;
  errorMessage?: string;
  isInitialized?: boolean;
  lastPersistedUpdatedAt?: string;
  lastPersistedVersion?: number;
}

export interface InFlightSaveResult {
  success: boolean;
  content: string;
  updatedAt?: string;
  version?: number;
  error?: unknown;
}

export interface UseAutosaveProps {
  onFileSaved?: (fileId: string, content: string, updatedAt?: string, version?: number) => void;
  onDirtyChange?: (fileId: string, isDirty: boolean) => void;
}

const DEBOUNCE_DELAY_MS = 1000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

export function useAutosave(props?: UseAutosaveProps) {
  const { onFileSaved, onDirtyChange } = props || {};

  // Store per-file save states
  const recordsRef = useRef<Map<string, FileSaveRecord>>(new Map());

  // Store per-file timers
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const retryTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Store per-file request sequence numbers to prevent stale race conditions
  const saveSeqRef = useRef<Map<string, number>>(new Map());

  // Store active in-flight save promises per file
  const activeSavePromiseRef = useRef<Map<string, Promise<InFlightSaveResult>>>(new Map());

  // Store exact content sent in every active in-flight request
  const inFlightContentRef = useRef<Map<string, string>>(new Map());

  // Store exact request parameters sent in every active in-flight request
  const inFlightRequestRef = useRef<Map<string, { content: string; expectedVersion?: number }>>(
    new Map()
  );

  // Store file IDs actively in the discarding workflow to serialize and suppress regular callbacks
  const discardingFilesRef = useRef<Set<string>>(new Set());

  // Store file IDs scheduled for removal once current in-flight save completes
  const pendingRemovalRef = useRef<Set<string>>(new Set());

  // React state for re-rendering UI when save status changes
  const [fileStatuses, setFileStatuses] = useState<
    Record<string, { status: SaveStatus; isSaving: boolean; isDirty: boolean; error?: string }>
  >({});

  const updateUIStatus = useCallback((fileId: string, rec: FileSaveRecord) => {
    setFileStatuses((prev) => ({
      ...prev,
      [fileId]: {
        status: rec.saveStatus,
        isSaving: rec.isSaving,
        isDirty: rec.isDirty,
        error: rec.errorMessage,
      },
    }));
  }, []);

  /**
   * Initializes or updates baseline content for a file when loaded.
   */
  const initFile = useCallback(
    (
      fileId: string,
      content: string,
      savedContent = content,
      initialUpdatedAt?: string,
      initialVersion?: number
    ) => {
      const existing = recordsRef.current.get(fileId);
      const isDirty = content !== savedContent;
      const rec: FileSaveRecord = {
        fileId,
        currentContent: content,
        savedContent,
        isDirty,
        saveStatus: isDirty ? "unsaved" : "saved",
        isSaving: existing?.isSaving || false,
        retryCount: 0,
        isInitialized: true,
        lastPersistedUpdatedAt: initialUpdatedAt ?? existing?.lastPersistedUpdatedAt,
        lastPersistedVersion: initialVersion ?? existing?.lastPersistedVersion,
      };
      recordsRef.current.set(fileId, rec);
      updateUIStatus(fileId, rec);
    },
    [updateUIStatus]
  );

  /**
   * Cleans up timers and records when a file/tab is closed or deleted.
   * If save is in-flight and not forced, allows in-flight save to complete before removing.
   */
  const removeFile = useCallback((fileId: string, options?: { force?: boolean }) => {
    const debounceTimer = debounceTimersRef.current.get(fileId);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimersRef.current.delete(fileId);
    }
    const retryTimer = retryTimersRef.current.get(fileId);
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimersRef.current.delete(fileId);
    }

    const rec = recordsRef.current.get(fileId);

    // If an in-flight network save is active and force is NOT true,
    // let the in-flight save finish; it will remove upon completion.
    if (rec?.isSaving && !options?.force) {
      pendingRemovalRef.current.add(fileId);
      return;
    }

    recordsRef.current.delete(fileId);
    saveSeqRef.current.delete(fileId);
    pendingRemovalRef.current.delete(fileId);
    activeSavePromiseRef.current.delete(fileId);
    inFlightContentRef.current.delete(fileId);
    inFlightRequestRef.current.delete(fileId);
    discardingFilesRef.current.delete(fileId);

    setFileStatuses((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  }, []);

  /**
   * Forcefully cancels any pending saves and evicts record immediately.
   */
  const cancelSave = useCallback(
    (fileId: string) => {
      removeFile(fileId, { force: true });
    },
    [removeFile]
  );

  /**
   * Pauses autosave debouncing for a file (e.g. while unsaved changes confirmation dialog is open).
   */
  const pauseAutosave = useCallback((fileId: string) => {
    const timer = debounceTimersRef.current.get(fileId);
    if (timer) {
      clearTimeout(timer);
      debounceTimersRef.current.delete(fileId);
    }
  }, []);

  /**
   * Internal execution of file save to backend with sequencing and retry handling.
   */
  const executeSave = useCallback(
    async (fileId: string): Promise<boolean> => {
      // If file is currently in the discard lifecycle, prevent new regular saves
      if (discardingFilesRef.current.has(fileId)) {
        return false;
      }

      const record = recordsRef.current.get(fileId);
      if (!record || !record.isInitialized) return false;

      // Deduplication check: if content is unchanged from last persisted version, do not send API request
      if (record.currentContent === record.savedContent) {
        record.isDirty = false;
        record.saveStatus = "saved";
        record.isSaving = false;
        updateUIStatus(fileId, record);
        onDirtyChange?.(fileId, false);
        return true;
      }

      // Sequence tracking for concurrency & in-flight modification protection
      const currentSeq = (saveSeqRef.current.get(fileId) || 0) + 1;
      saveSeqRef.current.set(fileId, currentSeq);

      const contentToSave = record.currentContent;
      const expectedVersion = record.lastPersistedVersion;

      // Fail closed if expectedVersion is not a valid server revision
      if (typeof expectedVersion !== "number" || expectedVersion < 1) {
        record.saveStatus = "error";
        record.isSaving = false;
        record.isDirty = true;
        record.errorMessage =
          "Cannot save file: server version is unavailable. Please reload the tab.";
        updateUIStatus(fileId, record);
        onDirtyChange?.(fileId, true);
        return false;
      }

      inFlightContentRef.current.set(fileId, contentToSave);
      inFlightRequestRef.current.set(fileId, { content: contentToSave, expectedVersion });
      record.isSaving = true;
      record.saveStatus = "saving";
      record.errorMessage = undefined;
      updateUIStatus(fileId, record);

      // Create and synchronously register the in-flight save promise before any await
      let resolvePromise: (val: InFlightSaveResult) => void;
      const savePromise = new Promise<InFlightSaveResult>((resolve) => {
        resolvePromise = resolve;
      });
      activeSavePromiseRef.current.set(fileId, savePromise);

      try {
        const item = await fileApi.updateFileContent(fileId, contentToSave, expectedVersion);
        const result: InFlightSaveResult = {
          success: true,
          content: contentToSave,
          updatedAt: item.updatedAt,
          version: item.version,
        };
        resolvePromise!(result);

        // Safe cleanup of activeSavePromiseRef: only delete if it still points to this promise
        if (activeSavePromiseRef.current.get(fileId) === savePromise) {
          activeSavePromiseRef.current.delete(fileId);
          inFlightContentRef.current.delete(fileId);
          inFlightRequestRef.current.delete(fileId);
        }

        // If file was marked for discard while save was resolving, suppress all normal updates and callbacks
        if (discardingFilesRef.current.has(fileId)) {
          return true;
        }

        // Verify no newer save request has been initiated in the meantime
        if (saveSeqRef.current.get(fileId) === currentSeq) {
          record.savedContent = contentToSave;
          record.lastPersistedUpdatedAt = item.updatedAt;
          if (item.version !== undefined) {
            record.lastPersistedVersion = item.version;
          }
          record.retryCount = 0;
          record.isSaving = false;

          // Check if user continued typing while save was resolving
          if (record.currentContent === contentToSave) {
            record.isDirty = false;
            record.saveStatus = "saved";
          } else {
            record.isDirty = true;
            record.saveStatus = "unsaved";
            // Only schedule debounced save if not pending removal
            if (!pendingRemovalRef.current.has(fileId)) {
              const timer = setTimeout(() => {
                void executeSave(fileId);
              }, DEBOUNCE_DELAY_MS);
              debounceTimersRef.current.set(fileId, timer);
            }
          }

          updateUIStatus(fileId, record);
          onFileSaved?.(fileId, contentToSave, item.updatedAt, item.version);
          onDirtyChange?.(fileId, record.isDirty);

          // Clean up record if marked for removal once save has finished
          if (pendingRemovalRef.current.has(fileId)) {
            recordsRef.current.delete(fileId);
            saveSeqRef.current.delete(fileId);
            pendingRemovalRef.current.delete(fileId);
            setFileStatuses((prev) => {
              const next = { ...prev };
              delete next[fileId];
              return next;
            });
          }
        }
        return true;
      } catch (err: unknown) {
        const result: InFlightSaveResult = {
          success: false,
          content: contentToSave,
          error: err,
        };
        resolvePromise!(result);

        if (activeSavePromiseRef.current.get(fileId) === savePromise) {
          activeSavePromiseRef.current.delete(fileId);
          inFlightContentRef.current.delete(fileId);
          inFlightRequestRef.current.delete(fileId);
        }

        if (discardingFilesRef.current.has(fileId)) {
          return false;
        }

        if (saveSeqRef.current.get(fileId) === currentSeq) {
          record.isSaving = false;

          // If marked for removal, do not retry; evict immediately
          if (pendingRemovalRef.current.has(fileId)) {
            recordsRef.current.delete(fileId);
            saveSeqRef.current.delete(fileId);
            pendingRemovalRef.current.delete(fileId);
            setFileStatuses((prev) => {
              const next = { ...prev };
              delete next[fileId];
              return next;
            });
            return false;
          }

          // If 409 conflict, do not retry automatically with stale version
          const is409Conflict = err instanceof ApiError && err.statusCode === 409;
          if (is409Conflict) {
            record.saveStatus = "error";
            record.isDirty = true;
            record.errorMessage =
              "Conflict: File has been modified by another user or session. Reload to inspect latest changes.";
            updateUIStatus(fileId, record);
            onDirtyChange?.(fileId, true);
            return false;
          }

          const errorMsg = err instanceof Error ? err.message : "Save failed";
          record.errorMessage = errorMsg;

          // Check if we can retry with exponential backoff
          if (record.retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAYS_MS[record.retryCount] || 4000;
            record.retryCount++;
            record.saveStatus = "saving"; // Display saving during backoff
            updateUIStatus(fileId, record);

            const timer = setTimeout(() => {
              void executeSave(fileId);
            }, delay);
            retryTimersRef.current.set(fileId, timer);
          } else {
            // Retry limit exhausted
            record.saveStatus = "error";
            record.isDirty = true;
            updateUIStatus(fileId, record);
            onDirtyChange?.(fileId, true);
          }
        }
        return false;
      }
    },
    [onDirtyChange, onFileSaved, updateUIStatus]
  );

  /**
   * Resumes autosave debouncing for a file (e.g. after user cancels dialog).
   */
  const resumeAutosave = useCallback(
    (fileId: string) => {
      if (discardingFilesRef.current.has(fileId)) return;
      const rec = recordsRef.current.get(fileId);
      if (!rec || !rec.isInitialized || !rec.isDirty) return;

      const existing = debounceTimersRef.current.get(fileId);
      if (existing) {
        clearTimeout(existing);
        debounceTimersRef.current.delete(fileId);
      }

      const timer = setTimeout(() => {
        void executeSave(fileId);
      }, DEBOUNCE_DELAY_MS);
      debounceTimersRef.current.set(fileId, timer);
    },
    [executeSave]
  );

  /**
   * Safely and atomically discards unsaved changes for a file.
   * If a save is in-flight, awaits it and issues a compensating PUT(baseline)
   * if the server received discarded content, verifying against concurrent edits.
   */
  const discardChanges = useCallback(
    async (fileId: string): Promise<boolean> => {
      // 1. Mark file as actively discarding so callbacks from in-flight saves are suppressed
      discardingFilesRef.current.add(fileId);

      // 2. Immediately stop new debounce and retry scheduling
      pauseAutosave(fileId);
      const retryTimer = retryTimersRef.current.get(fileId);
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimersRef.current.delete(fileId);
      }

      const record = recordsRef.current.get(fileId);
      if (!record || !record.isInitialized) {
        removeFile(fileId, { force: true });
        discardingFilesRef.current.delete(fileId);
        return true;
      }

      // 3. Capture the last successfully persisted baseline
      const baselineContent = record.savedContent;
      let lastKnownUpdatedAt = record.lastPersistedUpdatedAt;
      let lastKnownVersion = record.lastPersistedVersion;

      // 4. Await any already-dispatched save request
      const inFlightPromise = activeSavePromiseRef.current.get(fileId);
      let inFlightResult: InFlightSaveResult | null = null;
      if (inFlightPromise) {
        try {
          inFlightResult = await inFlightPromise;
        } catch {
          inFlightResult = null;
        }
      }

      // 5. Handle ambiguous network failures and determine if backend requires restoration
      let needsCompensatingRestore = false;
      let targetExpectedVersion = inFlightResult?.version ?? lastKnownVersion;
      let targetExpectedUpdatedAt = inFlightResult?.updatedAt ?? lastKnownUpdatedAt;

      if (inFlightResult && inFlightResult.success) {
        // In-flight save succeeded. If saved content differs from baseline, DB now has discarded content!
        if (inFlightResult.content !== baselineContent) {
          needsCompensatingRestore = true;
        }
      } else {
        // Either no in-flight save, or in-flight save failed (ambiguous response).
        // Check current remote state via GET to confirm what PostgreSQL actually has.
        try {
          const remote = await fileApi.getFile(fileId);
          targetExpectedVersion = remote.version ?? targetExpectedVersion;
          targetExpectedUpdatedAt = remote.updatedAt;
          if (remote.content !== baselineContent) {
            // Backend contains different/discarded content. Compensating restore needed!
            needsCompensatingRestore = true;
          }
        } catch (fetchErr: unknown) {
          // If 404, file was deleted; discard succeeds trivially
          if (fetchErr instanceof ApiError && fetchErr.statusCode === 404) {
            removeFile(fileId, { force: true });
            discardingFilesRef.current.delete(fileId);
            return true;
          }
          // If remote check failed (e.g. network down) and an in-flight save was dispatched:
          if (inFlightPromise) {
            needsCompensatingRestore = true;
          }
        }
      }

      // 6 & 7. Restore the baseline if server may contain discarded content, protecting against concurrent modification
      if (needsCompensatingRestore) {
        try {
          const versionToRestore = targetExpectedVersion ?? record.lastPersistedVersion;
          if (typeof versionToRestore !== "number" || versionToRestore < 1) {
            record.errorMessage =
              "Failed to discard changes: Server revision is unknown. Please reload the file.";
            record.saveStatus = "error";
            record.isDirty = true;
            record.isSaving = false;
            updateUIStatus(fileId, record);
            discardingFilesRef.current.delete(fileId);
            return false;
          }
          const restored = await fileApi.updateFileContent(
            fileId,
            baselineContent,
            versionToRestore
          );
          record.lastPersistedUpdatedAt = restored.updatedAt;
          if (restored.version !== undefined) {
            record.lastPersistedVersion = restored.version;
          }
          record.savedContent = baselineContent;
          record.currentContent = baselineContent;
          record.isDirty = false;
        } catch (putErr: unknown) {
          // If file was deleted concurrently (404), discard succeeds
          if (putErr instanceof ApiError && putErr.statusCode === 404) {
            removeFile(fileId, { force: true });
            discardingFilesRef.current.delete(fileId);
            return true;
          }

          let errorMsg =
            "Failed to discard changes: Could not restore file to its previous saved state.";
          if (putErr instanceof ApiError && putErr.statusCode === 409) {
            errorMsg =
              "Conflict: The file has been modified by another user or session. Changes cannot be discarded without overwriting external edits.";
          } else if (putErr instanceof Error) {
            errorMsg = `Failed to discard changes: ${putErr.message}`;
          }

          record.errorMessage = errorMsg;
          record.saveStatus = "error";
          record.isDirty = true;
          record.isSaving = false;
          updateUIStatus(fileId, record);
          // Unmark discarding so user can choose Retry Discard, Save, or Cancel
          discardingFilesRef.current.delete(fileId);
          return false;
        }
      }

      // 8. Successful restoration confirmed: clean up and permit tab close
      removeFile(fileId, { force: true });
      discardingFilesRef.current.delete(fileId);
      return true;
    },
    [pauseAutosave, removeFile, updateUIStatus]
  );

  /**
   * Handler triggered whenever user types or modifies content in a file.
   */
  const handleContentChange = useCallback(
    (fileId: string, newContent: string) => {
      if (discardingFilesRef.current.has(fileId)) return;

      let record = recordsRef.current.get(fileId);
      if (!record || !record.isInitialized) {
        // Prevent autosave or dirty state for uninitialized/unhydrated files
        return;
      }

      record.currentContent = newContent;
      const isDirty = newContent !== record.savedContent;
      record.isDirty = isDirty;
      if (isDirty) {
        record.saveStatus = record.saveStatus === "saving" ? "saving" : "unsaved";
      } else {
        record.saveStatus = "saved";
      }

      onDirtyChange?.(fileId, record.isDirty);
      updateUIStatus(fileId, record);

      // Clear any active debounce timer for this file
      const existingDebounce = debounceTimersRef.current.get(fileId);
      if (existingDebounce) {
        clearTimeout(existingDebounce);
        debounceTimersRef.current.delete(fileId);
      }

      // Clear any pending retry timer when user makes a new edit
      const existingRetry = retryTimersRef.current.get(fileId);
      if (existingRetry) {
        clearTimeout(existingRetry);
        retryTimersRef.current.delete(fileId);
        record.retryCount = 0;
      }

      // Set new 1000ms debounce timer if dirty
      if (record.isDirty) {
        const timer = setTimeout(() => {
          void executeSave(fileId);
        }, DEBOUNCE_DELAY_MS);
        debounceTimersRef.current.set(fileId, timer);
      }
    },
    [executeSave, onDirtyChange, updateUIStatus]
  );

  /**
   * Save immediately, bypassing debounce delay (e.g. on Ctrl+S or manual Save button).
   */
  const saveImmediately = useCallback(
    async (fileId: string): Promise<boolean> => {
      if (discardingFilesRef.current.has(fileId)) return false;

      const rec = recordsRef.current.get(fileId);
      if (!rec || !rec.isInitialized) return false;

      // Clear debounce & retry timers
      const debounceTimer = debounceTimersRef.current.get(fileId);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimersRef.current.delete(fileId);
      }
      const retryTimer = retryTimersRef.current.get(fileId);
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimersRef.current.delete(fileId);
      }

      rec.retryCount = 0;
      return executeSave(fileId);
    },
    [executeSave]
  );

  /**
   * Manual retry action after all automatic retries have failed.
   */
  const retrySave = useCallback(
    async (fileId: string): Promise<boolean> => {
      if (discardingFilesRef.current.has(fileId)) return false;
      return saveImmediately(fileId);
    },
    [saveImmediately]
  );

  /**
   * Flush all dirty files immediately (e.g. before unload or navigation).
   */
  const flushAllPending = useCallback(async (): Promise<void> => {
    const promises: Promise<boolean>[] = [];
    for (const [fileId, rec] of recordsRef.current.entries()) {
      if (rec.isDirty && !discardingFilesRef.current.has(fileId)) {
        promises.push(saveImmediately(fileId));
      }
    }
    await Promise.all(promises);
  }, [saveImmediately]);

  /**
   * Retrieve current save state for a file.
   */
  const getFileSaveState = useCallback(
    (fileId: string | null) => {
      if (!fileId) {
        return {
          saveStatus: "saved" as SaveStatus,
          isSaving: false,
          isDirty: false,
          error: undefined,
        };
      }
      const ui = fileStatuses[fileId];
      if (ui) {
        return {
          saveStatus: ui.status,
          isSaving: ui.isSaving,
          isDirty: ui.isDirty,
          error: ui.error,
        };
      }
      const rec = recordsRef.current.get(fileId);
      return {
        saveStatus: (rec?.saveStatus || "saved") as SaveStatus,
        isSaving: rec?.isSaving || false,
        isDirty: rec?.isDirty || false,
        error: rec?.errorMessage,
      };
    },
    [fileStatuses]
  );

  const isFileInitialized = useCallback((fileId: string | null): boolean => {
    if (!fileId) return false;
    return recordsRef.current.get(fileId)?.isInitialized ?? false;
  }, []);

  // Teardown all active timers on unmount
  useEffect(() => {
    const dTimers = debounceTimersRef.current;
    const rTimers = retryTimersRef.current;
    return () => {
      for (const timer of dTimers.values()) {
        clearTimeout(timer);
      }
      for (const timer of rTimers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  return {
    initFile,
    removeFile,
    cancelSave,
    pauseAutosave,
    resumeAutosave,
    discardChanges,
    handleContentChange,
    saveImmediately,
    retrySave,
    flushAllPending,
    getFileSaveState,
    isFileInitialized,
  };
}
