import http from "node:http";
import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";
import { assertTestDatabase, TestFixtureTracker } from "./testDbGuard";

async function runFileTests() {
  console.log("=================================================");
  console.log("🚀 STARTING CHUNK 6 VIRTUAL FILESYSTEM INTEGRATION TESTS");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Connect to DB and initialize app
  await connectDatabase();
  await assertTestDatabase();

  const fixtures = new TestFixtureTracker();
  const app = createApp();

  const server = http.createServer(app);
  const testPort = 4101;

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      console.log(`  📡 Test server listening on http://localhost:${testPort}`);
      resolve();
    });
  });

  async function request(path: string, options: RequestInit = {}) {
    const res = await fetch(`http://localhost:${testPort}${path}`, options);
    const body = (await res.json().catch(() => null)) as Record<string, any> | null;
    return { status: res.status, body, res };
  }

  const timestamp = Date.now();
  const userAEmail = `fileuser-a-${timestamp}@example.com`;
  const userBEmail = `fileuser-b-${timestamp}@example.com`;
  const password = "Password123!";

  let tokenA = "";
  let userIdA = "";
  let tokenB = "";
  let userIdB = "";
  let workspaceAId = "";

  try {
    // -------------------------------------------------------------------------
    // SETUP: Register User A and User B, Create Workspace A
    // -------------------------------------------------------------------------
    console.log("\n--- [SETUP: Users and Workspace Creation] ---");
    const regA = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password, name: "Alice Files" }),
    });
    tokenA = regA.body?.data?.accessToken;
    userIdA = regA.body?.data?.user?.id;
    fixtures.trackUser(userIdA);
    assert(regA.status === 201, "User A registered successfully");

    const regB = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userBEmail, password, name: "Bob Unauthorized" }),
    });
    tokenB = regB.body?.data?.accessToken;
    userIdB = regB.body?.data?.user?.id;
    fixtures.trackUser(userIdB);
    assert(regB.status === 201, "User B registered successfully");

    const wsRes = await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "Filesystem Workspace" }),
    });
    workspaceAId = wsRes.body?.data?.id;
    fixtures.trackWorkspace(workspaceAId);
    assert(wsRes.status === 201, "Workspace A created successfully");

    // -------------------------------------------------------------------------
    // TEST 1: Retrieve empty workspace directory tree
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 1: Empty Directory Tree] ---");
    const emptyTreeRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(emptyTreeRes.status === 200, "Retrieve empty tree returns HTTP 200");
    assert(
      Array.isArray(emptyTreeRes.body?.data?.tree) && emptyTreeRes.body?.data?.tree.length === 0,
      "Empty directory tree contains 0 items"
    );

    // -------------------------------------------------------------------------
    // TEST 2: Create root-level file
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 2: Create Root-Level File] ---");
    const rootFileRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "README.md", parentId: null }),
    });
    assert(rootFileRes.status === 201, "Create root file returns HTTP 201");
    assert(rootFileRes.body?.data?.name === "README.md", "File name is README.md");
    assert(rootFileRes.body?.data?.type === "FILE", "File type is FILE");
    assert(rootFileRes.body?.data?.parentId === null, "File parentId is null");
    const rootFileId = rootFileRes.body?.data?.id;

    // -------------------------------------------------------------------------
    // TEST 3: Create root-level folder
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 3: Create Root-Level Folder] ---");
    const rootFolderRes = await request(`/api/workspaces/${workspaceAId}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "src" }),
    });
    assert(rootFolderRes.status === 201, "Create root folder returns HTTP 201");
    assert(rootFolderRes.body?.data?.name === "src", "Folder name is src");
    assert(rootFolderRes.body?.data?.type === "FOLDER", "Folder type is FOLDER");
    const srcFolderId = rootFolderRes.body?.data?.id;

    // -------------------------------------------------------------------------
    // TEST 4: Create file inside a folder
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 4: Create File Inside Folder] ---");
    const nestedFileRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "index.ts", parentId: srcFolderId }),
    });
    assert(nestedFileRes.status === 201, "Create nested file returns HTTP 201");
    assert(nestedFileRes.body?.data?.name === "index.ts", "Nested file name is index.ts");
    assert(
      nestedFileRes.body?.data?.parentId === srcFolderId,
      "Nested file parentId points to src"
    );
    const indexFileId = nestedFileRes.body?.data?.id;

    // -------------------------------------------------------------------------
    // TEST 5: Create nested folder inside a folder
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 5: Create Nested Subfolder] ---");
    const subfolderRes = await request(`/api/workspaces/${workspaceAId}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "components", parentId: srcFolderId }),
    });
    assert(subfolderRes.status === 201, "Create nested folder returns HTTP 201");
    assert(subfolderRes.body?.data?.name === "components", "Subfolder name is components");
    assert(subfolderRes.body?.data?.parentId === srcFolderId, "Subfolder parentId points to src");
    const componentsFolderId = subfolderRes.body?.data?.id;

    // Add a file inside the subfolder
    const buttonFileRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "Button.tsx", parentId: componentsFolderId }),
    });
    assert(buttonFileRes.status === 201, "Created Button.tsx inside components");
    const buttonFileId = buttonFileRes.body?.data?.id;

    // -------------------------------------------------------------------------
    // TEST 6: Retrieve nested directory tree
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 6: Directory Tree Hierarchy and Ordering] ---");
    const treeRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(treeRes.status === 200, "Directory tree retrieval returns HTTP 200");
    const tree = treeRes.body?.data?.tree;
    assert(Array.isArray(tree) && tree.length === 2, "Root tree has 2 items (src and README.md)");
    // Folders sorted first: src should be index 0, README.md index 1
    assert(
      tree[0]?.name === "src" && tree[0]?.type === "FOLDER",
      "src folder is first (folders first sorting)"
    );
    assert(tree[1]?.name === "README.md" && tree[1]?.type === "FILE", "README.md file is second");
    // Verify children in src
    const srcNode = tree[0];
    assert(
      Array.isArray(srcNode?.children) && srcNode?.children.length === 2,
      "src folder contains 2 children"
    );
    // Inside src: components (FOLDER) first, index.ts (FILE) second
    assert(
      srcNode?.children[0]?.name === "components",
      "components folder sorted first inside src"
    );
    assert(srcNode?.children[1]?.name === "index.ts", "index.ts file sorted second inside src");
    // Inside components: Button.tsx
    const compNode = srcNode?.children[0];
    assert(
      compNode?.children?.length === 1 && compNode?.children[0]?.name === "Button.tsx",
      "Button.tsx correctly nested under components"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Rename a file (Preserves ID, parentId, content)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 7: Rename File] ---");
    const renameFileRes = await request(`/api/files/${indexFileId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "main.ts" }),
    });
    assert(renameFileRes.status === 200, "Rename file returns HTTP 200");
    assert(renameFileRes.body?.data?.name === "main.ts", "File name updated to main.ts");
    assert(renameFileRes.body?.data?.id === indexFileId, "File ID preserved");
    assert(renameFileRes.body?.data?.parentId === srcFolderId, "File parentId preserved");

    // -------------------------------------------------------------------------
    // TEST 8: Rename a folder (Preserves ID, parentId, and descendants)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 8: Rename Folder] ---");
    const renameFolderRes = await request(`/api/files/${componentsFolderId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "ui" }),
    });
    assert(renameFolderRes.status === 200, "Rename folder returns HTTP 200");
    assert(renameFolderRes.body?.data?.name === "ui", "Folder renamed to ui");
    assert(renameFolderRes.body?.data?.id === componentsFolderId, "Folder ID preserved");

    // Verify descendant Button.tsx still points to componentsFolderId
    const buttonInDb = await prisma.file.findUnique({ where: { id: buttonFileId } });
    assert(
      buttonInDb?.parentId === componentsFolderId,
      "Descendant Button.tsx still has correct parentId"
    );

    // -------------------------------------------------------------------------
    // TEST 9: Duplicate sibling names rejection (case-insensitive)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 9: Sibling Uniqueness Checks] ---");
    const dupRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "MAIN.TS", parentId: srcFolderId }),
    });
    assert(
      dupRes.status === 409,
      "Duplicate sibling name (case-insensitive) rejected with HTTP 409"
    );
    assert(dupRes.body?.code === "DUPLICATE_NAME", "Error code is DUPLICATE_NAME");

    // Same name in a DIFFERENT folder is allowed
    const diffFolderFileRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "main.ts", parentId: null }),
    });
    assert(
      diffFolderFileRes.status === 201,
      "Identical name in a different folder/root is allowed (HTTP 201)"
    );
    const rootMainId = diffFolderFileRes.body?.data?.id;

    // -------------------------------------------------------------------------
    // TEST 10: Move a file to another folder and to root
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 10: Move File] ---");
    // Move main.ts from src into ui folder
    const moveFileRes = await request(`/api/files/${indexFileId}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ targetParentId: componentsFolderId }),
    });
    assert(moveFileRes.status === 200, "Move file to ui folder returns HTTP 200");
    assert(moveFileRes.body?.data?.parentId === componentsFolderId, "File parentId updated to ui");
    assert(moveFileRes.body?.data?.id === indexFileId, "File ID preserved after move");

    // Move file back to root
    const moveToRootRes = await request(`/api/files/${indexFileId}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ targetParentId: null }),
    });
    // Oh wait! At root, there is already rootMainId ("main.ts"), so moving main.ts to root should reject with 409!
    assert(
      moveToRootRes.status === 409,
      "Moving file to root with sibling name collision rejected with HTTP 409"
    );

    // Clean up rootMainId
    await prisma.file.delete({ where: { id: rootMainId } });

    // Now moving main.ts to root should succeed
    const moveToRootSucceed = await request(`/api/files/${indexFileId}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ targetParentId: null }),
    });
    assert(moveToRootSucceed.status === 200, "Moving file to root succeeds after conflict cleared");
    assert(moveToRootSucceed.body?.data?.parentId === null, "File parentId is now null");

    // -------------------------------------------------------------------------
    // TEST 11: Circular folder nesting prevention
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 11: Circular Folder Nesting Prevention] ---");
    // Move folder into itself
    const moveSelfRes = await request(`/api/files/${srcFolderId}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ targetParentId: srcFolderId }),
    });
    assert(moveSelfRes.status === 400, "Moving folder into itself rejected with HTTP 400");
    assert(
      moveSelfRes.body?.code === "CANNOT_MOVE_INTO_SELF",
      "Error code is CANNOT_MOVE_INTO_SELF"
    );

    // Move folder into its own descendant (moving src into ui)
    const moveDescendantRes = await request(`/api/files/${srcFolderId}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ targetParentId: componentsFolderId }),
    });
    assert(
      moveDescendantRes.status === 400,
      "Moving folder into its descendant rejected with HTTP 400"
    );
    assert(
      moveDescendantRes.body?.code === "CIRCULAR_NESTING_DETECTED",
      "Error code is CIRCULAR_NESTING_DETECTED"
    );

    // Attempt to use a FILE as a parent
    const moveIntoFileRes = await request(`/api/files/${componentsFolderId}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ targetParentId: rootFileId }),
    });
    assert(moveIntoFileRes.status === 400, "Using file as parent rejected with HTTP 400");
    assert(
      moveIntoFileRes.body?.code === "DESTINATION_NOT_FOLDER",
      "Error code is DESTINATION_NOT_FOLDER"
    );

    // -------------------------------------------------------------------------
    // TEST 12: Delete single file
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 12: Delete Single File] ---");
    const deleteFileRes = await request(`/api/files/${indexFileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(deleteFileRes.status === 200, "Delete file returns HTTP 200");
    const checkDeleted = await prisma.file.findUnique({ where: { id: indexFileId } });
    assert(checkDeleted === null, "File removed from database");

    // -------------------------------------------------------------------------
    // TEST 13: Recursive folder deletion
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 13: Recursive Folder Deletion] ---");
    // src contains ui, and ui contains Button.tsx
    const deleteFolderRes = await request(`/api/files/${srcFolderId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(deleteFolderRes.status === 200, "Delete folder returns HTTP 200");

    const checkSrc = await prisma.file.findUnique({ where: { id: srcFolderId } });
    assert(checkSrc === null, "src folder removed from database");

    const checkUi = await prisma.file.findUnique({ where: { id: componentsFolderId } });
    assert(checkUi === null, "Nested ui subfolder cascade-deleted");

    const checkButton = await prisma.file.findUnique({ where: { id: buttonFileId } });
    assert(checkButton === null, "Deeply nested Button.tsx cascade-deleted");

    // Verify root README.md still exists untouched
    const checkReadme = await prisma.file.findUnique({ where: { id: rootFileId } });
    assert(checkReadme !== null, "Unrelated sibling README.md remained intact");

    // -------------------------------------------------------------------------
    // TEST 14: Security & Cross-Workspace Isolation (User B)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 14: Cross-Workspace Security & Authorization] ---");
    // User B tries to view Workspace A's files
    const bViewRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(bViewRes.status === 403, "User B viewing Workspace A files returns HTTP 403");

    // User B tries to create file in Workspace A
    const bCreateRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ name: "hack.js" }),
    });
    assert(bCreateRes.status === 403, "User B creating file in Workspace A returns HTTP 403");

    // User B tries to rename User A's file
    const bRenameRes = await request(`/api/files/${rootFileId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ name: "hacked.md" }),
    });
    assert(bRenameRes.status === 403, "User B renaming User A's file returns HTTP 403");

    // User B tries to delete User A's file
    const bDeleteRes = await request(`/api/files/${rootFileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(bDeleteRes.status === 403, "User B deleting User A's file returns HTTP 403");

    // User B tries to move User A's file
    const bMoveRes = await request(`/api/files/${rootFileId}/move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ targetParentId: null }),
    });
    assert(bMoveRes.status === 403, "User B moving User A's file returns HTTP 403");

    // -------------------------------------------------------------------------
    // TEST 15: Input Validation Guards
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 15: Filename Validation Guards] ---");
    // Path separators in name
    const pathSepRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "bad/file.ts" }),
    });
    assert(pathSepRes.status === 400, "Filename with '/' rejected with HTTP 400");

    const backslashRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "bad\\file.ts" }),
    });
    assert(backslashRes.status === 400, "Filename with '\\' rejected with HTTP 400");

    // Dot names
    const dotRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: ".." }),
    });
    assert(dotRes.status === 400, "Filename '..' rejected with HTTP 400");
  } catch (error) {
    console.error("❌ Unexpected error in file test:", error);
    failed++;
  } finally {
    console.log("\n--- [CLEANUP: Tracked Fixtures] ---");
    try {
      await fixtures.cleanup();
      await fixtures.verifyCleanup();
    } catch (cleanupErr) {
      console.error("❌ Cleanup failed:", cleanupErr);
      failed++;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  }

  console.log("\n=================================================");
  console.log(`📊 FILESYSTEM TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runFileTests();
