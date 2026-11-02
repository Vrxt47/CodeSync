import http from "node:http";
import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";

async function runWorkspaceTests() {
  console.log("=================================================");
  console.log("🚀 STARTING CHUNK 5 WORKSPACE INTEGRATION TESTS");
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
  const app = createApp();

  const server = http.createServer(app);
  const testPort = 4099;

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
  const userAEmail = `usera-${timestamp}@example.com`;
  const userBEmail = `userb-${timestamp}@example.com`;
  const password = "Password123!";

  let tokenA = "";
  let userIdA = "";
  let tokenB = "";
  let userIdB = "";
  let workspaceAId = "";
  let workspaceBId = "";

  try {
    // -------------------------------------------------------------------------
    // SETUP: Register User A and User B
    // -------------------------------------------------------------------------
    console.log("\n--- [SETUP: Users Creation] ---");
    const regA = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userAEmail,
        password,
        name: "Alice Owner",
      }),
    });
    assert(regA.status === 201, "User A registered successfully");
    tokenA = regA.body?.data?.accessToken;
    userIdA = regA.body?.data?.user?.id;

    const regB = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userBEmail,
        password,
        name: "Bob Collaborator",
      }),
    });
    assert(regB.status === 201, "User B registered successfully");
    tokenB = regB.body?.data?.accessToken;
    userIdB = regB.body?.data?.user?.id;

    // -------------------------------------------------------------------------
    // TEST 1: User A Creates Workspace (POST /api/workspaces)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 1: Workspace Creation] ---");
    const wsName = "Project Alpha";
    const wsDesc = "Alpha collaborative development workspace";
    const createRes = await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: wsName,
        description: wsDesc,
      }),
    });

    assert(createRes.status === 201, "Workspace created returns HTTP 201");
    assert(createRes.body?.success === true, "Response reports success = true");
    assert(createRes.body?.data?.name === wsName, "Workspace name matches input");
    assert(createRes.body?.data?.description === wsDesc, "Workspace description matches input");
    assert(createRes.body?.data?.role === "OWNER", "User A has role OWNER");
    assert(createRes.body?.data?.memberCount === 1, "Member count is 1");
    assert(createRes.body?.data?.owner?.email === userAEmail, "Owner email matches User A");
    workspaceAId = createRes.body?.data?.id;

    // Verify DB records
    const memberInDb = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceAId,
          userId: userIdA,
        },
      },
    });
    assert(
      memberInDb?.role === "OWNER",
      "Database contains WorkspaceMember record with OWNER role"
    );

    const activityInDb = await prisma.activityLog.findFirst({
      where: {
        workspaceId: workspaceAId,
        action: "WORKSPACE_CREATED",
      },
    });
    assert(activityInDb !== null, "Database contains ActivityLog WORKSPACE_CREATED");
    assert(
      (activityInDb?.metadata as any)?.name === wsName,
      "ActivityLog metadata contains workspace name"
    );

    // -------------------------------------------------------------------------
    // TEST 2: Workspace Isolation (User B cannot see User A's workspace in list)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 2: Workspace Isolation & Listing] ---");
    const listBBefore = await request("/api/workspaces", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(listBBefore.status === 200, "User B lists workspaces returns HTTP 200");
    assert(
      Array.isArray(listBBefore.body?.data) && listBBefore.body?.data.length === 0,
      "User B initially has 0 workspaces (User A's workspace is isolated)"
    );

    // User B creates workspace B
    const createBRes = await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        name: "Project Beta",
        description: "Bob's private project",
      }),
    });
    assert(createBRes.status === 201, "User B creates workspace Beta");
    workspaceBId = createBRes.body?.data?.id;

    const listBAfter = await request("/api/workspaces", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(listBAfter.body?.data?.length === 1, "User B sees exactly 1 workspace");
    assert(listBAfter.body?.data[0]?.id === workspaceBId, "User B sees only workspace Beta");

    // -------------------------------------------------------------------------
    // TEST 3: Access Control on Details (User B accesses User A's workspace -> 403)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 3: Non-Member Access Rejection] ---");
    const forbiddenRes = await request(`/api/workspaces/${workspaceAId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(forbiddenRes.status === 403, "User B accessing User A's workspace returns HTTP 403");
    assert(
      forbiddenRes.body?.code === "WORKSPACE_ACCESS_DENIED",
      "Error code is WORKSPACE_ACCESS_DENIED"
    );

    // -------------------------------------------------------------------------
    // TEST 4: Workspace Details & lastAccessedAt Update
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 4: Workspace Details & lastAccessedAt Update] ---");
    const initialWorkspace = await prisma.workspace.findUnique({
      where: { id: workspaceAId },
    });
    const initialLastAccessed = initialWorkspace?.lastAccessedAt;

    // Small delay to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 50));

    const detailsRes = await request(`/api/workspaces/${workspaceAId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(detailsRes.status === 200, "User A gets workspace details returns HTTP 200");
    assert(detailsRes.body?.data?.id === workspaceAId, "Workspace ID matches");
    assert(
      detailsRes.body?.data?.lastAccessedAt !== null,
      "lastAccessedAt is returned and not null"
    );

    const updatedWorkspace = await prisma.workspace.findUnique({
      where: { id: workspaceAId },
    });
    assert(
      updatedWorkspace?.lastAccessedAt !== null &&
        updatedWorkspace?.lastAccessedAt !== initialLastAccessed,
      "Database last_accessed_at column was updated upon detail retrieval"
    );

    // -------------------------------------------------------------------------
    // TEST 5: Search Workspaces (?search=)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 5: Workspace Search Query] ---");
    // User A creates another workspace for search testing
    await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: "Gamma Service Backend",
        description: "Microservice repository",
      }),
    });

    const searchResAlpha = await request("/api/workspaces?search=alpha", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(searchResAlpha.status === 200, "Search query returns HTTP 200");
    assert(
      searchResAlpha.body?.data?.length === 1 &&
        searchResAlpha.body?.data[0]?.name === "Project Alpha",
      "Case-insensitive search 'alpha' matches only 'Project Alpha'"
    );

    const searchResNoMatch = await request("/api/workspaces?search=nonexistent_xyz", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(
      searchResNoMatch.body?.data?.length === 0,
      "Search query with no matches returns empty array"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Non-Owner Permission Restrictions (Rename & Delete)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 6: Non-Owner Permission Restrictions] ---");
    // Add User B as EDITOR to Workspace A
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspaceAId,
        userId: userIdB,
        role: "EDITOR",
      },
    });

    // User B attempts to rename Workspace A
    const unauthorizedRename = await request(`/api/workspaces/${workspaceAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        name: "Hacked Alpha Name",
      }),
    });
    assert(unauthorizedRename.status === 403, "EDITOR attempting rename returns HTTP 403");
    assert(
      unauthorizedRename.body?.code === "OWNER_PERMISSION_REQUIRED",
      "Error code is OWNER_PERMISSION_REQUIRED"
    );

    // User B attempts to delete Workspace A
    const unauthorizedDelete = await request(`/api/workspaces/${workspaceAId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(unauthorizedDelete.status === 403, "EDITOR attempting delete returns HTTP 403");
    assert(
      unauthorizedDelete.body?.code === "OWNER_PERMISSION_REQUIRED",
      "Error code is OWNER_PERMISSION_REQUIRED"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Owner Renames Workspace
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 7: Owner Renames Workspace] ---");
    const renamedName = "Project Alpha (Renamed)";
    const renameRes = await request(`/api/workspaces/${workspaceAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: renamedName,
      }),
    });
    assert(renameRes.status === 200, "Owner rename returns HTTP 200");
    assert(renameRes.body?.data?.name === renamedName, "Returned name reflects updated name");

    const updateLog = await prisma.activityLog.findFirst({
      where: {
        workspaceId: workspaceAId,
        action: "WORKSPACE_UPDATED",
      },
    });
    assert(updateLog !== null, "ActivityLog WORKSPACE_UPDATED record created");
    assert(
      (updateLog?.metadata as any)?.oldName === wsName &&
        (updateLog?.metadata as any)?.newName === renamedName,
      "ActivityLog tracks oldName and newName in metadata"
    );

    // -------------------------------------------------------------------------
    // TEST 8: Owner Deletes Workspace & Cascading Verifications
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 8: Owner Deletes Workspace] ---");
    const deleteRes = await request(`/api/workspaces/${workspaceAId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(deleteRes.status === 200, "Owner delete returns HTTP 200");

    const wsInDb = await prisma.workspace.findUnique({
      where: { id: workspaceAId },
    });
    assert(wsInDb === null, "Workspace was removed from database");

    const membersInDb = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspaceAId },
    });
    assert(membersInDb.length === 0, "All associated WorkspaceMember records were cascade-deleted");

    const logsInDb = await prisma.activityLog.findMany({
      where: { workspaceId: workspaceAId },
    });
    assert(logsInDb.length === 0, "All associated ActivityLog records were cascade-deleted");

    // -------------------------------------------------------------------------
    // TEST 9: Validation and Authentication Error Scenarios
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 9: Validation & Authentication Guards] ---");
    // Empty name
    const emptyNameRes = await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "   " }),
    });
    assert(emptyNameRes.status === 400, "Empty workspace name rejected with HTTP 400");
    assert(emptyNameRes.body?.code === "VALIDATION_ERROR", "Error code is VALIDATION_ERROR");

    // Missing token
    const unauthRes = await request("/api/workspaces", {
      method: "GET",
    });
    assert(unauthRes.status === 401, "Unauthenticated request rejected with HTTP 401");

    // Invalid UUID
    const badUuidRes = await request("/api/workspaces/invalid-uuid-123", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(badUuidRes.status === 400, "Invalid workspace UUID rejected with HTTP 400");

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("\n--- [CLEANUP] ---");
    await prisma.workspace.deleteMany({
      where: { ownerId: { in: [userIdA, userIdB] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [userIdA, userIdB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userIdA, userIdB] } },
    });
    console.log("  🧹 Test users and residual workspaces cleaned up");

    // Graceful shutdown
    await new Promise<void>((resolve, reject) => {
      server.close(async (err) => {
        if (err) return reject(err);
        await disconnectDatabase();
        assert(true, "Server and database gracefully shut down");
        resolve();
      });
    });
  } catch (error) {
    console.error("❌ Unexpected error in workspace test:", error);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`📊 WORKSPACE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runWorkspaceTests();
