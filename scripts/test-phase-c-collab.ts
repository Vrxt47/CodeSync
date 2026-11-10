/**
 * Phase C Collaboration Architecture Integration & Unit Test Suite
 *
 * Verifies:
 * 1. Authentication & JWT signature/expiration validation
 * 2. Workspace & file authorization (OWNER, EDITOR, VIEWER, Stranger)
 * 3. Document name syntax & cross-workspace isolation
 * 4. Folder document rejection
 * 5. Initial document seeding from PostgreSQL plain text
 * 6. Intentionally empty file handling & idempotency
 * 7. Yjs binary state persistence to PostgreSQL (BYTEA column)
 * 8. Plain-text compatibility (File.content kept in sync for REST consumers)
 * 9. Lossless CRDT state restoration after simulated server restart
 * 10. Server-side VIEWER read-only enforcement
 */

import jwt from "../apps/collaboration/node_modules/jsonwebtoken";
import * as Y from "../apps/collaboration/node_modules/yjs";
import { Document } from "../apps/collaboration/node_modules/@hocuspocus/server";
import { prisma } from "../packages/database/src";
import { env } from "../apps/collaboration/src/config/env";
import {
  formatCollabDocumentName,
  parseCollabDocumentName,
} from "../apps/collaboration/src/utils/document.utils";
import {
  authorizeCollabConnection,
  verifyCollabToken,
} from "../apps/collaboration/src/services/auth.service";
import {
  loadDocumentFromDatabase,
  storeDocumentToDatabase,
} from "../apps/collaboration/src/services/persistence.service";

interface TestContext {
  passed: number;
  failed: number;
  total: number;
}

const ctx: TestContext = { passed: 0, failed: 0, total: 0 };

function assert(condition: boolean, testName: string, details?: string): void {
  ctx.total++;
  if (condition) {
    ctx.passed++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    ctx.failed++;
    console.error(`  ✗ [FAIL] ${testName}${details ? ` -> ${details}` : ""}`);
  }
}

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("🚀 CodeSync Phase C: Collaboration Persistence & Auth Tests");
  console.log("=======================================================\n");

  // Safety Guard: verify test database
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl.includes("codesync_test")) {
    console.error(`❌ FATAL SAFETY GUARD: DATABASE_URL must point to codesync_test, got: ${dbUrl}`);
    process.exit(1);
  }

  // Track created fixtures for deterministic cleanup
  const fixtureUserIds: string[] = [];
  const fixtureWorkspaceIds: string[] = [];
  const fixtureFileIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // Setup Test Fixtures in Database
    // -------------------------------------------------------------------------
    console.log("--- Setting up database fixtures in codesync_test ---");

    // 1. Create Users (Owner, Editor, Viewer, Stranger)
    const owner = await prisma.user.create({
      data: {
        name: "Owner User",
        email: `owner-${Date.now()}@example.com`,
        passwordHash: "hash-owner",
      },
    });
    fixtureUserIds.push(owner.id);

    const editor = await prisma.user.create({
      data: {
        name: "Editor User",
        email: `editor-${Date.now()}@example.com`,
        passwordHash: "hash-editor",
      },
    });
    fixtureUserIds.push(editor.id);

    const viewer = await prisma.user.create({
      data: {
        name: "Viewer User",
        email: `viewer-${Date.now()}@example.com`,
        passwordHash: "hash-viewer",
      },
    });
    fixtureUserIds.push(viewer.id);

    const stranger = await prisma.user.create({
      data: {
        name: "Stranger User",
        email: `stranger-${Date.now()}@example.com`,
        passwordHash: "hash-stranger",
      },
    });
    fixtureUserIds.push(stranger.id);

    // 2. Create Workspace 1 (owned by Owner)
    const workspace1 = await prisma.workspace.create({
      data: {
        name: "Test Collab Workspace 1",
        ownerId: owner.id,
      },
    });
    fixtureWorkspaceIds.push(workspace1.id);

    // Add Editor and Viewer memberships to Workspace 1
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace1.id,
        userId: editor.id,
        role: "EDITOR",
      },
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace1.id,
        userId: viewer.id,
        role: "VIEWER",
      },
    });

    // 3. Create Workspace 2 (owned by Stranger)
    const workspace2 = await prisma.workspace.create({
      data: {
        name: "Test Collab Workspace 2",
        ownerId: stranger.id,
      },
    });
    fixtureWorkspaceIds.push(workspace2.id);

    // 4. Create Files in Workspace 1
    const file1 = await prisma.file.create({
      data: {
        workspaceId: workspace1.id,
        name: "main.js",
        type: "FILE",
        content: "console.log('initial baseline content');",
        version: 1,
      },
    });
    fixtureFileIds.push(file1.id);

    const emptyFile = await prisma.file.create({
      data: {
        workspaceId: workspace1.id,
        name: "empty.py",
        type: "FILE",
        content: "",
        version: 1,
      },
    });
    fixtureFileIds.push(emptyFile.id);

    const folder1 = await prisma.file.create({
      data: {
        workspaceId: workspace1.id,
        name: "src",
        type: "FOLDER",
        content: "",
      },
    });
    fixtureFileIds.push(folder1.id);

    // 5. Create File in Workspace 2
    const fileOther = await prisma.file.create({
      data: {
        workspaceId: workspace2.id,
        name: "other.js",
        type: "FILE",
        content: "console.log('workspace 2 file');",
      },
    });
    fixtureFileIds.push(fileOther.id);

    // 6. Generate JWT tokens
    const secret = env.JWT_ACCESS_SECRET;
    const ownerToken = jwt.sign({ userId: owner.id, email: owner.email }, secret, {
      expiresIn: "1h",
    });
    const editorToken = jwt.sign({ userId: editor.id, email: editor.email }, secret, {
      expiresIn: "1h",
    });
    const viewerToken = jwt.sign({ userId: viewer.id, email: viewer.email }, secret, {
      expiresIn: "1h",
    });
    const strangerToken = jwt.sign({ userId: stranger.id, email: stranger.email }, secret, {
      expiresIn: "1h",
    });
    const expiredToken = jwt.sign({ userId: owner.id, email: owner.email }, secret, {
      expiresIn: "-10s",
    });
    const wrongSecretToken = jwt.sign(
      { userId: owner.id, email: owner.email },
      "wrong-secret-key",
      {
        expiresIn: "1h",
      }
    );

    console.log("  ✓ Fixtures established successfully.\n");

    // -------------------------------------------------------------------------
    // SECTION 1: Token Verification & Authentication
    // -------------------------------------------------------------------------
    console.log("--- Section 1: Authentication & Token Verification ---");
    {
      const verified = verifyCollabToken(ownerToken);
      assert(verified.userId === owner.id, "Valid JWT verified and userId extracted correctly");

      let missingTokenThrew = false;
      try {
        verifyCollabToken("");
      } catch (err: any) {
        missingTokenThrew = err.message.includes("missing or invalid");
      }
      assert(missingTokenThrew, "Missing token rejected with descriptive error");

      let expiredThrew = false;
      try {
        verifyCollabToken(expiredToken);
      } catch (err: any) {
        expiredThrew = err.message.includes("expired");
      }
      assert(expiredThrew, "Expired token rejected with expired message");

      let wrongSecretThrew = false;
      try {
        verifyCollabToken(wrongSecretToken);
      } catch (err: any) {
        wrongSecretThrew = err.message.includes("invalid token signature");
      }
      assert(wrongSecretThrew, "Token signed with invalid secret rejected");
    }

    // -------------------------------------------------------------------------
    // SECTION 2: Document Naming Validation
    // -------------------------------------------------------------------------
    console.log("\n--- Section 2: Document Naming Validation ---");
    {
      const validName = formatCollabDocumentName(workspace1.id, file1.id);
      const parsed = parseCollabDocumentName(validName);

      assert(parsed !== null, "Canonical document name parsed successfully");
      assert(parsed?.workspaceId === workspace1.id, "Workspace UUID extracted accurately");
      assert(parsed?.fileId === file1.id, "File UUID extracted accurately");

      assert(
        parseCollabDocumentName("workspace:invalid-uuid:file:invalid-uuid") === null,
        "Rejects non-UUID strings"
      );
      assert(
        parseCollabDocumentName("invalid-format") === null,
        "Rejects malformed document names"
      );
      assert(
        parseCollabDocumentName(`workspace:${workspace1.id}`) === null,
        "Rejects missing file parameter"
      );
    }

    // -------------------------------------------------------------------------
    // SECTION 3: Authorization & Role Enforcement
    // -------------------------------------------------------------------------
    console.log("\n--- Section 3: Authorization & RBAC Enforcement ---");
    {
      const docName = formatCollabDocumentName(workspace1.id, file1.id);

      // 1. OWNER permission
      const ownerAuth = await authorizeCollabConnection(ownerToken, docName);
      assert(ownerAuth.role === "OWNER", "Owner authenticated as OWNER");
      assert(ownerAuth.readOnly === false, "Owner has read-write access (readOnly = false)");

      // 2. EDITOR permission
      const editorAuth = await authorizeCollabConnection(editorToken, docName);
      assert(editorAuth.role === "EDITOR", "Editor member authenticated as EDITOR");
      assert(editorAuth.readOnly === false, "Editor has read-write access (readOnly = false)");

      // 3. VIEWER permission
      const viewerAuth = await authorizeCollabConnection(viewerToken, docName);
      assert(viewerAuth.role === "VIEWER", "Viewer member authenticated as VIEWER");
      assert(
        viewerAuth.readOnly === true,
        "Viewer strictly restricted to read-only mode (readOnly = true)"
      );

      // 4. Non-member / Stranger rejection
      let strangerRejected = false;
      try {
        await authorizeCollabConnection(strangerToken, docName);
      } catch (err: any) {
        strangerRejected = err.message.includes("not a member");
      }
      assert(strangerRejected, "Unauthorized non-member user rejected from workspace room");

      // 5. Cross-workspace file access rejection
      const crossWorkspaceDoc = formatCollabDocumentName(workspace1.id, fileOther.id);
      let crossWsRejected = false;
      try {
        await authorizeCollabConnection(ownerToken, crossWorkspaceDoc);
      } catch (err: any) {
        crossWsRejected = err.message.includes("not found in workspace");
      }
      assert(crossWsRejected, "Attempt to access file belonging to another workspace rejected");

      // 6. Folder rejection
      const folderDoc = formatCollabDocumentName(workspace1.id, folder1.id);
      let folderRejected = false;
      try {
        await authorizeCollabConnection(ownerToken, folderDoc);
      } catch (err: any) {
        folderRejected = err.message.includes("folder");
      }
      assert(folderRejected, "Attempt to open a folder document strictly rejected");
    }

    // -------------------------------------------------------------------------
    // SECTION 4: Document Initialization (onLoadDocument)
    // -------------------------------------------------------------------------
    console.log("\n--- Section 4: Document Initialization (onLoadDocument) ---");
    {
      // 1. First-time seeding from existing PostgreSQL content
      const doc = new Document("workspace:w1:file:f1");
      const loadRes = await loadDocumentFromDatabase(workspace1.id, file1.id, doc);

      assert(
        loadRes.seededFromPlainText === true,
        "First-time load seeds from existing File.content"
      );
      assert(
        loadRes.restoredFromYjs === false,
        "First-time load recognizes absence of prior Yjs binary state"
      );
      assert(
        doc.getText("monaco").toString() === "console.log('initial baseline content');",
        "Y.Text('monaco') matches exact database content"
      );
      assert(
        doc.getMap("_metadata").get("initialized") === true,
        "Document marked with initialized = true in metadata"
      );

      // 2. Idempotency & Concurrent initialization guard
      const secondLoad = await loadDocumentFromDatabase(workspace1.id, file1.id, doc);
      assert(
        secondLoad.seededFromPlainText === false,
        "Second call to loadDocument skips seeding (prevents duplicate insertion)"
      );
      assert(
        doc.getText("monaco").toString() === "console.log('initial baseline content');",
        "Document content intact with zero duplicate text prepended"
      );

      // 3. Intentionally empty file initialization
      const emptyDoc = new Document("workspace:w1:file:empty");
      const emptyLoad = await loadDocumentFromDatabase(workspace1.id, emptyFile.id, emptyDoc);
      assert(
        emptyDoc.getText("monaco").toString() === "",
        "Empty file correctly initializes with empty Y.Text"
      );
      assert(
        emptyDoc.getMap("_metadata").get("initialized") === true,
        "Empty file properly flagged as initialized (not confused with missing state)"
      );

      doc.destroy();
      emptyDoc.destroy();
    }

    // -------------------------------------------------------------------------
    // SECTION 5: Document Persistence (onStoreDocument)
    // -------------------------------------------------------------------------
    console.log("\n--- Section 5: Document Persistence & Plain-Text Compatibility ---");
    {
      const doc = new Document("workspace:w1:file:f1");
      await loadDocumentFromDatabase(workspace1.id, file1.id, doc);

      // Simulate collaborative edits inside Y.Text
      const ytext = doc.getText("monaco");
      ytext.insert(ytext.length, "\nconst collabVar = 42;");

      const storeRes = await storeDocumentToDatabase(workspace1.id, file1.id, doc);
      assert(storeRes.version === 2, "File.version incremented on store (1 -> 2)");
      assert(storeRes.byteSize > 0, "Yjs state encoded and has non-zero byte size");

      // Verify PostgreSQL database row directly
      const dbFile = await prisma.file.findUnique({
        where: { id: file1.id },
      });

      assert(dbFile !== null, "File found in PostgreSQL database");
      assert(
        dbFile?.content === "console.log('initial baseline content');\nconst collabVar = 42;",
        "Plain-text File.content in PostgreSQL updated for REST compatibility"
      );
      assert(dbFile?.yjsState !== null, "Authoritative yjs_state BYTEA stored in PostgreSQL");
      assert((dbFile?.yjsState?.length ?? 0) > 0, "BYTEA field contains valid binary buffer");
      assert(dbFile?.version === 2, "Database version column is 2");

      doc.destroy();
    }

    // -------------------------------------------------------------------------
    // SECTION 6: Simulated Server Restart & Lossless CRDT Restoration
    // -------------------------------------------------------------------------
    console.log("\n--- Section 6: Server Restart & CRDT State Restoration ---");
    {
      // Create a brand new Yjs Document in clean memory (simulating cold server reboot)
      const freshDoc = new Document("workspace:w1:file:f1");

      const reloadRes = await loadDocumentFromDatabase(workspace1.id, file1.id, freshDoc);
      assert(
        reloadRes.restoredFromYjs === true,
        "Cold load restores directly from binary yjs_state"
      );
      assert(reloadRes.seededFromPlainText === false, "Did not fall back to plain-text seeding");
      assert(
        freshDoc.getText("monaco").toString() ===
          "console.log('initial baseline content');\nconst collabVar = 42;",
        "Losslessly restored exact collaborative document state from PostgreSQL"
      );

      // Further edits after restart
      freshDoc.getText("monaco").insert(0, "// Server Restarted\n");
      const postRestartStore = await storeDocumentToDatabase(workspace1.id, file1.id, freshDoc);
      assert(postRestartStore.version === 3, "Version incremented again post-restart (2 -> 3)");

      const reloadedDbFile = await prisma.file.findUnique({
        where: { id: file1.id },
      });

      assert(
        reloadedDbFile?.content.startsWith("// Server Restarted\n"),
        "Post-restart edits successfully stored in PostgreSQL"
      );

      freshDoc.destroy();
    }

    // -------------------------------------------------------------------------
    // SECTION 7: Sequential & Concurrent Persistence Robustness
    // -------------------------------------------------------------------------
    console.log("\n--- Section 7: Concurrent Persistence Robustness ---");
    {
      const doc = new Document("workspace:w1:file:f1");
      await loadDocumentFromDatabase(workspace1.id, file1.id, doc);

      // Perform rapid sequential updates
      doc.getText("monaco").insert(0, "// update 1\n");
      const s1 = await storeDocumentToDatabase(workspace1.id, file1.id, doc);

      doc.getText("monaco").insert(0, "// update 2\n");
      const s2 = await storeDocumentToDatabase(workspace1.id, file1.id, doc);

      assert(s2.version > s1.version, "Monotonic version progression under sequential stores");

      doc.destroy();
    }
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup Tracked Database Fixtures
    // -------------------------------------------------------------------------
    console.log("\n--- Cleaning up test fixtures in codesync_test ---");
    try {
      if (fixtureFileIds.length > 0) {
        await prisma.file.deleteMany({
          where: { id: { in: fixtureFileIds } },
        });
      }
      if (fixtureWorkspaceIds.length > 0) {
        await prisma.workspaceMember.deleteMany({
          where: { workspaceId: { in: fixtureWorkspaceIds } },
        });
        await prisma.workspace.deleteMany({
          where: { id: { in: fixtureWorkspaceIds } },
        });
      }
      if (fixtureUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: fixtureUserIds } },
        });
      }
      console.log("  🧹 Fixtures cleaned up successfully.");
    } catch (cleanupErr) {
      console.error("  ⚠️ Warning during test fixture cleanup:", cleanupErr);
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`Phase C Test Results: ${ctx.passed}/${ctx.total} passed (${ctx.failed} failed)`);
  console.log("=======================================================\n");

  if (ctx.failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

void runTestSuite();
