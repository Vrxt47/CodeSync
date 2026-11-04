import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";
import http from "node:http";
import { assertTestDatabase, TestFixtureTracker } from "./testDbGuard";

async function runEntryFlowTests() {
  console.log("=================================================");
  console.log("🧪 STARTING APPLICATION ENTRY FLOW & ROUTING TESTS");
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

  await connectDatabase();
  await assertTestDatabase(prisma);
  const fixtures = new TestFixtureTracker(prisma);
  const app = createApp();
  const server = http.createServer(app);
  const testPort = 4103;

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      console.log(`  📡 API server listening on http://localhost:${testPort}`);
      resolve();
    });
  });

  async function request(path: string, options: RequestInit = {}) {
    const res = await fetch(`http://localhost:${testPort}${path}`, options);
    const body = (await res.json().catch(() => null)) as Record<string, any> | null;
    return { status: res.status, body, res };
  }

  const timestamp = Date.now();
  const userAEmail = `entry-user-a-${timestamp}@example.com`;
  const userBEmail = `entry-user-b-${timestamp}@example.com`;
  const password = "Password123!";

  let tokenA = "";
  let userIdA = "";
  let workspaceAId = "";

  let tokenB = "";
  let userIdB = "";

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated Backend Rejection
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 1: Unauthenticated API Access] ---");
    const unauthMe = await request("/api/auth/me");
    assert(unauthMe.status === 401, "GET /api/auth/me unauthenticated rejected with 401");

    const unauthWorkspaces = await request("/api/workspaces");
    assert(
      unauthWorkspaces.status === 401,
      "GET /api/workspaces unauthenticated rejected with 401"
    );

    const unauthTree = await request("/api/workspaces/e18de66e-5fb9-4029-81d2-c1f880642c7a/tree");
    assert(
      unauthTree.status === 401,
      "GET /api/workspaces/:id/tree unauthenticated rejected with 401"
    );

    // -------------------------------------------------------------------------
    // TEST 2: User A Registration & Empty Workspace State
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 2: User A Registration & No Auto-Created Workspace] ---");
    const regA = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password, name: "User Alpha" }),
    });
    tokenA = regA.body?.data?.accessToken;
    userIdA = regA.body?.data?.user?.id;
    if (userIdA) fixtures.trackUser(userIdA);
    assert(regA.status === 201, "User A registered successfully");
    assert(!!tokenA, "Access token received for User A");

    // Verify User A starts with 0 workspaces (no demo workspace auto-created!)
    const listAInitial = await request("/api/workspaces", {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(listAInitial.status === 200, "User A listed workspaces");
    assert(
      Array.isArray(listAInitial.body?.data) && listAInitial.body?.data.length === 0,
      `User A has 0 workspaces initially (no auto-created demo workspace!), got ${listAInitial.body?.data?.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Workspace Creation & Initial Empty Filesystem
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 3: User A Creates Workspace & Initial Empty Filesystem] ---");
    const createWs = await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "Alpha Codebase", description: "Alpha's private project" }),
    });
    workspaceAId = createWs.body?.data?.id;
    if (workspaceAId) fixtures.trackWorkspace(workspaceAId);
    assert(createWs.status === 201, "Workspace created successfully");
    assert(createWs.body?.data?.name === "Alpha Codebase", "Workspace name is correct");

    // Directory tree of new workspace must be empty (no mock files!)
    const treeAInitial = await request(`/api/workspaces/${workspaceAId}/tree`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(treeAInitial.status === 200, "Retrieved workspace tree");
    assert(
      Array.isArray(treeAInitial.body?.data?.tree) && treeAInitial.body?.data?.tree.length === 0,
      `New workspace has strictly 0 files initially, got ${treeAInitial.body?.data?.tree?.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Persistent File & Folder Creation in User Workspace
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 4: File and Folder Creation] ---");
    const createFolderRes = await request(`/api/workspaces/${workspaceAId}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "src", parentId: null }),
    });
    const srcFolderId = createFolderRes.body?.data?.id;
    assert(createFolderRes.status === 201, "Folder 'src' created in workspace");

    const createFileRes = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "main.ts", parentId: srcFolderId }),
    });
    assert(createFileRes.status === 201, "File 'src/main.ts' created in workspace");

    const treeAAfterCreate = await request(`/api/workspaces/${workspaceAId}/tree`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const tree = treeAAfterCreate.body?.data?.tree;
    assert(
      Array.isArray(tree) &&
        tree.length === 1 &&
        tree[0].name === "src" &&
        tree[0].children?.length === 1 &&
        tree[0].children[0].name === "main.ts",
      "Real workspace tree contains exactly the created records"
    );

    // -------------------------------------------------------------------------
    // TEST 5: User Isolation (User B cannot access User A's workspace)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 5: Cross-User Workspace Isolation] ---");
    const regB = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userBEmail, password, name: "User Beta" }),
    });
    tokenB = regB.body?.data?.accessToken;
    userIdB = regB.body?.data?.user?.id;
    if (userIdB) fixtures.trackUser(userIdB);
    assert(regB.status === 201, "User B registered successfully");

    const listB = await request("/api/workspaces", {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(listB.body?.data?.length === 0, "User B sees 0 workspaces (isolated from User A)");

    // User B attempting to access User A's workspace
    const userBAccessA = await request(`/api/workspaces/${workspaceAId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(userBAccessA.status === 403, "User B cannot access User A's workspace (403 Forbidden)");

    const userBTreeA = await request(`/api/workspaces/${workspaceAId}/tree`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(
      userBTreeA.status === 403,
      "User B cannot access User A's workspace tree (403 Forbidden)"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Logout and Session Invalidation
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 6: Logout Session Invalidation] ---");
    const logoutA = await request("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(logoutA.status === 200, "User A logged out successfully");

    const refreshAAfterLogout = await request("/api/auth/refresh", {
      method: "POST",
    });
    assert(
      refreshAAfterLogout.status === 401,
      "Refresh after logout is rejected (session invalidated)"
    );
  } finally {
    // CLEANUP
    console.log("\n--- [CLEANUP] ---");
    try {
      await fixtures.cleanup();
      await fixtures.verifyCleanup();
    } catch (cleanupErr) {
      console.error("  ❌ Cleanup error:", cleanupErr);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  }

  console.log("\n=================================================");
  console.log(`📊 ENTRY FLOW TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runEntryFlowTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
