import * as Y from "yjs";
import crypto from "crypto";
import type { Document } from "@hocuspocus/server";
import { prisma } from "@codesync/database";

export interface DocumentLoadResult {
  restoredFromYjs: boolean;
  seededFromPlainText: boolean;
  contentLength: number;
}

export interface DocumentStoreResult {
  version: number;
  contentLength: number;
  byteSize: number;
  updatedAt: Date;
  stateChecksum: string;
  content?: string;
  aborted?: boolean;
}

export interface StoreDocumentOptions {
  expectedEpoch?: number;
  isBackgroundAutoSave?: boolean;
}

export interface DiscardDocumentResult {
  found: boolean;
  content: string;
  version: number;
  restoredFromDb: boolean;
  stateChecksum: string;
}

/**
 * Loads an existing file's collaborative state from PostgreSQL.
 *
 * Requirements met:
 * 1. Restores authoritative Yjs state if available using Y.applyUpdate.
 * 2. If no Yjs state exists, seeds Y.Text('monaco') using File.content.
 * 3. Handles intentionally empty files correctly without re-seeding races.
 * 4. Uses an explicit `_metadata.initialized` marker to guarantee idempotency.
 */
export async function loadDocumentFromDatabase(
  workspaceId: string,
  fileId: string,
  document: Document
): Promise<DocumentLoadResult> {
  const metadata = document.getMap("_metadata");

  // Prevent duplicate initialization races if document is already initialized
  if (metadata.get("initialized") === true) {
    return {
      restoredFromYjs: false,
      seededFromPlainText: false,
      contentLength: document.getText("monaco").length,
    };
  }

  const file = await prisma.file.findUnique({
    where: {
      workspaceId_id: {
        workspaceId,
        id: fileId,
      },
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      type: true,
      content: true,
      yjsState: true,
      version: true,
    },
  });

  if (!file) {
    throw new Error(
      `Cannot load document: file "${fileId}" not found in workspace "${workspaceId}"`
    );
  }

  if (file.type === "FOLDER") {
    throw new Error(`Cannot load document: item "${file.name}" is a folder`);
  }

  const monacoText = document.getText("monaco");
  let restoredFromYjs = false;
  let seededFromPlainText = false;

  // Case 1: Authoritative Yjs binary state exists in database
  if (file.yjsState && file.yjsState.length > 0) {
    Y.applyUpdate(document, file.yjsState);
    restoredFromYjs = true;
  }
  // Case 2: First-time collaborative opening; seed from existing File.content
  else {
    if (file.content && file.content.length > 0) {
      monacoText.insert(0, file.content);
    }
    seededFromPlainText = true;
  }

  // Record initialization markers
  metadata.set("initialized", true);
  metadata.set("workspaceId", workspaceId);
  metadata.set("fileId", fileId);

  return {
    restoredFromYjs,
    seededFromPlainText,
    contentLength: monacoText.length,
  };
}

// File-level concurrency serialization map:
// Guarantees that concurrent writes and discards for the same document execute in strict serial order
// and cannot race in PostgreSQL or overwrite newer CRDT state or rolled-back state.
const fileSaveQueues = new Map<string, Promise<unknown>>();

// Monotonic per-file epoch counter bumped synchronously on every discard/invalidation.
// Any save queued under an older epoch aborts before modifying PostgreSQL.
const filePersistenceEpochs = new Map<string, number>();

// Per-file autosave pause registry while unsaved-changes confirmation dialogs are open.
const pausedAutoSaveFiles = new Set<string>();
const deferredAutoSaveFiles = new Set<string>();

function getFileKey(workspaceId: string, fileId: string): string {
  return `${workspaceId}:${fileId}`;
}

/**
 * Returns the current persistence epoch for a file.
 */
export function getPersistenceEpoch(workspaceId: string, fileId: string): number {
  return filePersistenceEpochs.get(getFileKey(workspaceId, fileId)) ?? 0;
}

/**
 * Synchronously advances the persistence epoch for a file so previously queued saves abort cleanly.
 */
export function invalidatePersistenceEpoch(workspaceId: string, fileId: string): number {
  const key = getFileKey(workspaceId, fileId);
  const next = (filePersistenceEpochs.get(key) ?? 0) + 1;
  filePersistenceEpochs.set(key, next);
  return next;
}

/**
 * Pauses background autosave persistence while a confirmation modal is awaiting user choice.
 */
export function pauseAutoSave(workspaceId: string, fileId: string): void {
  pausedAutoSaveFiles.add(getFileKey(workspaceId, fileId));
}

/**
 * Resumes background autosave persistence; returns true if a background save was deferred while paused.
 */
export function resumeAutoSave(workspaceId: string, fileId: string): boolean {
  const key = getFileKey(workspaceId, fileId);
  pausedAutoSaveFiles.delete(key);
  const hadDeferred = deferredAutoSaveFiles.has(key);
  deferredAutoSaveFiles.delete(key);
  return hadDeferred;
}

/**
 * Checks whether background autosave is currently paused for a file.
 */
export function isAutoSavePaused(workspaceId: string, fileId: string): boolean {
  return pausedAutoSaveFiles.has(getFileKey(workspaceId, fileId));
}

/**
 * Releases transient per-file pause/epoch tracking once a document leaves memory.
 */
export function clearAutoSaveTracking(workspaceId: string, fileId: string): void {
  const key = getFileKey(workspaceId, fileId);
  pausedAutoSaveFiles.delete(key);
  deferredAutoSaveFiles.delete(key);
  if (!fileSaveQueues.has(key)) {
    filePersistenceEpochs.delete(key);
  }
}

/**
 * Returns whether a save operation is currently queued or in-flight for a document.
 */
export function isSaveInFlight(workspaceId: string, fileId: string): boolean {
  return fileSaveQueues.has(getFileKey(workspaceId, fileId));
}

/**
 * Persists active collaborative Yjs document state to PostgreSQL.
 *
 * Requirements met:
 * 1. Encodes binary CRDT state using Y.encodeStateAsUpdate.
 * 2. Extracts plain-text representation from Y.Text('monaco') for REST API compatibility.
 * 3. Atomically updates yjs_state, content, version, and updatedAt in PostgreSQL.
 * 4. Serializes concurrent writes per file to prevent stale overwrites or database races.
 * 5. Aborts without modifying PostgreSQL if superseded by a discard epoch or paused during confirmation.
 */
export async function storeDocumentToDatabase(
  workspaceId: string,
  fileId: string,
  document: Document,
  options?: StoreDocumentOptions
): Promise<DocumentStoreResult> {
  const fileKey = getFileKey(workspaceId, fileId);
  // Capture epoch synchronously at schedule/invocation time so any intervening discard invalidates it
  const capturedEpoch = options?.expectedEpoch ?? filePersistenceEpochs.get(fileKey) ?? 0;
  const previousSave = fileSaveQueues.get(fileKey) ?? Promise.resolve();

  const currentSave = previousSave
    .catch(() => {
      // Ignore errors from earlier operations so subsequent operations can still proceed
    })
    .then(async (): Promise<DocumentStoreResult> => {
      // Abort if invalidated by an intervening discard before database write begins
      if (capturedEpoch !== (filePersistenceEpochs.get(fileKey) ?? 0)) {
        return {
          version: 0,
          contentLength: 0,
          byteSize: 0,
          updatedAt: new Date(),
          stateChecksum: "",
          aborted: true,
        };
      }

      // Skip background autosave if confirmation dialog paused persistence
      if (options?.isBackgroundAutoSave && pausedAutoSaveFiles.has(fileKey)) {
        deferredAutoSaveFiles.add(fileKey);
        return {
          version: 0,
          contentLength: 0,
          byteSize: 0,
          updatedAt: new Date(),
          stateChecksum: "",
          aborted: true,
        };
      }

      const monacoText = document.getText("monaco");
      const content = monacoText.toString();
      const encodedUpdate = Y.encodeStateAsUpdate(document);
      const binaryBuffer = Buffer.from(encodedUpdate);
      const stateChecksum = crypto.createHash("sha256").update(binaryBuffer).digest("hex");

      const updatedFile = await prisma.file.update({
        where: {
          workspaceId_id: {
            workspaceId,
            id: fileId,
          },
        },
        data: {
          yjsState: binaryBuffer,
          content,
          version: { increment: 1 },
        },
        select: {
          id: true,
          version: true,
          updatedAt: true,
        },
      });

      return {
        version: updatedFile.version,
        contentLength: content.length,
        byteSize: binaryBuffer.length,
        updatedAt: updatedFile.updatedAt,
        stateChecksum,
        content,
      };
    })
    .finally(() => {
      if (fileSaveQueues.get(fileKey) === currentSave) {
        fileSaveQueues.delete(fileKey);
      }
    });

  fileSaveQueues.set(fileKey, currentSave);
  return currentSave as Promise<DocumentStoreResult>;
}

/**
 * Coordinates single-user discard with the per-file persistence queue.
 *
 * 1. Synchronously bumps the persistence epoch so any queued/debounced saves from before discard abort.
 * 2. Awaits any already-executing PostgreSQL statement for this file before reading the baseline.
 * 3. Reverts the in-memory Y.Text('monaco') using a system transaction (origin null) so Hocuspocus
 *    does not reschedule autosave for the rollback itself.
 * 4. Repairs PostgreSQL yjsState if it drifted from authoritative File.content.
 */
export async function discardDocumentInQueue(
  workspaceId: string,
  fileId: string,
  document: Document
): Promise<DiscardDocumentResult> {
  const fileKey = getFileKey(workspaceId, fileId);

  // Synchronously invalidate all older queued/scheduled persistence operations
  invalidatePersistenceEpoch(workspaceId, fileId);
  pausedAutoSaveFiles.delete(fileKey);
  deferredAutoSaveFiles.delete(fileKey);

  const previousOp = fileSaveQueues.get(fileKey) ?? Promise.resolve();

  const currentDiscard = previousOp
    .catch(() => {
      // Proceed even if an earlier save threw so discard still restores consistent state
    })
    .then(async (): Promise<DiscardDocumentResult> => {
      const file = await prisma.file.findUnique({
        where: {
          workspaceId_id: {
            workspaceId,
            id: fileId,
          },
        },
        select: {
          id: true,
          content: true,
          yjsState: true,
          version: true,
        },
      });

      if (!file) {
        return {
          found: false,
          content: "",
          version: 0,
          restoredFromDb: false,
          stateChecksum: "",
        };
      }

      const persistedContent = file.content ?? "";

      // Revert in-memory Y.Text('monaco') cleanly without connection origin
      document.transact(() => {
        const ytext = document.getText("monaco");
        const currentText = ytext.toString();
        if (currentText !== persistedContent) {
          ytext.delete(0, ytext.length);
          if (persistedContent.length > 0) {
            ytext.insert(0, persistedContent);
          }
        }
      });

      const encodedBaseline = Y.encodeStateAsUpdate(document);
      const baselineBuffer = Buffer.from(encodedBaseline);
      const stateChecksum = crypto.createHash("sha256").update(baselineBuffer).digest("hex");

      // Keep binary yjsState consistent with authoritative File.content if out of sync
      if (file.yjsState && file.yjsState.length > 0) {
        const verifyDoc = new Y.Doc();
        try {
          Y.applyUpdate(verifyDoc, file.yjsState);
          const storedYjsText = verifyDoc.getText("monaco").toString();
          if (storedYjsText !== persistedContent) {
            await prisma.file.update({
              where: {
                workspaceId_id: {
                  workspaceId,
                  id: fileId,
                },
              },
              data: {
                yjsState: baselineBuffer,
              },
            });
          }
        } finally {
          verifyDoc.destroy();
        }
      }

      return {
        found: true,
        content: persistedContent,
        version: file.version,
        restoredFromDb: true,
        stateChecksum,
      };
    })
    .finally(() => {
      if (fileSaveQueues.get(fileKey) === currentDiscard) {
        fileSaveQueues.delete(fileKey);
      }
    });

  fileSaveQueues.set(fileKey, currentDiscard);
  return currentDiscard as Promise<DiscardDocumentResult>;
}
