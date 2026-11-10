"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";
import type * as Monaco from "monaco-editor";
import { getAccessToken } from "@/lib/apiClient";
import type { EditorTab } from "@/types/ide";
import {
  computeYDocChecksum,
  createOwnedMonacoBinding,
  getCollabDocumentName,
  getUserColor,
  isValidCursorColor,
  removeCursorStyles,
  sanitizeCollaboratorName,
  updateCursorStyles,
  type CollabConnectionStatus,
  type CollabSaveStatus,
  type CollabUser,
  type Collaborator,
  type OwnedMonacoBinding,
} from "./useCollab";

interface InFlightSaveEntry {
  editCount: number;
  resolve: (success: boolean) => void;
  timer: NodeJS.Timeout | null;
}

interface TabCollabSession {
  fileId: string;
  documentName: string;
  ydoc: Y.Doc;
  ytext: Y.Text;
  provider: HocuspocusProvider;
  status: CollabConnectionStatus;
  isSynced: boolean;
  saveStatus: CollabSaveStatus;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  hasUnsyncedChanges: boolean;
  collaboratorCount: number;
  collaborators: Collaborator[];
  localUser: Collaborator | null;
  error: Error | null;
  localEditCount: number;
  lastSerializedCollaborators: string;
  inFlightSaves: Map<string, InFlightSaveEntry>;
  pendingDiscardResolvers: Map<string, (success: boolean) => void>;
  isDestroyed: boolean;
  destroy: () => void;
}

export interface UseCollabTabsOptions {
  workspaceId?: string | null;
  tabs: EditorTab[];
  activeTabId: string | null;
  editor?: Monaco.editor.IStandaloneCodeEditor | null;
  user?: CollabUser | null;
  enabled?: boolean;
  collabUrl?: string;
  token?: string | null | (() => string | null | Promise<string | null>);
  onTabDirtyChange?: (fileId: string, isDirty: boolean) => void;
  onTabSaved?: (fileId: string, savedContent: string, updatedAt?: string, version?: number) => void;
  onActiveStateChange?: (
    status: CollabConnectionStatus,
    isSynced: boolean,
    collaborators: Collaborator[]
  ) => void;
  onError?: (error: Error) => void;
}

export interface UseCollabTabsResult {
  status: CollabConnectionStatus;
  isSynced: boolean;
  saveStatus: CollabSaveStatus;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  hasUnsyncedChanges: boolean;
  collaboratorCount: number;
  collaborators: Collaborator[];
  localUser: Collaborator | null;
  ytext: Y.Text | null;
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  error: Error | null;
  getIsDirty: (fileId?: string | null) => boolean;
  isTabCollabActive: (fileId?: string | null) => boolean;
  pauseAutosave: (fileId: string) => void;
  resumeAutosave: (fileId: string) => void;
  saveDocument: (fileId?: string | null) => Promise<boolean>;
  discardLocalChanges: (fileId?: string | null) => Promise<boolean>;
  forceSync: () => void;
  reconnect: () => void;
  disconnect: () => void;
}

/**
 * Checks whether a Monaco model belongs to a given tab/file ID.
 */
function modelMatchesFileId(
  model: Monaco.editor.ITextModel | null | undefined,
  fileId: string
): boolean {
  if (!model) return false;
  return model.uri.toString().startsWith(`file://${fileId}/`);
}

/**
 * Manages persistent collaborative Yjs + HocuspocusProvider sessions for every open editor tab.
 *
 * Key architectural guarantees:
 * 1. Switching active tabs keeps background open tabs' providers alive so tab switching never
 *    forces disconnect persistence or wipes unpersisted edits.
 * 2. Providers are destroyed only when a tab is closed cleanly or the workspace unmounts.
 * 3. MonacoBinding attaches exclusively to the active tab's verified Monaco model URI.
 * 4. Background autosave acknowledgments route strictly by fileId rather than current activeTabId.
 */
export function useCollabTabs(options: UseCollabTabsOptions): UseCollabTabsResult {
  const {
    workspaceId,
    tabs,
    activeTabId,
    editor,
    user,
    enabled = true,
    collabUrl,
    token,
    onTabDirtyChange,
    onTabSaved,
    onActiveStateChange,
    onError,
  } = options;

  const sessionsRef = useRef<Map<string, TabCollabSession>>(new Map());
  const ownedBindingRef = useRef<OwnedMonacoBinding | null>(null);
  const [, setRenderTick] = useState<number>(0);

  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const userRef = useRef(user);
  userRef.current = user;

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const onTabDirtyChangeRef = useRef(onTabDirtyChange);
  onTabDirtyChangeRef.current = onTabDirtyChange;

  const onTabSavedRef = useRef(onTabSaved);
  onTabSavedRef.current = onTabSaved;

  const onActiveStateChangeRef = useRef(onActiveStateChange);
  onActiveStateChangeRef.current = onActiveStateChange;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const triggerActiveRender = useCallback(() => {
    setRenderTick((n) => (n + 1) % Number.MAX_SAFE_INTEGER);
  }, []);

  // Synchronize open tab sessions whenever tabs list or workspace changes
  useEffect(() => {
    const sessions = sessionsRef.current;

    if (!enabled || !workspaceId) {
      if (ownedBindingRef.current) {
        ownedBindingRef.current.destroy();
        ownedBindingRef.current = null;
      }
      for (const session of sessions.values()) {
        session.destroy();
      }
      sessions.clear();
      removeCursorStyles();
      triggerActiveRender();
      return;
    }

    const openFileIds = new Set(tabs.map((t) => t.id));
    let changed = false;

    // 1. Tear down sessions for closed tabs only
    for (const [fid, session] of sessions.entries()) {
      if (!openFileIds.has(fid)) {
        // Ensure active binding for a closing tab is cleanly detached before destroying its Y.Doc
        if (
          ownedBindingRef.current &&
          !ownedBindingRef.current.isDestroyed() &&
          ownedBindingRef.current.binding.ytext === session.ytext
        ) {
          ownedBindingRef.current.destroy();
          ownedBindingRef.current = null;
        }
        session.destroy();
        sessions.delete(fid);
        changed = true;
      }
    }

    // 2. Establish sessions for newly opened tabs
    const resolvedUrl = collabUrl || process.env.NEXT_PUBLIC_COLLAB_URL || "ws://localhost:1234";

    for (const tab of tabs) {
      if (sessions.has(tab.id)) continue;

      const fileId = tab.id;
      const docName = getCollabDocumentName(workspaceId, fileId);
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText("monaco");
      let isDisposed = false;

      const tokenResolver = async (): Promise<string> => {
        const currentToken = tokenRef.current;
        if (typeof currentToken === "function") {
          const res = await currentToken();
          return res ?? "";
        }
        if (typeof currentToken === "string") return currentToken;
        return getAccessToken() ?? "";
      };

      const entry: TabCollabSession = {
        fileId,
        documentName: docName,
        ydoc,
        ytext,
        provider: null as unknown as HocuspocusProvider,
        status: "connecting",
        isSynced: false,
        saveStatus: "saved",
        isDirty: false,
        isSaving: false,
        saveError: null,
        hasUnsyncedChanges: false,
        collaboratorCount: 0,
        collaborators: [],
        localUser: null,
        error: null,
        localEditCount: 0,
        lastSerializedCollaborators: "",
        inFlightSaves: new Map(),
        pendingDiscardResolvers: new Map(),
        isDestroyed: false,
        destroy: () => {},
      };

      const notifyIfActive = () => {
        if (!isDisposed && activeTabIdRef.current === fileId) {
          triggerActiveRender();
        }
      };

      const syncAwarenessState = () => {
        if (isDisposed || !entry.provider?.awareness) return;
        const localClientId = entry.provider.awareness.clientID;
        const remoteList: Collaborator[] = [];
        let local: Collaborator | null = null;

        entry.provider.awareness.getStates().forEach((state, cid) => {
          if (!state || !state.user) return;
          const u = state.user as CollabUser;
          const color = isValidCursorColor(u.color)
            ? u.color
            : getUserColor(u.id || u.userId || u.name || String(cid));
          const name = sanitizeCollaboratorName(u.name);
          const collabObj: Collaborator = {
            clientId: cid,
            user: {
              id: u.id || u.userId || String(cid),
              name,
              color,
              avatarUrl: u.avatarUrl || null,
              email: u.email,
            },
            isLocal: cid === localClientId,
          };

          if (cid === localClientId) {
            local = collabObj;
          } else {
            remoteList.push(collabObj);
          }
        });

        if (activeTabIdRef.current === fileId) {
          updateCursorStyles(entry.provider.awareness, localClientId);
        }

        const serialized = JSON.stringify(
          remoteList.map((c) => ({
            cid: c.clientId,
            id: c.user.id,
            name: c.user.name,
            color: c.user.color,
            avatarUrl: c.user.avatarUrl,
          }))
        );

        let awarenessChanged = false;
        if (serialized !== entry.lastSerializedCollaborators) {
          entry.lastSerializedCollaborators = serialized;
          entry.collaborators = remoteList;
          entry.collaboratorCount = remoteList.length;
          awarenessChanged = true;
        }
        entry.localUser = local;

        if (awarenessChanged) {
          notifyIfActive();
        }
      };

      const provider = new HocuspocusProvider({
        url: resolvedUrl,
        name: docName,
        document: ydoc,
        token: tokenResolver,
        onStatus: ({ status: wsStatus }) => {
          if (isDisposed) return;
          switch (wsStatus) {
            case WebSocketStatus.Connecting:
              entry.status = "connecting";
              break;
            case WebSocketStatus.Connected:
              entry.status = "connected";
              break;
            case WebSocketStatus.Disconnected:
              entry.status = "disconnected";
              break;
            default:
              entry.status = "disconnected";
              break;
          }
          notifyIfActive();
        },
        onSynced: ({ state }) => {
          if (isDisposed) return;
          entry.isSynced = state;
          notifyIfActive();
        },
        onAuthenticationFailed: ({ reason }) => {
          if (isDisposed) return;
          const authErr = new Error(`Authentication failed: ${reason || "Unauthorized"}`);
          entry.error = authErr;
          entry.status = "error";
          onErrorRef.current?.(authErr);
          notifyIfActive();
        },
        onClose: () => {
          if (isDisposed) return;
          entry.status = "disconnected";
          notifyIfActive();
        },
        onDisconnect: () => {
          if (isDisposed) return;
          entry.status = "disconnected";
          notifyIfActive();
        },
        onAwarenessUpdate: syncAwarenessState,
        onAwarenessChange: syncAwarenessState,
      });

      entry.provider = provider;
      provider.awareness?.on("change", syncAwarenessState);

      const statelessHandler = async ({ payload }: { payload: string }) => {
        if (isDisposed) return;
        try {
          const msg = JSON.parse(payload);
          if (msg.documentName !== docName) return;

          if (msg.type === "persisted") {
            const persistedContent =
              typeof msg.content === "string" ? msg.content : ytext.toString();

            if (msg.requestId && entry.inFlightSaves.has(msg.requestId)) {
              const inFlight = entry.inFlightSaves.get(msg.requestId)!;
              entry.inFlightSaves.delete(msg.requestId);
              if (inFlight.timer) clearTimeout(inFlight.timer);

              const hasNewerEdits = entry.localEditCount > inFlight.editCount;
              if (!hasNewerEdits) {
                entry.isDirty = false;
                entry.saveStatus = "saved";
                entry.saveError = null;
                entry.hasUnsyncedChanges = false;
                onTabDirtyChangeRef.current?.(fileId, false);
              } else {
                entry.isDirty = true;
                entry.saveStatus = "unsaved";
              }
              entry.isSaving = false;
              onTabSavedRef.current?.(fileId, persistedContent, msg.updatedAt, msg.version);
              inFlight.resolve(true);
              notifyIfActive();
            } else if (msg.stateChecksum) {
              const localChecksum = await computeYDocChecksum(ydoc);
              if (!isDisposed) {
                if (localChecksum === msg.stateChecksum) {
                  entry.isDirty = false;
                  entry.saveStatus = "saved";
                  entry.saveError = null;
                  entry.hasUnsyncedChanges = false;
                  onTabDirtyChangeRef.current?.(fileId, false);
                }
                onTabSavedRef.current?.(fileId, persistedContent, msg.updatedAt, msg.version);
                notifyIfActive();
              }
            }
          } else if (msg.type === "persist_error") {
            if (msg.requestId && entry.inFlightSaves.has(msg.requestId)) {
              const inFlight = entry.inFlightSaves.get(msg.requestId)!;
              entry.inFlightSaves.delete(msg.requestId);
              if (inFlight.timer) clearTimeout(inFlight.timer);
              entry.saveStatus = "error";
              entry.isSaving = false;
              entry.saveError = msg.error || "Persistence failed";
              inFlight.resolve(false);
              notifyIfActive();
            }
          } else if (msg.type === "discarded") {
            if (msg.requestId && entry.pendingDiscardResolvers.has(msg.requestId)) {
              const resolveDiscard = entry.pendingDiscardResolvers.get(msg.requestId)!;
              entry.pendingDiscardResolvers.delete(msg.requestId);
              entry.isDirty = false;
              entry.saveStatus = "saved";
              entry.saveError = null;
              entry.hasUnsyncedChanges = false;
              entry.localEditCount = 0;
              onTabDirtyChangeRef.current?.(fileId, false);
              resolveDiscard(true);
              notifyIfActive();
            }
          } else if (msg.type === "discard_error") {
            if (msg.requestId && entry.pendingDiscardResolvers.has(msg.requestId)) {
              const resolveDiscard = entry.pendingDiscardResolvers.get(msg.requestId)!;
              entry.pendingDiscardResolvers.delete(msg.requestId);
              entry.saveError = msg.error || "Failed to discard changes";
              resolveDiscard(false);
              notifyIfActive();
            }
          }
        } catch {
          // Ignore non-JSON payload
        }
      };

      provider.on("stateless", statelessHandler);

      const updateHandler = (_update: Uint8Array, origin: unknown) => {
        if (isDisposed) return;
        const isRemote = origin === provider || origin === "server";
        if (!isRemote) {
          entry.localEditCount += 1;
          entry.isDirty = true;
          entry.saveStatus = "unsaved";
          entry.hasUnsyncedChanges = true;
          onTabDirtyChangeRef.current?.(fileId, true);
          notifyIfActive();
        }
      };
      ydoc.on("update", updateHandler);

      const initialUser = userRef.current;
      if (initialUser && provider.awareness) {
        const activeColor =
          initialUser.color ||
          getUserColor(initialUser.id || initialUser.userId || initialUser.name);
        provider.awareness.setLocalStateField("user", {
          id: initialUser.id || initialUser.userId,
          name: initialUser.name || "Anonymous",
          color: activeColor,
          avatarUrl: initialUser.avatarUrl,
          email: initialUser.email,
        });
        syncAwarenessState();
      }

      entry.destroy = () => {
        if (isDisposed) return;
        isDisposed = true;
        entry.isDestroyed = true;
        if (provider.awareness) {
          provider.awareness.setLocalStateField("selection", null);
        }
        provider.off("stateless", statelessHandler);
        provider.awareness?.off("change", syncAwarenessState);
        ydoc.off("update", updateHandler);

        entry.inFlightSaves.forEach((inFlight) => {
          if (inFlight.timer) clearTimeout(inFlight.timer);
          inFlight.resolve(false);
        });
        entry.inFlightSaves.clear();

        entry.pendingDiscardResolvers.forEach((res) => res(false));
        entry.pendingDiscardResolvers.clear();

        provider.destroy();
        provider.configuration.websocketProvider.destroy();
        ydoc.destroy();
      };

      sessions.set(fileId, entry);
      changed = true;
    }

    if (changed) {
      triggerActiveRender();
    }
  }, [workspaceId, tabs, enabled, collabUrl, triggerActiveRender]);

  // Propagate user profile updates to open sessions
  useEffect(() => {
    if (!user) return;
    const activeColor = user.color || getUserColor(user.id || user.userId || user.name);
    for (const session of sessionsRef.current.values()) {
      if (session.provider.awareness) {
        session.provider.awareness.setLocalStateField("user", {
          id: user.id || user.userId,
          name: user.name || "Anonymous",
          color: activeColor,
          avatarUrl: user.avatarUrl,
          email: user.email,
        });
      }
    }
  }, [user]);

  const activeSession = activeTabId ? (sessionsRef.current.get(activeTabId) ?? null) : null;
  const activeSynced = Boolean(activeSession?.isSynced);

  // Notify parent layout/header when active tab's connection/awareness changes
  useEffect(() => {
    const status = activeSession?.status ?? "disconnected";
    const synced = activeSession?.isSynced ?? false;
    const collaborators = activeSession?.collaborators ?? [];
    onActiveStateChangeRef.current?.(status, synced, collaborators);

    if (activeSession?.provider?.awareness) {
      updateCursorStyles(
        activeSession.provider.awareness,
        activeSession.provider.awareness.clientID
      );
    } else {
      removeCursorStyles();
    }
  }, [
    activeTabId,
    activeSession?.status,
    activeSession?.isSynced,
    activeSession?.collaborators,
    activeSession?.provider,
  ]);

  // Bind MonacoBinding strictly to the active tab's matching Monaco model.
  // Registered BEFORE unmount session teardown so React runs binding cleanup
  // while Y.Text, Y.Doc, and awareness are still alive, and acts as the sole owner
  // of binding destruction via createOwnedMonacoBinding.
  useEffect(() => {
    if (!editor || !activeTabId || !activeSession || !activeSynced || activeSession.isDestroyed) {
      if (ownedBindingRef.current) {
        ownedBindingRef.current.destroy();
        ownedBindingRef.current = null;
      }
      return;
    }

    let isDisposed = false;
    let localOwnedBinding: OwnedMonacoBinding | null = null;
    let modelListener: Monaco.IDisposable | null = null;

    const attachBindingIfModelReady = async () => {
      if (isDisposed || activeSession.isDestroyed) return;
      const model = editor.getModel();
      if (
        !model ||
        (typeof model.isDisposed === "function" && model.isDisposed()) ||
        !modelMatchesFileId(model, activeTabId)
      ) {
        return;
      }

      if (ownedBindingRef.current) {
        ownedBindingRef.current.destroy();
        ownedBindingRef.current = null;
      }

      try {
        const { MonacoBinding: MonacoBindingClass } = await import("y-monaco");
        if (isDisposed || activeSession.isDestroyed) return;

        // Re-verify editor model still matches activeTabId and wasn't disposed during async import
        const verifiedModel = editor.getModel();
        if (
          !verifiedModel ||
          (typeof verifiedModel.isDisposed === "function" && verifiedModel.isDisposed()) ||
          !modelMatchesFileId(verifiedModel, activeTabId)
        ) {
          return;
        }

        const rawBinding = new MonacoBindingClass(
          activeSession.ytext,
          verifiedModel,
          new Set([editor]),
          activeSession.provider.awareness ?? undefined
        );
        localOwnedBinding = createOwnedMonacoBinding(rawBinding, verifiedModel, () => {
          if (ownedBindingRef.current === localOwnedBinding) {
            ownedBindingRef.current = null;
          }
        });
        ownedBindingRef.current = localOwnedBinding;

        if (activeSession.provider.awareness) {
          activeSession.provider.awareness.emit("change", [
            {
              added: [],
              updated: [activeSession.provider.awareness.clientID],
              removed: [],
            },
            "local",
          ]);
        }

        (rawBinding as unknown as { _rerenderDecorations?: () => void })._rerenderDecorations?.();

        const sel = editor.getSelection();
        if (sel && activeSession.provider.awareness) {
          const anchor = verifiedModel.getOffsetAt(sel.getStartPosition());
          const head = verifiedModel.getOffsetAt(sel.getEndPosition());
          activeSession.provider.awareness.setLocalStateField("selection", {
            anchor: Y.createRelativePositionFromTypeIndex(activeSession.ytext, anchor),
            head: Y.createRelativePositionFromTypeIndex(activeSession.ytext, head),
          });
        }
      } catch (err) {
        if (isDisposed) return;
        const errObj =
          err instanceof Error ? err : new Error("Failed to bind collaborative editor");
        activeSession.error = errObj;
        onErrorRef.current?.(errObj);
      }
    };

    if (modelMatchesFileId(editor.getModel(), activeTabId)) {
      void attachBindingIfModelReady();
    } else {
      modelListener = editor.onDidChangeModel(() => {
        if (modelMatchesFileId(editor.getModel(), activeTabId)) {
          modelListener?.dispose();
          modelListener = null;
          void attachBindingIfModelReady();
        }
      });
    }

    return () => {
      isDisposed = true;
      modelListener?.dispose();
      modelListener = null;
      if (localOwnedBinding) {
        localOwnedBinding.destroy();
        if (ownedBindingRef.current === localOwnedBinding) {
          ownedBindingRef.current = null;
        }
      }
      if (!activeSession.isDestroyed && activeSession.provider.awareness) {
        activeSession.provider.awareness.setLocalStateField("selection", null);
      }
    };
  }, [editor, activeTabId, activeSession, activeSynced]);

  // Full cleanup on workspace/component unmount (runs AFTER binding effect cleanup due to hook order)
  useEffect(() => {
    const sessions = sessionsRef.current;
    return () => {
      for (const session of sessions.values()) {
        session.destroy();
      }
      sessions.clear();
      removeCursorStyles();
    };
  }, []);

  const getIsDirty = useCallback((fileId?: string | null): boolean => {
    const targetId = fileId ?? activeTabIdRef.current;
    if (!targetId) return false;
    return sessionsRef.current.get(targetId)?.isDirty ?? false;
  }, []);

  const isTabCollabActive = useCallback((fileId?: string | null): boolean => {
    const targetId = fileId ?? activeTabIdRef.current;
    if (!targetId) return false;
    const s = sessionsRef.current.get(targetId);
    return Boolean(s && s.status === "connected" && s.isSynced);
  }, []);

  const pauseAutosave = useCallback((fileId: string): void => {
    const session = sessionsRef.current.get(fileId);
    if (!session || session.status !== "connected") return;
    try {
      session.provider.sendStateless(
        JSON.stringify({ type: "pause_autosave", documentName: session.documentName })
      );
    } catch {
      // Ignore if socket already closing
    }
  }, []);

  const resumeAutosave = useCallback((fileId: string): void => {
    const session = sessionsRef.current.get(fileId);
    if (!session || session.status !== "connected") return;
    try {
      session.provider.sendStateless(
        JSON.stringify({ type: "resume_autosave", documentName: session.documentName })
      );
    } catch {
      // Ignore if socket closing
    }
  }, []);

  const saveDocument = useCallback(
    async (fileId?: string | null): Promise<boolean> => {
      const targetId = fileId ?? activeTabIdRef.current;
      if (!targetId) return false;
      const session = sessionsRef.current.get(targetId);
      if (!session || session.status !== "connected") return false;

      if (!session.isDirty && session.saveStatus === "saved") {
        return true;
      }

      session.isSaving = true;
      session.saveStatus = "saving";
      triggerActiveRender();

      return new Promise<boolean>((resolve) => {
        const requestId = `save_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
        const capturedEditCount = session.localEditCount;
        let timer: NodeJS.Timeout | null = null;

        const cleanup = () => {
          if (timer) clearTimeout(timer);
          session.inFlightSaves.delete(requestId);
        };

        const handleResolve = (success: boolean) => {
          cleanup();
          resolve(success);
        };

        timer = setTimeout(() => {
          cleanup();
          session.isSaving = false;
          session.saveStatus = "error";
          session.saveError = "Save operation timed out. Please check your connection.";
          triggerActiveRender();
          resolve(false);
        }, 5000);

        session.inFlightSaves.set(requestId, {
          editCount: capturedEditCount,
          resolve: handleResolve,
          timer,
        });

        try {
          session.provider.sendStateless(
            JSON.stringify({
              type: "save_request",
              documentName: session.documentName,
              requestId,
            })
          );
        } catch {
          session.provider.forceSync();
          handleResolve(false);
        }
      });
    },
    [triggerActiveRender]
  );

  const discardLocalChanges = useCallback(
    async (fileId?: string | null): Promise<boolean> => {
      const targetId = fileId ?? activeTabIdRef.current;
      if (!targetId) return false;
      const session = sessionsRef.current.get(targetId);

      if (!session) {
        return true;
      }

      // If peers are connected, leave session cleanly without discarding shared state
      if (session.collaborators.length > 0) {
        // Release any dialog autosave pause so remaining peers continue auto-persisting
        resumeAutosave(targetId);
        session.isDirty = false;
        session.saveStatus = "saved";
        session.isSaving = false;
        session.saveError = null;
        session.hasUnsyncedChanges = false;
        session.localEditCount = 0;
        onTabDirtyChangeRef.current?.(targetId, false);
        triggerActiveRender();
        return true;
      }

      if (session.status !== "connected") {
        session.saveError = "Collaboration server disconnected; cannot confirm discard.";
        triggerActiveRender();
        return false;
      }

      return new Promise<boolean>((resolve) => {
        const requestId = `discard_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
        let timer: NodeJS.Timeout | null = null;

        const cleanup = () => {
          if (timer) clearTimeout(timer);
          session.pendingDiscardResolvers.delete(requestId);
        };

        const handleResolve = (success: boolean, errMsg?: string) => {
          cleanup();
          if (success) {
            session.isDirty = false;
            session.saveStatus = "saved";
            session.isSaving = false;
            session.saveError = null;
            session.hasUnsyncedChanges = false;
            session.localEditCount = 0;
            onTabDirtyChangeRef.current?.(targetId, false);
          } else {
            session.isSaving = false;
            if (errMsg) {
              session.saveError = errMsg;
            }
          }
          triggerActiveRender();
          resolve(success);
        };

        timer = setTimeout(() => {
          handleResolve(false, "Discard timed out while waiting for server confirmation.");
        }, 3000);

        session.pendingDiscardResolvers.set(requestId, handleResolve);

        try {
          session.provider.sendStateless(
            JSON.stringify({
              type: "discard_request",
              documentName: session.documentName,
              requestId,
            })
          );
        } catch {
          handleResolve(false, "Failed to transmit discard request.");
        }
      });
    },
    [resumeAutosave, triggerActiveRender]
  );

  const forceSync = useCallback(() => {
    const session = activeTabIdRef.current ? sessionsRef.current.get(activeTabIdRef.current) : null;
    if (session) {
      session.provider.forceSync();
      session.hasUnsyncedChanges = session.provider.hasUnsyncedChanges;
      triggerActiveRender();
    }
  }, [triggerActiveRender]);

  const reconnect = useCallback(() => {
    const session = activeTabIdRef.current ? sessionsRef.current.get(activeTabIdRef.current) : null;
    session?.provider.connect();
  }, []);

  const disconnect = useCallback(() => {
    const session = activeTabIdRef.current ? sessionsRef.current.get(activeTabIdRef.current) : null;
    session?.provider.disconnect();
  }, []);

  return {
    status: activeSession?.status ?? "disconnected",
    isSynced: activeSession?.isSynced ?? false,
    saveStatus: activeSession?.saveStatus ?? "saved",
    isDirty: activeSession?.isDirty ?? false,
    isSaving: activeSession?.isSaving ?? false,
    saveError: activeSession?.saveError ?? null,
    hasUnsyncedChanges: activeSession?.hasUnsyncedChanges ?? false,
    collaboratorCount: activeSession?.collaboratorCount ?? 0,
    collaborators: activeSession?.collaborators ?? [],
    localUser: activeSession?.localUser ?? null,
    ytext: activeSession?.ytext ?? null,
    ydoc: activeSession?.ydoc ?? null,
    provider: activeSession?.provider ?? null,
    error: activeSession?.error ?? null,
    getIsDirty,
    isTabCollabActive,
    pauseAutosave,
    resumeAutosave,
    saveDocument,
    discardLocalChanges,
    forceSync,
    reconnect,
    disconnect,
  };
}
