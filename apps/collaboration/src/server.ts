import { Hocuspocus } from "@hocuspocus/server";
import { env } from "./config/env";
import { parseCollabDocumentName } from "./utils/document.utils";
import { authorizeCollabConnection } from "./services/auth.service";
import {
  clearAutoSaveTracking,
  discardDocumentInQueue,
  getPersistenceEpoch,
  loadDocumentFromDatabase,
  pauseAutoSave,
  resumeAutoSave,
  storeDocumentToDatabase,
} from "./services/persistence.service";

export interface CollaborationServerOptions {
  port?: number;
  debounce?: number;
  maxDebounce?: number;
  quiet?: boolean;
}

export function createCollaborationServer(options?: CollaborationServerOptions): Hocuspocus {
  // Track per-document dirty edit sequences so cancelled/discarded updates never re-persist
  const pendingDirtySeq = new Map<string, number>();
  const cleanDirtySeq = new Map<string, number>();

  const server = new Hocuspocus({
    port: options?.port ?? env.PORT,
    address: env.HOST,

    // Debounce database writes during continuous typing (2s debounce, 10s max debounce)
    debounce: options?.debounce ?? 2000,
    maxDebounce: options?.maxDebounce ?? 10000,
    quiet: options?.quiet ?? env.NODE_ENV === "test",

    async onListen(data) {
      console.log(`🚀 CodeSync Collaboration Server running on ws://${env.HOST}:${data.port}`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
      console.log("🔒 Authentication: Active (JWT + RBAC: Owner, Editor, Viewer)");
      console.log("💾 Persistence: Active (PostgreSQL Yjs binary + plain-text compatibility)");
    },

    /**
     * Authenticate connecting clients via JWT and enforce workspace/file RBAC.
     */
    async onAuthenticate(data) {
      const { token, documentName, connection } = data;

      try {
        const auth = await authorizeCollabConnection(token, documentName);

        // Attach verified user context to the connection
        data.context.user = {
          id: auth.userId,
          email: auth.email,
          name: auth.name,
        };
        data.context.workspaceId = auth.workspaceId;
        data.context.fileId = auth.fileId;
        data.context.role = auth.role;

        // Server-side enforcement of read-only permissions for VIEWERS
        connection.readOnly = auth.readOnly;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Authentication failed";
        // Throwing here triggers writePermissionDenied and closes connection immediately
        throw new Error(message);
      }
    },

    /**
     * Tracks authentic client document mutations so cancelled/discarded operations never re-persist.
     */
    async onChange(data) {
      if (
        data.socketId &&
        data.socketId.length > 0 &&
        data.transactionOrigin !== "__hocuspocus__redis__origin__"
      ) {
        pendingDirtySeq.set(data.documentName, (pendingDirtySeq.get(data.documentName) ?? 0) + 1);
      }
    },

    /**
     * Loads the initial Yjs document state from PostgreSQL when a room is created.
     */
    async onLoadDocument(data) {
      const { documentName, document } = data;
      const parsed = parseCollabDocumentName(documentName);

      if (!parsed) {
        throw new Error(`Cannot load document: invalid document name "${documentName}"`);
      }

      pendingDirtySeq.set(documentName, 0);
      cleanDirtySeq.set(documentName, 0);
      await loadDocumentFromDatabase(parsed.workspaceId, parsed.fileId, document);
      return document;
    },

    /**
     * Persists active Yjs binary updates and synchronized plain-text to PostgreSQL.
     */
    async onStoreDocument(data) {
      const { documentName, document } = data;
      const parsed = parseCollabDocumentName(documentName);

      if (!parsed) {
        console.error(`❌ onStoreDocument error: invalid document name "${documentName}"`);
        return;
      }

      const currentPending = pendingDirtySeq.get(documentName) ?? 0;
      const currentClean = cleanDirtySeq.get(documentName) ?? 0;

      // Skip if document has no unpersisted client mutations (e.g., already discarded or cleanly saved)
      if (currentPending <= currentClean) {
        return;
      }

      const capturedEpoch = getPersistenceEpoch(parsed.workspaceId, parsed.fileId);

      try {
        const result = await storeDocumentToDatabase(parsed.workspaceId, parsed.fileId, document, {
          expectedEpoch: capturedEpoch,
          isBackgroundAutoSave: true,
        });

        // Abort broadcast/clean-marking if superseded by a discard or paused for dialog deliberation
        if (
          result.aborted ||
          capturedEpoch !== getPersistenceEpoch(parsed.workspaceId, parsed.fileId)
        ) {
          return;
        }

        cleanDirtySeq.set(
          documentName,
          Math.max(cleanDirtySeq.get(documentName) ?? 0, currentPending)
        );

        // Broadcast authoritative persistence confirmation to all connected clients in this document room
        document.broadcastStateless(
          JSON.stringify({
            type: "persisted",
            documentName,
            content: result.content,
            version: result.version,
            updatedAt: result.updatedAt.toISOString(),
            stateChecksum: result.stateChecksum,
          })
        );
      } catch (err) {
        console.error(
          `❌ Failed to persist document "${documentName}" to PostgreSQL:`,
          err instanceof Error ? err.message : err
        );

        // Broadcast persistence error notification to clients
        document.broadcastStateless(
          JSON.stringify({
            type: "persist_error",
            documentName,
            error: err instanceof Error ? err.message : "Persistence failed",
          })
        );
        throw err;
      }
    },

    /**
     * Handle stateless messages from clients (e.g. manual save requests, discard requests, autosave pause/resume).
     */
    async onStateless(data) {
      const { documentName, document, payload, connection } = data;
      const parsed = parseCollabDocumentName(documentName);
      if (!parsed) return;

      try {
        if (!payload || typeof payload !== "string") return;
        const msg = JSON.parse(payload);
        if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;

        // Security check: Client-supplied documentName MUST match the room's authenticated document
        if (msg.documentName && msg.documentName !== documentName) {
          connection.sendStateless(
            JSON.stringify({
              type: "security_error",
              documentName,
              requestId: msg.requestId,
              error: `Document name mismatch: expected "${documentName}", received "${msg.documentName}"`,
            })
          );
          return;
        }

        if (msg.type === "pause_autosave") {
          if (!connection.readOnly) {
            pauseAutoSave(parsed.workspaceId, parsed.fileId);
          }
        } else if (msg.type === "resume_autosave") {
          if (!connection.readOnly) {
            const hadDeferred = resumeAutoSave(parsed.workspaceId, parsed.fileId);
            const currentPending = pendingDirtySeq.get(documentName) ?? 0;
            const currentClean = cleanDirtySeq.get(documentName) ?? 0;
            if (hadDeferred && currentPending > currentClean) {
              const capturedEpoch = getPersistenceEpoch(parsed.workspaceId, parsed.fileId);
              try {
                const result = await storeDocumentToDatabase(
                  parsed.workspaceId,
                  parsed.fileId,
                  document,
                  {
                    expectedEpoch: capturedEpoch,
                    isBackgroundAutoSave: true,
                  }
                );
                if (
                  !result.aborted &&
                  capturedEpoch === getPersistenceEpoch(parsed.workspaceId, parsed.fileId)
                ) {
                  cleanDirtySeq.set(
                    documentName,
                    Math.max(cleanDirtySeq.get(documentName) ?? 0, currentPending)
                  );
                  document.broadcastStateless(
                    JSON.stringify({
                      type: "persisted",
                      documentName,
                      content: result.content,
                      version: result.version,
                      updatedAt: result.updatedAt.toISOString(),
                      stateChecksum: result.stateChecksum,
                    })
                  );
                }
              } catch (resumeErr) {
                console.error(
                  `❌ Failed to resume persistence for "${documentName}":`,
                  resumeErr instanceof Error ? resumeErr.message : resumeErr
                );
                document.broadcastStateless(
                  JSON.stringify({
                    type: "persist_error",
                    documentName,
                    error: resumeErr instanceof Error ? resumeErr.message : "Persistence failed",
                  })
                );
              }
            }
          }
        } else if (msg.type === "save_request") {
          // Reject write operations from read-only connections
          if (connection.readOnly) {
            connection.sendStateless(
              JSON.stringify({
                type: "persist_error",
                documentName,
                requestId: msg.requestId,
                error: "Read-only connection cannot trigger save",
              })
            );
            return;
          }

          resumeAutoSave(parsed.workspaceId, parsed.fileId);
          const capturedPending = pendingDirtySeq.get(documentName) ?? 0;
          const capturedEpoch = getPersistenceEpoch(parsed.workspaceId, parsed.fileId);

          // Trigger immediate persistence to PostgreSQL using the verified document
          const result = await storeDocumentToDatabase(
            parsed.workspaceId,
            parsed.fileId,
            document,
            {
              expectedEpoch: capturedEpoch,
              isBackgroundAutoSave: false,
            }
          );

          if (
            result.aborted ||
            capturedEpoch !== getPersistenceEpoch(parsed.workspaceId, parsed.fileId)
          ) {
            connection.sendStateless(
              JSON.stringify({
                type: "persist_error",
                documentName,
                requestId: msg.requestId,
                error: "Save superseded by discard request",
              })
            );
            return;
          }

          cleanDirtySeq.set(
            documentName,
            Math.max(cleanDirtySeq.get(documentName) ?? 0, capturedPending)
          );

          // Broadcast persistence acknowledgment to all clients in room
          document.broadcastStateless(
            JSON.stringify({
              type: "persisted",
              documentName,
              content: result.content,
              version: result.version,
              updatedAt: result.updatedAt.toISOString(),
              stateChecksum: result.stateChecksum,
              requestId: msg.requestId,
            })
          );
        } else if (msg.type === "discard_request") {
          // Reject discard operations from read-only connections
          if (connection.readOnly) {
            connection.sendStateless(
              JSON.stringify({
                type: "discard_error",
                documentName,
                requestId: msg.requestId,
                error: "Read-only connection cannot discard changes",
              })
            );
            return;
          }

          // GUARD: Reject discard if other collaborators are actively in the session
          // Rolling back a shared document while peers are working erases their legitimate edits
          if (document.getConnectionsCount() > 1) {
            connection.sendStateless(
              JSON.stringify({
                type: "discard_error",
                documentName,
                requestId: msg.requestId,
                error:
                  "Cannot discard changes while other collaborators are actively connected to the session",
              })
            );
            return;
          }

          // Mark current dirty edits clean immediately so any trailing Hocuspocus debounce skips persistence
          cleanDirtySeq.set(documentName, pendingDirtySeq.get(documentName) ?? 0);

          const discardResult = await discardDocumentInQueue(
            parsed.workspaceId,
            parsed.fileId,
            document
          );

          if (!discardResult.found) {
            connection.sendStateless(
              JSON.stringify({
                type: "discard_error",
                documentName,
                requestId: msg.requestId,
                error: "File not found",
              })
            );
            return;
          }

          // Broadcast discarded confirmation to all clients in room
          document.broadcastStateless(
            JSON.stringify({
              type: "discarded",
              documentName,
              version: discardResult.version,
              content: discardResult.content,
              stateChecksum: discardResult.stateChecksum,
              requestId: msg.requestId,
            })
          );
        }
      } catch (err) {
        console.error(`Error handling onStateless for "${documentName}":`, err);
      }
    },

    async afterUnloadDocument(data) {
      const { documentName } = data;
      pendingDirtySeq.delete(documentName);
      cleanDirtySeq.delete(documentName);
      const parsed = parseCollabDocumentName(documentName);
      if (parsed) {
        clearAutoSaveTracking(parsed.workspaceId, parsed.fileId);
      }
    },

    async onDestroy() {
      console.log("👋 CodeSync Collaboration Server stopped.");
    },

    async onConfigure() {
      if (env.NODE_ENV !== "test") {
        console.log("⚙️  Configuring CodeSync Hocuspocus Collaboration Server...");
      }
    },
  });

  return server;
}
