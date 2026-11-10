"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";
import type { MonacoBinding } from "y-monaco";
import type * as Monaco from "monaco-editor";
import { getAccessToken } from "../lib/apiClient";

export type CollabConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
export type CollabSaveStatus = "saved" | "saving" | "unsaved" | "error";

export const COLLAB_USER_COLORS = [
  "#3B82F6", // Bright Blue
  "#10B981", // Emerald Green
  "#F59E0B", // Amber Gold
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#14B8A6", // Teal
  "#A855F7", // Violet
  "#E11D48", // Rose Red
  "#84CC16", // Lime
  "#6366F1", // Indigo
];

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Validates whether a given string is a safe 6-digit hex color (e.g. #3B82F6).
 */
export function isValidCursorColor(color: unknown): color is string {
  return typeof color === "string" && HEX_COLOR_REGEX.test(color);
}

/**
 * Safely sanitizes a collaborator display name for embedding into dynamic CSS content strings.
 * Prevents newline injection, CSS escape sequences, quote escapes, and excessive length.
 */
export function sanitizeCollaboratorName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) return "Collaborator";
  return name
    .trim()
    .slice(0, 40)
    .replace(/[\r\n\t\f\v;{}]/g, " ")
    .replace(/\/\*|\*\//g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

/**
 * Returns a consistent, vibrant cursor/avatar color deterministically derived from a user seed.
 */
export function getUserColor(seed: string): string {
  if (!seed) return COLLAB_USER_COLORS[0] ?? "#3B82F6";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLLAB_USER_COLORS.length;
  return COLLAB_USER_COLORS[index] ?? COLLAB_USER_COLORS[0] ?? "#3B82F6";
}

export interface CollabUser {
  id?: string;
  name: string;
  color?: string;
  userId?: string;
  avatarUrl?: string | null;
  email?: string;
}

export interface Collaborator {
  clientId: number;
  user: CollabUser;
  isLocal: boolean;
}

export interface UseCollabOptions {
  workspaceId?: string | null;
  fileId?: string | null;
  editor?: Monaco.editor.IStandaloneCodeEditor | null;
  monaco?: typeof Monaco | null;
  enabled?: boolean;
  collabUrl?: string;
  token?: string | null | (() => string | null | Promise<string | null>);
  user?: CollabUser | null;
  onStatusChange?: (status: CollabConnectionStatus) => void;
  onSyncedChange?: (isSynced: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onSaved?: (documentName: string, version: number, updatedAt: string, content?: string) => void;
  onCollaboratorsChange?: (collaborators: Collaborator[]) => void;
  onError?: (error: Error) => void;
}

export interface UseCollabResult {
  status: CollabConnectionStatus;
  isSynced: boolean;
  saveStatus: CollabSaveStatus;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  getIsDirty: () => boolean;
  saveDocument: () => Promise<boolean>;
  discardLocalChanges: () => Promise<boolean>;
  hasUnsyncedChanges: boolean;
  collaboratorCount: number;
  collaborators: Collaborator[];
  localUser: Collaborator | null;
  documentName: string | null;
  ydoc: Y.Doc | null;
  ytext: Y.Text | null;
  provider: HocuspocusProvider | null;
  binding: MonacoBinding | null;
  error: Error | null;
  forceSync: () => void;
  reconnect: () => void;
  disconnect: () => void;
}

/**
 * Computes a deterministic SHA-256 state checksum for a Y.Doc to correlate
 * server-persisted state with local client state.
 */
export async function computeYDocChecksum(ydoc: Y.Doc): Promise<string> {
  const update = Y.encodeStateAsUpdate(ydoc);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    // Slice into an isolated ArrayBuffer to conform strictly to BufferSource
    const buffer = update.buffer.slice(
      update.byteOffset,
      update.byteOffset + update.byteLength
    ) as ArrayBuffer;
    const hashBuf = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback FNV-1a 64-bit hash
  let h1 = 0x811c9dc5;
  for (let i = 0; i < update.length; i++) {
    const val = update[i] ?? 0;
    h1 ^= val;
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16);
}

/**
 * Injects or updates dynamic CSS rules for remote collaborator cursors and selection highlights.
 */
export function updateCursorStyles(
  awareness: HocuspocusProvider["awareness"],
  localClientId: number
): void {
  if (typeof document === "undefined" || !awareness) return;

  const styleId = "yjs-monaco-cursor-styles";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  let css = `
    /* Base styles for remote selections and cursors */
    .yRemoteSelection {
      background-color: rgba(0, 122, 204, 0.25);
      border-radius: 1px;
      pointer-events: none;
    }
    .yRemoteSelectionHead {
      position: absolute;
      box-sizing: border-box;
      height: 100%;
      border-left: 2px solid #007acc;
      border-right: 0;
      margin-left: -1px;
      pointer-events: none;
    }
    .yRemoteSelectionHead::after {
      position: absolute;
      top: -1.35em;
      left: -2px;
      padding: 0.5px 4px;
      font-size: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      line-height: 1.25;
      color: #ffffff;
      background-color: #007acc;
      border-radius: 2px 2px 2px 0;
      white-space: nowrap;
      pointer-events: none;
      user-select: none;
      z-index: 50;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
  `;

  awareness.getStates().forEach((state, cid) => {
    if (cid !== localClientId && state?.user) {
      const u = state.user as CollabUser;
      const color = isValidCursorColor(u.color)
        ? u.color
        : getUserColor(u.id || u.userId || u.name || String(cid));
      const sanitizedName = sanitizeCollaboratorName(u.name);

      css += `
        .yRemoteSelection-${cid} {
          background-color: ${color}33 !important;
        }
        .yRemoteSelectionHead-${cid} {
          border-left: 2px solid ${color} !important;
        }
        .yRemoteSelectionHead-${cid}::after {
          content: '${sanitizedName}' !important;
          background-color: ${color} !important;
          border-color: ${color} !important;
        }
      `;
    }
  });

  styleEl.textContent = css;
}

export function removeCursorStyles(): void {
  if (typeof document === "undefined") return;
  const styleEl = document.getElementById("yjs-monaco-cursor-styles");
  if (styleEl) {
    styleEl.textContent = "";
  }
}

/**
 * Generates the canonical collaborative document identifier for a workspace file.
 * Format: workspace:<workspaceId>:file:<fileId>
 */
export function getCollabDocumentName(workspaceId: string, fileId: string): string {
  return `workspace:${workspaceId}:file:${fileId}`;
}

/**
 * Parses a canonical collaborative document name into its constituent identifiers.
 */
export function parseCollabDocumentName(
  documentName: string
): { workspaceId: string; fileId: string } | null {
  const match = documentName.match(/^workspace:([a-zA-Z0-9_-]+):file:([a-zA-Z0-9_-]+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { workspaceId: match[1], fileId: match[2] };
}

export interface OwnedMonacoBinding {
  binding: MonacoBinding;
  destroy: () => void;
  isDestroyed: () => boolean;
}

/**
 * Coordinates single-destruction ownership for a `y-monaco` `MonacoBinding`.
 *
 * `y-monaco` attaches `model.onWillDispose(() => this.destroy())` in its constructor and
 * its `destroy()` calls `ytext.unobserve(...)` non-idempotently. Tracking disposal alongside
 * Monaco's `onWillDispose` ensures `binding.destroy()` is invoked at most once.
 */
export function createOwnedMonacoBinding(
  binding: MonacoBinding,
  model: Monaco.editor.ITextModel,
  onDidDestroy?: () => void
): OwnedMonacoBinding {
  let destroyed = false;

  const modelDisposeSubscription = model.onWillDispose(() => {
    if (destroyed) return;
    destroyed = true;
    modelDisposeSubscription.dispose();
    onDidDestroy?.();
  });

  const destroy = () => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    modelDisposeSubscription.dispose();
    binding.destroy();
    onDidDestroy?.();
  };

  return {
    binding,
    destroy,
    isDestroyed: () => destroyed,
  };
}

/**
 * Robust hook for managing Yjs CRDTs, HocuspocusProvider WebSocket lifecycle,
 * and MonacoBinding synchronization for collaborative editing.
 *
 * Implements strict lifecycle teardown to prevent memory leaks and duplicate
 * connections under React 19 Strict Mode.
 */
export function useCollab(options: UseCollabOptions): UseCollabResult {
  const {
    workspaceId,
    fileId,
    editor,
    enabled = true,
    collabUrl,
    token,
    user,
    onStatusChange,
    onSyncedChange,
    onDirtyChange,
    onSaved,
    onCollaboratorsChange,
    onError,
  } = options;

  const [status, setStatusState] = useState<CollabConnectionStatus>("disconnected");
  const [isSynced, setIsSyncedState] = useState<boolean>(false);
  const [saveStatus, setSaveStatusState] = useState<CollabSaveStatus>("saved");
  const [isDirty, setIsDirtyState] = useState<boolean>(false);
  const [isSaving, setIsSavingState] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState<boolean>(false);
  const [collaboratorCount, setCollaboratorCount] = useState<number>(0);
  const [collaborators, setCollaboratorsState] = useState<Collaborator[]>([]);
  const [localUser, setLocalUser] = useState<Collaborator | null>(null);
  const [error, setErrorState] = useState<Error | null>(null);

  // References to active Yjs and provider instances
  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const ownedBindingRef = useRef<OwnedMonacoBinding | null>(null);
  const lastSerializedCollaboratorsRef = useRef<string>("");

  const saveStatusRef = useRef<CollabSaveStatus>("saved");
  saveStatusRef.current = saveStatus;
  const isDirtyRef = useRef<boolean>(false);
  isDirtyRef.current = isDirty;
  const isSavingRef = useRef<boolean>(false);
  isSavingRef.current = isSaving;

  // Local monotonic edit counter to track edits relative to in-flight saves
  const localEditCountRef = useRef<number>(0);

  // In-flight save requests map: requestId -> { editCount, resolve, timer }
  const inFlightSavesRef = useRef<
    Map<
      string,
      {
        editCount: number;
        resolve: (success: boolean) => void;
        timer: NodeJS.Timeout | null;
      }
    >
  >(new Map());

  // In-flight discard requests map: requestId -> resolve
  const pendingDiscardResolversRef = useRef<Map<string, (success: boolean) => void>>(new Map());

  // State mirror for active instances to trigger consumer re-renders when initialized
  const [instances, setInstances] = useState<{
    ydoc: Y.Doc | null;
    ytext: Y.Text | null;
    provider: HocuspocusProvider | null;
    binding: MonacoBinding | null;
    documentName: string | null;
  }>({
    ydoc: null,
    ytext: null,
    provider: null,
    binding: null,
    documentName: null,
  });

  // Callbacks refs to avoid re-triggering effects on parent closure changes
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const onSyncedChangeRef = useRef(onSyncedChange);
  onSyncedChangeRef.current = onSyncedChange;
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const onCollaboratorsChangeRef = useRef(onCollaboratorsChange);
  onCollaboratorsChangeRef.current = onCollaboratorsChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const collaboratorsRef = useRef<Collaborator[]>(collaborators);
  collaboratorsRef.current = collaborators;

  const setStatus = useCallback((newStatus: CollabConnectionStatus) => {
    setStatusState(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const setIsSynced = useCallback((synced: boolean) => {
    setIsSyncedState(synced);
    onSyncedChangeRef.current?.(synced);
  }, []);

  const setIsDirty = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
    setIsDirtyState(dirty);
    onDirtyChangeRef.current?.(dirty);
  }, []);

  const setSaveStatus = useCallback((st: CollabSaveStatus) => {
    saveStatusRef.current = st;
    setSaveStatusState(st);
  }, []);

  const setIsSaving = useCallback((saving: boolean) => {
    isSavingRef.current = saving;
    setIsSavingState(saving);
  }, []);

  const setCollaborators = useCallback((list: Collaborator[]) => {
    setCollaboratorsState(list);
    onCollaboratorsChangeRef.current?.(list);
  }, []);

  const setError = useCallback((err: Error | null) => {
    setErrorState(err);
    if (err) {
      onErrorRef.current?.(err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 1. Provider & Y.Doc Lifecycle (tied strictly to workspaceId, fileId, enabled)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // If collaboration is disabled or identifiers are missing, ensure clean disconnection
    if (!enabled || !workspaceId || !fileId) {
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
      ytextRef.current = null;

      setStatus("disconnected");
      setIsSynced(false);
      setIsDirty(false);
      setSaveStatus("saved");
      setIsSaving(false);
      setSaveError(null);
      setHasUnsyncedChanges(false);
      setCollaboratorCount(0);
      setCollaborators([]);
      setLocalUser(null);
      lastSerializedCollaboratorsRef.current = "";
      removeCursorStyles();
      setError(null);
      setInstances({
        ydoc: null,
        ytext: null,
        provider: null,
        binding: null,
        documentName: null,
      });
      return;
    }

    const docName = getCollabDocumentName(workspaceId, fileId);
    const resolvedUrl = collabUrl || process.env.NEXT_PUBLIC_COLLAB_URL || "ws://localhost:1234";

    // Create fresh Y.Doc and Y.Text
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("monaco");

    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    setStatus("connecting");
    setIsSynced(false);
    setIsDirty(false);
    setSaveStatus("saved");
    setIsSaving(false);
    setSaveError(null);
    setHasUnsyncedChanges(false);
    setError(null);

    // Resolve authentication token (Hocuspocus expects string | (() => string) | (() => Promise<string>) | null)
    const tokenResolver = async (): Promise<string> => {
      if (typeof token === "function") {
        const res = await token();
        return res ?? "";
      }
      if (typeof token === "string") return token;
      return getAccessToken() ?? "";
    };

    let isDisposed = false;

    // Helper to extract remote collaborators and update cursor styles
    const syncAwarenessState = () => {
      if (isDisposed || !provider.awareness) return;
      const localClientId = provider.awareness.clientID;
      const remoteList: Collaborator[] = [];
      let local: Collaborator | null = null;

      provider.awareness.getStates().forEach((state, cid) => {
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

      // Update dynamic cursor styles
      updateCursorStyles(provider.awareness, localClientId);

      // Compare serialized summary to prevent wasteful React renders on pure cursor moves
      const serialized = JSON.stringify(
        remoteList.map((c) => ({
          cid: c.clientId,
          id: c.user.id,
          name: c.user.name,
          color: c.user.color,
          avatarUrl: c.user.avatarUrl,
        }))
      );

      if (serialized !== lastSerializedCollaboratorsRef.current) {
        lastSerializedCollaboratorsRef.current = serialized;
        setCollaborators(remoteList);
        setCollaboratorCount(remoteList.length);
      }
      setLocalUser(local);
    };

    // Create HocuspocusProvider
    const provider = new HocuspocusProvider({
      url: resolvedUrl,
      name: docName,
      document: ydoc,
      token: tokenResolver,
      onStatus: ({ status: wsStatus }) => {
        if (isDisposed) return;
        switch (wsStatus) {
          case WebSocketStatus.Connecting:
            setStatus("connecting");
            break;
          case WebSocketStatus.Connected:
            setStatus("connected");
            break;
          case WebSocketStatus.Disconnected:
            setStatus("disconnected");
            break;
          default:
            setStatus("disconnected");
            break;
        }
      },
      onSynced: ({ state }) => {
        if (isDisposed) return;
        setIsSynced(state);
      },
      onAuthenticationFailed: ({ reason }) => {
        if (isDisposed) return;
        const authErr = new Error(`Authentication failed: ${reason || "Unauthorized"}`);
        setError(authErr);
        setStatus("error");
      },
      onClose: () => {
        if (isDisposed) return;
        setStatus("disconnected");
      },
      onDisconnect: () => {
        if (isDisposed) return;
        setStatus("disconnected");
      },
      onAwarenessUpdate: syncAwarenessState,
      onAwarenessChange: syncAwarenessState,
    });

    provider.awareness?.on("change", syncAwarenessState);

    // Listen for authoritative persistence acknowledgment messages from Hocuspocus server
    const statelessHandler = async ({ payload }: { payload: string }) => {
      if (isDisposed) return;
      try {
        const msg = JSON.parse(payload);
        if (msg.documentName !== docName) return;

        if (msg.type === "persisted") {
          const persistedContent = typeof msg.content === "string" ? msg.content : ytext.toString();

          // Correlate with in-flight save request from this client
          if (msg.requestId && inFlightSavesRef.current.has(msg.requestId)) {
            const inFlight = inFlightSavesRef.current.get(msg.requestId)!;
            inFlightSavesRef.current.delete(msg.requestId);
            if (inFlight.timer) clearTimeout(inFlight.timer);

            // Determine if newer local edits occurred while save was in flight
            const hasNewerEdits = localEditCountRef.current > inFlight.editCount;
            if (!hasNewerEdits) {
              setIsDirty(false);
              setSaveStatus("saved");
              setSaveError(null);
              setHasUnsyncedChanges(false);
            } else {
              // Newer edits made during in-flight save must remain dirty
              setIsDirty(true);
              setSaveStatus("unsaved");
            }
            setIsSaving(false);
            onSavedRef.current?.(docName, msg.version, msg.updatedAt, persistedContent);
            inFlight.resolve(true);
          } else if (msg.stateChecksum) {
            // Background debounced save from server or peer acknowledgment
            const localChecksum = await computeYDocChecksum(ydoc);
            if (!isDisposed) {
              onSavedRef.current?.(docName, msg.version, msg.updatedAt, persistedContent);
              if (localChecksum === msg.stateChecksum) {
                setIsDirty(false);
                setSaveStatus("saved");
                setSaveError(null);
                setHasUnsyncedChanges(false);
              }
            }
          }
        } else if (msg.type === "persist_error") {
          if (msg.requestId && inFlightSavesRef.current.has(msg.requestId)) {
            const inFlight = inFlightSavesRef.current.get(msg.requestId)!;
            inFlightSavesRef.current.delete(msg.requestId);
            if (inFlight.timer) clearTimeout(inFlight.timer);
            setSaveStatus("error");
            setIsSaving(false);
            setSaveError(msg.error || "Persistence failed");
            inFlight.resolve(false);
          }
        } else if (msg.type === "discarded") {
          if (msg.requestId && pendingDiscardResolversRef.current.has(msg.requestId)) {
            const resolveDiscard = pendingDiscardResolversRef.current.get(msg.requestId)!;
            pendingDiscardResolversRef.current.delete(msg.requestId);
            setIsDirty(false);
            setSaveStatus("saved");
            setSaveError(null);
            setHasUnsyncedChanges(false);
            localEditCountRef.current = 0;
            resolveDiscard(true);
          }
        } else if (msg.type === "discard_error") {
          if (msg.requestId && pendingDiscardResolversRef.current.has(msg.requestId)) {
            const resolveDiscard = pendingDiscardResolversRef.current.get(msg.requestId)!;
            pendingDiscardResolversRef.current.delete(msg.requestId);
            setSaveError(msg.error || "Failed to discard changes on server.");
            resolveDiscard(false);
          }
        }
      } catch {
        // ignore non-JSON payload
      }
    };
    provider.on("stateless", statelessHandler);

    // Track document updates: distinguish local user mutations from server/remote synchronization
    const updateHandler = (_update: Uint8Array, origin: unknown) => {
      if (isDisposed) return;
      // Filter out remote updates and initial doc load from provider
      const isRemote = origin === provider || origin === "server";
      if (!isRemote) {
        localEditCountRef.current += 1;
        setIsDirty(true);
        setSaveStatus("unsaved");
        setHasUnsyncedChanges(true);
      }
    };
    ydoc.on("update", updateHandler);

    // Populate initial awareness user info if provided
    if (user && provider.awareness) {
      const activeColor = user.color || getUserColor(user.id || user.userId || user.name);
      provider.awareness.setLocalStateField("user", {
        id: user.id || user.userId,
        name: user.name || "Anonymous",
        color: activeColor,
        avatarUrl: user.avatarUrl,
        email: user.email,
      });
      syncAwarenessState();
    }

    providerRef.current = provider;

    setInstances((prev) => ({
      ...prev,
      ydoc,
      ytext,
      provider,
      documentName: docName,
    }));

    return () => {
      isDisposed = true;
      if (provider.awareness) {
        provider.awareness.setLocalStateField("selection", null);
      }
      provider.off("stateless", statelessHandler);
      provider.awareness?.off("change", syncAwarenessState);
      ydoc.off("update", updateHandler);
      removeCursorStyles();
      provider.destroy();
      ydoc.destroy();

      inFlightSavesRef.current.forEach((inFlight) => {
        if (inFlight.timer) clearTimeout(inFlight.timer);
        inFlight.resolve(false);
      });
      inFlightSavesRef.current.clear();

      pendingDiscardResolversRef.current.forEach((resolve) => resolve(false));
      pendingDiscardResolversRef.current.clear();

      if (providerRef.current === provider) {
        providerRef.current = null;
      }
      if (ydocRef.current === ydoc) {
        ydocRef.current = null;
        ytextRef.current = null;
      }
    };
  }, [
    workspaceId,
    fileId,
    enabled,
    collabUrl,
    token,
    user,
    setStatus,
    setIsSynced,
    setIsDirty,
    setSaveStatus,
    setIsSaving,
    setCollaborators,
    setError,
  ]);

  // ---------------------------------------------------------------------------
  // 2. User Awareness Profile Updates (keeps awareness in sync when user object mutates)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (user && providerRef.current?.awareness) {
      const activeColor = user.color || getUserColor(user.id || user.userId || user.name);
      providerRef.current.awareness.setLocalStateField("user", {
        id: user.id || user.userId,
        name: user.name || "Anonymous",
        color: activeColor,
        avatarUrl: user.avatarUrl,
        email: user.email,
      });
    }
  }, [user]);

  // ---------------------------------------------------------------------------
  // 2. MonacoBinding Lifecycle (tied to editor, active ytext, provider, AND isSynced)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const currentProvider = instances.provider;
    const currentYText = instances.ytext;

    // Only establish MonacoBinding once editor is mounted, provider is ready, AND document is synced
    if (!editor || !currentProvider || !currentYText || !isSynced) {
      if (ownedBindingRef.current) {
        ownedBindingRef.current.destroy();
        ownedBindingRef.current = null;
        bindingRef.current = null;
        setInstances((prev) => ({ ...prev, binding: null }));
      }
      return;
    }

    const model = editor.getModel();
    if (!model || (typeof model.isDisposed === "function" && model.isDisposed())) {
      if (ownedBindingRef.current) {
        ownedBindingRef.current.destroy();
        ownedBindingRef.current = null;
        bindingRef.current = null;
        setInstances((prev) => ({ ...prev, binding: null }));
      }
      return;
    }

    // Clean up previous binding before establishing a new one
    if (ownedBindingRef.current) {
      ownedBindingRef.current.destroy();
      ownedBindingRef.current = null;
      bindingRef.current = null;
    }

    let localOwnedBinding: OwnedMonacoBinding | null = null;
    let isDisposed = false;

    void (async () => {
      try {
        const { MonacoBinding: MonacoBindingClass } = await import("y-monaco");
        if (isDisposed || (typeof model.isDisposed === "function" && model.isDisposed())) {
          return;
        }

        const rawBinding = new MonacoBindingClass(
          currentYText,
          model,
          new Set([editor]),
          currentProvider.awareness ?? undefined
        );
        localOwnedBinding = createOwnedMonacoBinding(rawBinding, model, () => {
          if (ownedBindingRef.current === localOwnedBinding) {
            ownedBindingRef.current = null;
          }
          if (bindingRef.current === rawBinding) {
            bindingRef.current = null;
          }
        });
        ownedBindingRef.current = localOwnedBinding;
        bindingRef.current = rawBinding;
        setInstances((prev) => ({ ...prev, binding: rawBinding }));

        // 1. Immediately trigger public awareness change event so MonacoBinding renders existing remote cursors
        if (currentProvider.awareness) {
          currentProvider.awareness.emit("change", [
            { added: [], updated: [currentProvider.awareness.clientID], removed: [] },
            "local",
          ]);
        }

        // Documented fallback for y-monaco@0.1.6 internal decoration rendering
        (rawBinding as any)._rerenderDecorations?.();

        // 2. Publish initial local cursor position to awareness so peers see our cursor immediately
        const sel = editor.getSelection();
        if (sel && currentProvider.awareness) {
          const anchor = model.getOffsetAt(sel.getStartPosition());
          const head = model.getOffsetAt(sel.getEndPosition());
          currentProvider.awareness.setLocalStateField("selection", {
            anchor: Y.createRelativePositionFromTypeIndex(currentYText, anchor),
            head: Y.createRelativePositionFromTypeIndex(currentYText, head),
          });
        }
      } catch (bindErr) {
        if (isDisposed) return;
        const errorObj =
          bindErr instanceof Error
            ? bindErr
            : new Error("Failed to initialize Monaco collaborative binding");
        setError(errorObj);
      }
    })();

    return () => {
      isDisposed = true;
      if (localOwnedBinding) {
        localOwnedBinding.destroy();
        if (ownedBindingRef.current === localOwnedBinding) {
          ownedBindingRef.current = null;
        }
        if (bindingRef.current === localOwnedBinding.binding) {
          bindingRef.current = null;
        }
      }
    };
  }, [editor, instances.provider, instances.ytext, isSynced, setError]);

  // Request authoritative persistence of current document state to PostgreSQL
  const saveDocument = useCallback(async (): Promise<boolean> => {
    if (!providerRef.current || !ydocRef.current) return false;

    // If already clean and saved, resolve immediately with true
    if (!isDirtyRef.current && saveStatusRef.current === "saved") {
      return true;
    }

    setIsSaving(true);
    setSaveStatus("saving");

    return new Promise<boolean>((resolve) => {
      const requestId = `save_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      const capturedEditCount = localEditCountRef.current;
      let timer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        inFlightSavesRef.current.delete(requestId);
      };

      const handleResolve = (success: boolean) => {
        cleanup();
        resolve(success);
      };

      // 5-second safety timeout: never hang the user indefinitely
      timer = setTimeout(() => {
        cleanup();
        setIsSaving(false);
        setSaveStatus("error");
        setSaveError("Save operation timed out. Please check your connection.");
        resolve(false);
      }, 5000);

      inFlightSavesRef.current.set(requestId, {
        editCount: capturedEditCount,
        resolve: handleResolve,
        timer,
      });

      // Trigger immediate save request to server over WebSocket
      try {
        const docName = instances.documentName;
        if (docName) {
          providerRef.current?.sendStateless(
            JSON.stringify({ type: "save_request", documentName: docName, requestId })
          );
        } else {
          providerRef.current?.forceSync();
          handleResolve(true);
        }
      } catch {
        providerRef.current?.forceSync();
        handleResolve(false);
      }
    });
  }, [instances.documentName, setIsSaving, setSaveStatus]);

  // Discard local unsaved modifications and revert to authoritative server state
  const discardLocalChanges = useCallback(async (): Promise<boolean> => {
    if (!providerRef.current || !ydocRef.current) {
      setIsDirty(false);
      setSaveStatus("saved");
      setIsSaving(false);
      setSaveError(null);
      setHasUnsyncedChanges(false);
      localEditCountRef.current = 0;
      return true;
    }

    // If other collaborators are present in the session, closing the tab leaves the session
    // without executing a destructive server rollback that would erase peers' legitimate edits
    if (collaboratorsRef.current.length > 0) {
      setIsDirty(false);
      setSaveStatus("saved");
      setIsSaving(false);
      setSaveError(null);
      setHasUnsyncedChanges(false);
      localEditCountRef.current = 0;
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const requestId = `discard_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      let timer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        pendingDiscardResolversRef.current.delete(requestId);
      };

      const handleResolve = (success: boolean, errMsg?: string) => {
        cleanup();
        if (success) {
          setIsDirty(false);
          setSaveStatus("saved");
          setIsSaving(false);
          setSaveError(null);
          setHasUnsyncedChanges(false);
          localEditCountRef.current = 0;
        } else {
          setIsSaving(false);
          if (errMsg) {
            setSaveError(errMsg);
          }
        }
        resolve(success);
      };

      timer = setTimeout(() => {
        handleResolve(false, "Discard timed out while waiting for server confirmation.");
      }, 3000);

      pendingDiscardResolversRef.current.set(requestId, handleResolve);

      try {
        const docName = instances.documentName;
        if (docName) {
          providerRef.current?.sendStateless(
            JSON.stringify({ type: "discard_request", documentName: docName, requestId })
          );
        } else {
          handleResolve(false, "Document session is unavailable.");
        }
      } catch {
        handleResolve(false, "Failed to transmit discard request.");
      }
    });
  }, [instances.documentName, setIsDirty, setSaveStatus, setIsSaving]);

  // Force sync / immediate flush helper
  const forceSync = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.forceSync();
      setHasUnsyncedChanges(providerRef.current.hasUnsyncedChanges);
    }
  }, []);

  // Manual reconnect helper
  const reconnect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.connect();
    }
  }, []);

  // Manual disconnect helper
  const disconnect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.disconnect();
    }
  }, []);

  return {
    status,
    isSynced,
    saveStatus,
    isDirty,
    isSaving,
    saveError,
    getIsDirty: () => isDirtyRef.current,
    saveDocument,
    discardLocalChanges,
    hasUnsyncedChanges,
    collaboratorCount,
    collaborators,
    localUser,
    documentName: instances.documentName,
    ydoc: instances.ydoc,
    ytext: instances.ytext,
    provider: instances.provider,
    binding: instances.binding,
    error,
    forceSync,
    reconnect,
    disconnect,
  };
}
