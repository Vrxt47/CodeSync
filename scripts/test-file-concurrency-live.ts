import http from "node:http";
import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";
import { assertTestDatabase, TestFixtureTracker } from "./testDbGuard";

async function runLiveConcurrencyTests() {
  console.log("=================================================");
  console.log("🧪 STARTING LIVE POSTGRESQL FILE CONCURRENCY TESTS");
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
  await assertTestDatabase();

  const fixtures = new TestFixtureTracker();
  const app = createApp();
  const server = http.createServer(app);
  const testPort = 4110;

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      console.log(`  📡 Live test server listening on http://localhost:${testPort}`);
      resolve();
    });
  });

  async function request(path: string, options: RequestInit = {}) {
    const res = await fetch(`http://localhost:${testPort}${path}`, options);
    const body = (await res.json().catch(() => null)) as Record<string, any> | null;
    return { status: res.status, body };
  }

  const timestamp = Date.now();
  const ownerEmail = `live-owner-${timestamp}@example.com`;
  const collaboratorEmail = `live-collab-${timestamp}@example.com`;
  const viewerEmail = `live-viewer-${timestamp}@example.com`;
  const outsiderEmail = `live-outsider-${timestamp}@example.com`;
  const password = "Password123!";

  let ownerToken = "";
  let ownerId = "";
  let collaboratorToken = "";
  let collaboratorId = "";
  let viewerToken = "";
  let viewerId = "";
  let outsiderToken = "";
  let outsiderId = "";
  let workspaceId = "";

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create users and workspace with roles
    // -------------------------------------------------------------------------
    console.log("\n--- [SETUP: Users, Roles & Workspace] ---");
    const regOwner = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, password, name: "Owner Alice" }),
    });
    ownerToken = regOwner.body?.data?.accessToken;
    ownerId = regOwner.body?.data?.user?.id;
    fixtures.trackUser(ownerId);
    assert(regOwner.status === 201, "Owner registered successfully");

    const regCollab = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: collaboratorEmail, password, name: "Collaborator Bob" }),
    });
    collaboratorToken = regCollab.body?.data?.accessToken;
    collaboratorId = regCollab.body?.data?.user?.id;
    fixtures.trackUser(collaboratorId);
    assert(regCollab.status === 201, "Collaborator registered successfully");

    const regViewer = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: viewerEmail, password, name: "Viewer Charlie" }),
    });
    viewerToken = regViewer.body?.data?.accessToken;
    viewerId = regViewer.body?.data?.user?.id;
    fixtures.trackUser(viewerId);
    assert(regViewer.status === 201, "Viewer registered successfully");

    const regOutsider = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: outsiderEmail, password, name: "Outsider Dave" }),
    });
    outsiderToken = regOutsider.body?.data?.accessToken;
    outsiderId = regOutsider.body?.data?.user?.id;
    fixtures.trackUser(outsiderId);
    assert(regOutsider.status === 201, "Outsider registered successfully");

    // Create workspace
    const wsRes = await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: `Concurrency WS ${timestamp}` }),
    });
    workspaceId = wsRes.body?.data?.id;
    fixtures.trackWorkspace(workspaceId);
    assert(wsRes.status === 201 && !!workspaceId, "Workspace created by Owner");

    // Add Collaborator as EDITOR
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: collaboratorId,
        role: "EDITOR",
      },
    });
    assert(true, "Collaborator added as EDITOR");

    // Add Viewer as VIEWER
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: viewerId,
        role: "VIEWER",
      },
    });
    assert(true, "Viewer added as VIEWER");

    // Helper to create a file
    async function createTestFile(fileName: string) {
      const createRes = await request(`/api/workspaces/${workspaceId}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ name: fileName }),
      });
      const fileData = createRes.body?.data;
      if (fileData?.id) {
        fixtures.trackFile(fileData.id);
      }
      return fileData;
    }

    // -------------------------------------------------------------------------
    // SCENARIO 1: Two simultaneous conditional updates with same expected version
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 1: Concurrent Conditional Updates (Same Expected Version)] ---");
    const file1 = await createTestFile("scenario1.ts");
    assert(file1 && file1.id, "Scenario 1 test file created");
    assert(file1.version === 1, "Initial file version in PostgreSQL is 1");

    // Send two concurrent updates expecting version 1
    const [res1A, res1B] = await Promise.all([
      request(`/api/files/${file1.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          content: "Content from Alice (Update A)",
          expectedVersion: 1,
        }),
      }),
      request(`/api/files/${file1.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${collaboratorToken}`,
        },
        body: JSON.stringify({
          content: "Content from Bob (Update B)",
          expectedVersion: 1,
        }),
      }),
    ]);

    const statuses = [res1A.status, res1B.status].sort();
    assert(
      statuses[0] === 200 && statuses[1] === 409,
      "Exactly one update returns 200, one returns 409"
    );

    const winner = res1A.status === 200 ? res1A : res1B;
    const loser = res1A.status === 409 ? res1A : res1B;

    assert(winner.body?.data?.version === 2, "Winner response has version incremented to 2");
    assert(
      loser.body?.code === "CONCURRENT_MODIFICATION",
      "Loser response code is CONCURRENT_MODIFICATION"
    );

    // Inspect PostgreSQL directly
    const dbFile1 = await prisma.file.findUnique({ where: { id: file1.id } });
    assert(dbFile1?.version === 2, "PostgreSQL file version is exactly 2");
    assert(
      dbFile1?.content === winner.body?.data?.content,
      "PostgreSQL content matches the successful writer (no partial or corrupted write)"
    );

    // -------------------------------------------------------------------------
    // SCENARIO 2: Stale compensating restore rejected with 409; newer content preserved
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 2: Stale Compensating Restore Rejected with 409] ---");
    // Attempt compensating restore with stale version 1
    const staleRestoreRes = await request(`/api/files/${file1.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        content: "Stale Baseline Content",
        expectedVersion: 1,
      }),
    });

    assert(staleRestoreRes.status === 409, "Stale compensating restore returns HTTP 409");
    assert(
      staleRestoreRes.body?.code === "CONCURRENT_MODIFICATION",
      "Stale restore rejected with CONCURRENT_MODIFICATION"
    );

    const dbFile2 = await prisma.file.findUnique({ where: { id: file1.id } });
    assert(dbFile2?.version === 2, "Database version remains 2");
    assert(
      dbFile2?.content === winner.body?.data?.content,
      "Newer content in database was safely preserved"
    );

    // -------------------------------------------------------------------------
    // SCENARIO 3: PUT followed by immediate GET returns new content (ordering verification)
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 3: PUT Followed Immediately by GET (FIFO Ordering)] ---");
    const file3 = await createTestFile("scenario3.ts");
    const newContent3 = "Immediate Ordered Content 3";

    // Dispatch PUT followed immediately by GET
    const putPromise = request(`/api/files/${file3.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        content: newContent3,
        expectedVersion: 1,
      }),
    });

    // Small delay ensures PUT is received by Express and enqueued into fileQueue before GET arrives
    await new Promise((resolve) => setTimeout(resolve, 5));

    const getPromise = request(`/api/files/${file3.id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    const [putRes3, getRes3] = await Promise.all([putPromise, getPromise]);

    assert(putRes3.status === 200, "PUT request resolved with HTTP 200");
    assert(putRes3.body?.data?.version === 2, "PUT updated version to 2");
    assert(getRes3.status === 200, "Immediate GET request resolved with HTTP 200");
    assert(
      getRes3.body?.data?.content === newContent3,
      "Immediate GET returned newly written content (FIFO per-file queue enforced)"
    );
    assert(getRes3.body?.data?.version === 2, "Immediate GET observed version 2");

    // -------------------------------------------------------------------------
    // SCENARIO 4: Collaborator modification during discard causes 409 conflict
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 4: Collaborator Modification During Discard] ---");
    const file4 = await createTestFile("scenario4.ts");
    // Client initially has version 1. Collaborator updates to "Collaborator Edit"
    const collabUpdate = await request(`/api/files/${file4.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${collaboratorToken}`,
      },
      body: JSON.stringify({
        content: "Collaborator Edit",
        expectedVersion: 1,
      }),
    });
    assert(
      collabUpdate.status === 200 && collabUpdate.body?.data?.version === 2,
      "Collaborator modified file to version 2"
    );

    // Client's discard flow attempts to restore "Initial Base 4" expecting version 1
    const discardRestoreRes = await request(`/api/files/${file4.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        content: "Initial Base 4",
        expectedVersion: 1,
      }),
    });

    assert(discardRestoreRes.status === 409, "Discard compensating restore rejected with HTTP 409");
    assert(
      discardRestoreRes.body?.code === "CONCURRENT_MODIFICATION",
      "Error code is CONCURRENT_MODIFICATION"
    );

    const dbFile4 = await prisma.file.findUnique({ where: { id: file4.id } });
    assert(
      dbFile4?.content === "Collaborator Edit",
      "External collaborator content NOT overwritten; changes safely intact in PostgreSQL"
    );

    // -------------------------------------------------------------------------
    // SCENARIO 5: Successful in-flight save followed by compensating restore returns DB to baseline
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 5: Compensating Restore Returns DB to Baseline] ---");
    const file5 = await createTestFile("scenario5.ts");
    assert(file5.version === 1, "Baseline file created at version 1");

    // In-flight save dispatches "Unwanted In-Flight 5"
    const inFlightSave = await request(`/api/files/${file5.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        content: "Unwanted In-Flight 5",
        expectedVersion: 1,
      }),
    });
    assert(inFlightSave.status === 200, "In-flight save succeeded with HTTP 200");
    assert(inFlightSave.body?.data?.version === 2, "In-flight save updated version to 2");

    // User selected Don't Save: compensating restore sends initial baseline "" expecting version 2
    const compensatingRestore = await request(`/api/files/${file5.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        content: "",
        expectedVersion: 2,
      }),
    });
    assert(compensatingRestore.status === 200, "Compensating restore succeeded with HTTP 200");
    assert(
      compensatingRestore.body?.data?.version === 3,
      "Compensating restore updated version to 3"
    );

    const dbFile5 = await prisma.file.findUnique({ where: { id: file5.id } });
    assert(dbFile5?.content === "", "Database content restored back to baseline");
    assert(dbFile5?.version === 3, "Database version is 3");

    // -------------------------------------------------------------------------
    // SCENARIO 6: Failed conditional update does not modify file
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 6: Failed Conditional Update Does Not Modify File] ---");
    const file6 = await createTestFile("scenario6.ts");
    // Establish known baseline content
    const setup6 = await request(`/api/files/${file6.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        content: "Established Content 6",
        expectedVersion: 1,
      }),
    });
    assert(
      setup6.status === 200 && setup6.body?.data?.version === 2,
      "File 6 initialized at version 2"
    );

    const failUpdate = await request(`/api/files/${file6.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        content: "Corrupted Content",
        expectedVersion: 999, // Non-matching expected version
      }),
    });
    assert(failUpdate.status === 409, "Conditional update with version 999 rejected with HTTP 409");
    assert(
      failUpdate.body?.code === "CONCURRENT_MODIFICATION",
      "Error code is CONCURRENT_MODIFICATION"
    );

    const dbFile6 = await prisma.file.findUnique({ where: { id: file6.id } });
    assert(dbFile6?.content === "Established Content 6", "Content remained unchanged in DB");
    assert(dbFile6?.version === 2, "Version remained 2 in DB");

    // -------------------------------------------------------------------------
    // SCENARIO 7: File deletion during discard returns 404 cleanly
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 7: File Deletion Returns 404 Cleanly] ---");
    const file7 = await createTestFile("scenario7.ts");
    const delRes = await request(`/api/files/${file7.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    assert(delRes.status === 200, "File deleted successfully");

    // Conditional update or discard restore on deleted file
    const putDeletedRes = await request(`/api/files/${file7.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        content: "Restore attempt",
        expectedVersion: 1,
      }),
    });
    assert(putDeletedRes.status === 404, "Update on deleted file returns HTTP 404");
    assert(putDeletedRes.body?.code === "FILE_NOT_FOUND", "Error code is FILE_NOT_FOUND");

    // -------------------------------------------------------------------------
    // SCENARIO 8: Content Update Without expectedVersion is Rejected (Mandatory Concurrency Token)
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 8: Content Update Without expectedVersion is Rejected] ---");
    const file8 = await createTestFile("scenario8.ts");
    assert(file8.version === 1, "Initial file created with version 1");

    // Attempt unconditional save omitting expectedVersion
    const putMissingVersion = await request(`/api/files/${file8.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        content: "Attempted Unconditional Overwrite",
      }),
    });
    assert(
      putMissingVersion.status === 400,
      "Content update without expectedVersion rejected with HTTP 400"
    );
    assert(
      putMissingVersion.body?.code === "VALIDATION_ERROR" ||
        putMissingVersion.body?.code === "VERSION_REQUIRED",
      "Error code indicates validation failure"
    );

    // Verify DB file was NOT modified
    const dbFile8 = await prisma.file.findUnique({ where: { id: file8.id } });
    assert(dbFile8?.version === 1, "Database version remained 1");
    assert(dbFile8?.content === "", "Database content remained unchanged");

    // Now send valid update with expectedVersion: 1
    const putValidVersion = await request(`/api/files/${file8.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        content: "Valid Content Revision",
        expectedVersion: 1,
      }),
    });
    assert(
      putValidVersion.status === 200,
      "Content update with expectedVersion: 1 succeeds (HTTP 200)"
    );
    assert(putValidVersion.body?.data?.version === 2, "Version incremented to 2");

    // -------------------------------------------------------------------------
    // SCENARIO 9: Version increments monotonically on each successful content write
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 9: Monotonic Version Increment Across Writes] ---");
    const file9 = await createTestFile("scenario9.ts");
    let currentV = file9.version;
    assert(currentV === 1, "Initial version is 1");

    const observedVersions: number[] = [currentV];
    for (let i = 2; i <= 6; i++) {
      const stepRes = await request(`/api/files/${file9.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          content: `Content V${i}`,
          expectedVersion: currentV,
        }),
      });
      assert(stepRes.status === 200, `Write ${i} returned HTTP 200`);
      currentV = stepRes.body?.data?.version;
      observedVersions.push(currentV);
    }

    assert(
      JSON.stringify(observedVersions) === JSON.stringify([1, 2, 3, 4, 5, 6]),
      `Versions strictly incremented monotonically: ${observedVersions.join(" -> ")}`
    );

    const dbFile9 = await prisma.file.findUnique({ where: { id: file9.id } });
    assert(dbFile9?.version === 6, "PostgreSQL file version is 6");
    assert(dbFile9?.content === "Content V6", "PostgreSQL content matches last write");

    // -------------------------------------------------------------------------
    // SCENARIO 10: Workspace authentication & authorization remain enforced
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 10: Workspace Auth & RBAC Authorization Checks] ---");
    const file10 = await createTestFile("scenario10.ts");

    // 1. Unauthenticated request
    const unauthRes = await request(`/api/files/${file10.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "Hacked", expectedVersion: 1 }),
    });
    assert(unauthRes.status === 401, "Unauthenticated request returns HTTP 401");

    // 2. Outsider user
    const outsiderRes = await request(`/api/files/${file10.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${outsiderToken}`,
      },
      body: JSON.stringify({ content: "Outsider Hacked", expectedVersion: 1 }),
    });
    assert(outsiderRes.status === 403, "Outsider request returns HTTP 403");
    assert(
      outsiderRes.body?.code === "WORKSPACE_ACCESS_DENIED",
      "Outsider rejected with WORKSPACE_ACCESS_DENIED"
    );

    // 3. Viewer user (Read-only)
    const viewerRes = await request(`/api/files/${file10.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ content: "Viewer Hacked", expectedVersion: 1 }),
    });
    assert(viewerRes.status === 403, "Viewer modification rejected with HTTP 403");
    assert(
      viewerRes.body?.code === "INSUFFICIENT_PERMISSIONS",
      "Viewer rejected with INSUFFICIENT_PERMISSIONS"
    );

    // 4. Editor user allowed
    const editorRes = await request(`/api/files/${file10.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${collaboratorToken}`,
      },
      body: JSON.stringify({ content: "Editor Content Allowed", expectedVersion: 1 }),
    });
    assert(editorRes.status === 200, "Editor modification allowed with HTTP 200");
    assert(editorRes.body?.data?.version === 2, "Editor update incremented version to 2");

    // -------------------------------------------------------------------------
    // SCENARIO 11: Queue Resilience Against Failure (No Queue Poisoning)
    // -------------------------------------------------------------------------
    console.log("\n--- [SCENARIO 11: Per-File FIFO Queue Resilience (No Queue Poisoning)] ---");
    const file11 = await createTestFile("scenario11.ts");

    // Operation 1: Fails with 409 CONCURRENT_MODIFICATION
    const op1 = request(`/api/files/${file11.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ content: "Failing Update", expectedVersion: 999 }),
    });

    // Operation 2: Valid update queued behind failing operation 1
    const op2 = request(`/api/files/${file11.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ content: "Succeeding Update", expectedVersion: 1 }),
    });

    const [resOp1, resOp2] = await Promise.all([op1, op2]);
    assert(resOp1.status === 409, "Preceding invalid operation rejected with 409");
    assert(
      resOp2.status === 200,
      "Subsequent queued operation executed and succeeded with 200 (queue was not poisoned)"
    );
    assert(resOp2.body?.data?.version === 2, "Subsequent operation incremented version to 2");

    const dbFile11 = await prisma.file.findUnique({ where: { id: file11.id } });
    assert(
      dbFile11?.content === "Succeeding Update",
      "Final content matches valid queued operation"
    );
  } catch (err) {
    console.error("💥 Unhandled exception during live concurrency tests:", err);
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
    server.close();
    await disconnectDatabase();
  }

  console.log("\n=================================================");
  console.log(`LIVE CONCURRENCY TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runLiveConcurrencyTests();
