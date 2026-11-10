"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { fileApi } from "@/lib/fileApi";
import { ApiError } from "@/lib/apiClient";
import type { SaveStatus } from "@/lib/editor/editorTypes";
import { classifyHttpConflict } from "@/lib/editor/save-reconciliation";

export interface FileSaveRecord {
  fileId: string;
  currentContent: string;
  savedContent: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  isSaving: boolean;
  retryCount: number;
  errorMessage?: string;
  conflictBlocked?: boolean;
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
      const isSaving = existing?.isSaving || false;
      const resolvedVersion =
        existing?.lastPersistedVersion !== undefined && initialVersion !== undefined
          ? Math.max(existing.lastPersistedVersion, initialVersion)
          : (initialVersion ?? existing?.lastPersistedVersion);

      const rec: FileSaveRecord = {
        fileId,
        currentContent: content,
        savedContent,
        isDirty,
        saveStatus: isSaving
          ? "saving"
          : isDirty
            ? existing?.conflictBlocked
              ? "error"
              : "unsaved"
            : "saved",
        isSaving,
        retryCount: isDirty && existing?.isInitialized ? existing.retryCount : 0,
        errorMessage: isDirty && existing?.isInitialized ? existing.errorMessage : undefined,
        conflictBlocked: isDirty ? existing?.conflictBlocked : false,
        isInitialized: true,
        lastPersistedUpdatedAt: initialUpdatedAt ?? existing?.lastPersistedUpdatedAt,
        lastPersistedVersion: resolvedVersion,
      };
      recordsRef.current.set(fileId, rec);
      updateUIStatus(fileId, rec);
    },
    [updateUIStatus]
  );

  /**
   * Synchronizes external persistence acknowledgments (e.g., Hocuspocus collaboration saves)
   * into the REST autosave baseline so File.version and savedContent never drift apart.
   */
  const syncExternalSave = useCallback(
    (
      fileId: string,
      savedContent: string,
      updatedAt?: string,
      version?: number,
      options?: { markClean?: boolean }
    ) => {
      if (discardingFilesRef.current.has(fileId)) return;

      const markClean = options?.markClean ?? false;
      const existing = recordsRef.current.get(fileId);

      if (markClean) {
        const dTimer = debounceTimersRef.current.get(fileId);
        if (dTimer) {
          clearTimeout(dTimer);
          debounceTimersRef.current.delete(fileId);
        }
        const rTimer = retryTimersRef.current.get(fileId);
        if (rTimer) {
          clearTimeout(rTimer);
          retryTimersRef.current.delete(fileId);
        }
      }

      const resolvedVersion =
        existing?.lastPersistedVersion !== undefined && version !== undefined
          ? Math.max(existing.lastPersistedVersion, version)
          : (version ?? existing?.lastPersistedVersion);

      if (!existing) {
        if (!markClean) {
          return;
        }
        const rec: FileSaveRecord = {
          fileId,
          currentContent: savedContent,
          savedContent,
          isDirty: false,
          saveStatus: "saved",
          isSaving: false,
          retryCount: 0,
          errorMessage: undefined,
          conflictBlocked: false,
          isInitialized: true,
          lastPersistedUpdatedAt: updatedAt,
          lastPersistedVersion: resolvedVersion,
        };
        recordsRef.current.set(fileId, rec);
        updateUIStatus(fileId, rec);
        return;
      }

      existing.savedContent = savedContent;
      if (updatedAt !== undefined) {
        existing.lastPersistedUpdatedAt = updatedAt;
      }
      if (resolvedVersion !== undefined) {
        existing.lastPersistedVersion = resolvedVersion;
      }
      existing.conflictBlocked = false;

      if (markClean && !existing.isSaving) {
        existing.currentContent = savedContent;
        existing.isDirty = false;
        existing.saveStatus = "saved";
        existing.retryCount = 0;
        existing.errorMessage = undefined;
        updateUIStatus(fileId, existing);
        onDirtyChange?.(fileId, false);
      }
    },
    [onDirtyChange, updateUIStatus]
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
    const retryTimer = retryTimersRef.current.get(fileId);
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimersRef.current.delete(fileId);
    }
  }, []);

  /**
   * Internal execution of file save to backend with sequencing, conflict reconciliation, and retry handling.
   */
  const executeSave = useCallback(
    async (fileId: string): Promise<boolean> => {
      // If file is currently in the discard lifecycle, prevent new regular saves
      if (discardingFilesRef.current.has(fileId)) {
        return false;
      }

      // Sequence tracking for concurrency & in-flight modification protection
      const currentSeq = (saveSeqRef.current.get(fileId) || 0) + 1;
      saveSeqRef.current.set(fileId, currentSeq);

      // Serialize per-file writes so a subsequent PUT never reads a stale pre-ack File.version
      const existingInFlight = activeSavePromiseRef.current.get(fileId);
      if (existingInFlight) {
        try {
          await existingInFlight;
        } catch {
          // Handled via updated record state below
        }
        if (discardingFilesRef.current.has(fileId)) {
          return false;
        }
        if (saveSeqRef.current.get(fileId) !== currentSeq) {
          const latest = activeSavePromiseRef.current.get(fileId);
          if (latest) {
            const latestRes = await latest;
            return latestRes.success;
          }
          return false;
        }
      }

      const record = recordsRef.current.get(fileId);
      if (!record || !record.isInitialized) return false;

      // Deduplication check: if content is unchanged from last persisted version, do not send API request
      if (record.currentContent === record.savedContent) {
        record.isDirty = false;
        record.saveStatus = "saved";
        record.isSaving = false;
        record.errorMessage = undefined;
        record.conflictBlocked = false;
        updateUIStatus(fileId, record);
        onDirtyChange?.(fileId, false);
        return true;
      }

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

      record.isSaving = true;
      record.saveStatus = "saving";
      record.errorMessage = undefined;
      updateUIStatus(fileId, record);

      const runPutAttempt = async (
        contentToSave: string,
        versionToSend: number
      ): Promise<InFlightSaveResult> => {
        inFlightContentRef.current.set(fileId, contentToSave);
        inFlightRequestRef.current.set(fileId, {
          content: contentToSave,
          expectedVersion: versionToSend,
        });

        let resolvePromise!: (val: InFlightSaveResult) => void;
        const savePromise = new Promise<InFlightSaveResult>((resolve) => {
          resolvePromise = resolve;
        });
        activeSavePromiseRef.current.set(fileId, savePromise);

        try {
          const item = await fileApi.updateFileContent(fileId, contentToSave, versionToSend);
          const result: InFlightSaveResult = {
            success: true,
            content: contentToSave,
            updatedAt: item.updatedAt,
            version: item.version,
          };
          resolvePromise(result);
          return result;
        } catch (err: unknown) {
          const result: InFlightSaveResult = {
            success: false,
            content: contentToSave,
            error: err,
          };
          resolvePromise(result);
          return result;
        } finally {
          if (activeSavePromiseRef.current.get(fileId) === savePromise) {
            activeSavePromiseRef.current.delete(fileId);
            inFlightContentRef.current.delete(fileId);
            inFlightRequestRef.current.delete(fileId);
          }
        }
      };

      const applySuccessfulPersist = (
        persistedContent: string,
        updatedAt?: string,
        version?: number
      ): boolean => {
        if (discardingFilesRef.current.has(fileId)) {
          return true;
        }

        if (version !== undefined) {
          record.lastPersistedVersion = Math.max(record.lastPersistedVersion ?? 0, version);
        }
        if (updatedAt !== undefined) {
          record.lastPersistedUpdatedAt = updatedAt;
        }
        record.savedContent = persistedContent;
        record.conflictBlocked = false;

        if (saveSeqRef.current.get(fileId) !== currentSeq) {
          return true;
        }

        record.retryCount = 0;
        record.isSaving = false;
        record.errorMessage = undefined;

        if (record.currentContent === persistedContent) {
          record.isDirty = false;
          record.saveStatus = "saved";
        } else {
          record.isDirty = true;
          record.saveStatus = "unsaved";
          if (!pendingRemovalRef.current.has(fileId)) {
            const existingTimer = debounceTimersRef.current.get(fileId);
            if (existingTimer) clearTimeout(existingTimer);
            const timer = setTimeout(() => {
              void executeSave(fileId);
            }, DEBOUNCE_DELAY_MS);
            debounceTimersRef.current.set(fileId, timer);
          }
        }

        updateUIStatus(fileId, record);
        onFileSaved?.(fileId, persistedContent, updatedAt, version);
        onDirtyChange?.(fileId, record.isDirty);

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
        return true;
      };

      const contentToSave = record.currentContent;
      const firstResult = await runPutAttempt(contentToSave, expectedVersion);

      if (firstResult.success) {
        return applySuccessfulPersist(
          firstResult.content,
          firstResult.updatedAt,
          firstResult.version
        );
      }

      if (discardingFilesRef.current.has(fileId)) {
        return false;
      }

      if (saveSeqRef.current.get(fileId) !== currentSeq) {
        return false;
      }

      if (pendingRemovalRef.current.has(fileId)) {
        record.isSaving = false;
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

      const err = firstResult.error;
      const is409Conflict = err instanceof ApiError && err.statusCode === 409;

      if (is409Conflict) {
        // Fetch authoritative remote state once to classify benign version drift vs external content edit
        try {
          const remote = await fileApi.getFile(fileId);
          if (discardingFilesRef.current.has(fileId) || pendingRemovalRef.current.has(fileId)) {
            return false;
          }

          const remoteContent = remote.content ?? "";
          const resolution = classifyHttpConflict({
            currentContent: record.currentContent,
            attemptedContent: contentToSave,
            savedBaselineContent: record.savedContent,
            remoteContent,
          });

          // Case 1: PostgreSQL already contains our exact current buffer (e.g. Hocuspocus saved it)
          if (resolution === "already_persisted") {
            return applySuccessfulPersist(remoteContent, remote.updatedAt, remote.version);
          }

          // Case 2: No external content divergence (DB still matches our baseline or intermediate
          // save attempt) — safe to refresh version once and save our latest buffer at most once.
          if (resolution === "safe_version_drift" && typeof remote.version === "number") {
            record.savedContent = remoteContent;
            record.lastPersistedVersion = remote.version;
            record.lastPersistedUpdatedAt = remote.updatedAt ?? record.lastPersistedUpdatedAt;

            if (saveSeqRef.current.get(fileId) !== currentSeq) {
              return false;
            }

            const reconciledContent = record.currentContent;
            const reconciledResult = await runPutAttempt(reconciledContent, remote.version);
            if (reconciledResult.success) {
              return applySuccessfulPersist(
                reconciledResult.content,
                reconciledResult.updatedAt,
                reconciledResult.version
              );
            }

            if (discardingFilesRef.current.has(fileId)) {
              return false;
            }
          }

          // Case 3: Genuine concurrent content edit by another user/session — preserve local edits cleanly
          record.isSaving = false;
          record.saveStatus = "error";
          record.isDirty = true;
          record.conflictBlocked = true;
          record.errorMessage = `Conflict: File has been modified by another user or session (server version ${remote.version}). Reload to inspect latest changes.`;
          updateUIStatus(fileId, record);
          onDirtyChange?.(fileId, true);
          return false;
        } catch {
          record.isSaving = false;
          record.saveStatus = "error";
          record.isDirty = true;
          record.conflictBlocked = true;
          record.errorMessage =
            "Conflict: File has been modified by another user or session. Reload to inspect latest changes.";
          updateUIStatus(fileId, record);
          onDirtyChange?.(fileId, true);
          return false;
        }
      }

      record.isSaving = false;
      const errorMsg = err instanceof Error ? err.message : "Save failed";
      record.errorMessage = errorMsg;

      // Check if we can retry transient non-409 failures with exponential backoff
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

      return false;
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
      if (!rec || !rec.isInitialized || !rec.isDirty || rec.conflictBlocked) return;

      const existing = debounceTimersRef.current.get(fileId);
      if (existing) {
        clearTimeout(existing);
        debounceTimersRef.current.delete(fileId);
      }

      rec.retryCount = 0;
      rec.errorMessage = undefined;
      if (rec.saveStatus === "error") {
        rec.saveStatus = "unsaved";
        updateUIStatus(fileId, rec);
      }

      const timer = setTimeout(() => {
        void executeSave(fileId);
      }, DEBOUNCE_DELAY_MS);
      debounceTimersRef.current.set(fileId, timer);
    },
    [executeSave, updateUIStatus]
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
      if (!isDirty) {
        record.conflictBlocked = false;
        record.errorMessage = undefined;
        record.saveStatus = "saved";
      } else if (record.saveStatus === "saving") {
        record.saveStatus = "saving";
      } else if (record.conflictBlocked) {
        record.saveStatus = "error";
      } else {
        record.saveStatus = "unsaved";
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

      // Set new 1000ms debounce timer if dirty and not blocked by external conflict
      if (record.isDirty && !record.conflictBlocked) {
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

  const isFileDirty = useCallback(
    (fileId: string | null): boolean => {
      if (!fileId) return false;
      const rec = recordsRef.current.get(fileId);
      if (rec?.isDirty) return true;
      const ui = fileStatuses[fileId];
      return ui?.isDirty || false;
    },
    [fileStatuses]
  );

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
    syncExternalSave,
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
    isDirty: isFileDirty,
  };
}
