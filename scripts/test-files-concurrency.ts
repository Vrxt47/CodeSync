import http from "node:http";
import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";

async function runConcurrencyAuditTests() {
  console.log("=================================================");
  console.log("🧪 STARTING CHUNK 6 CONCURRENCY & SECURITY AUDIT TESTS");
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
  const app = createApp();

  const server = http.createServer(app);
  const testPort = 4102;

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
  const userAEmail = `audit-a-${timestamp}@example.com`;
  const password = "Password123!";

  let tokenA = "";
  let userIdA = "";
  let workspaceAId = "";

  try {
    // SETUP
    console.log("\n--- [SETUP: User & Workspace] ---");
    const regA = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password, name: "Audit User" }),
    });
    tokenA = regA.body?.data?.accessToken;
    userIdA = regA.body?.data?.user?.id;
    assert(regA.status === 201, "Audit User registered successfully");

    const wsRes = await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "Concurrency Audit Workspace" }),
    });
    workspaceAId = wsRes.body?.data?.id;
    assert(wsRes.status === 201, "Audit Workspace created successfully");

    // -------------------------------------------------------------------------
    // AUDIT TEST 1: Concurrent Duplicate Name Creation
    // -------------------------------------------------------------------------
    console.log("\n--- [AUDIT TEST 1: Concurrent Sibling Creation (Race Condition)] ---");
    // Send 5 concurrent requests creating 'service.ts' (and variants with different casing)
    const creationNames = ["service.ts", "SERVICE.TS", "Service.ts", "service.ts", "sErViCe.Ts"];

    const creationResults = await Promise.all(
      creationNames.map((name) =>
        request(`/api/workspaces/${workspaceAId}/files`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({ name, parentId: null }),
        })
      )
    );

    const successfulCreations = creationResults.filter((r) => r.status === 201);
    const conflictCreations = creationResults.filter(
      (r) => r.status === 409 && r.body?.code === "DUPLICATE_NAME"
    );

    assert(
      successfulCreations.length === 1,
      `Exactly 1 concurrent request succeeded (201), got ${successfulCreations.length}`
    );
    assert(
      conflictCreations.length === 4,
      `Exactly 4 concurrent requests were rejected with 409 DUPLICATE_NAME, got ${conflictCreations.length}`
    );

    const recordsInDb = await prisma.file.findMany({
      where: {
        workspaceId: workspaceAId,
        parentId: null,
      },
    });
    const serviceRecords = recordsInDb.filter((f) => f.name.toLowerCase() === "service.ts");
    assert(
      serviceRecords.length === 1,
      `PostgreSQL database contains strictly 1 record for service.ts, got ${serviceRecords.length}`
    );

    // -------------------------------------------------------------------------
    // AUDIT TEST 2: Concurrent Folder Movement (Circular Hierarchy Race Condition)
    // -------------------------------------------------------------------------
    console.log("\n--- [AUDIT TEST 2: Concurrent Folder Movement (Mutual Inversion)] ---");
    // Create Folder Alpha and Folder Beta
    const folderAlphaRes = await request(`/api/workspaces/${workspaceAId}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "FolderAlpha", parentId: null }),
    });
    const alphaId = folderAlphaRes.body?.data?.id;

    const folderBetaRes = await request(`/api/workspaces/${workspaceAId}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "FolderBeta", parentId: null }),
    });
    const betaId = folderBetaRes.body?.data?.id;

    assert(
      folderAlphaRes.status === 201 && folderBetaRes.status === 201,
      "FolderAlpha and FolderBeta created"
    );

    // Request 1: Move Alpha into Beta
    // Request 2: Move Beta into Alpha (simultaneous)
    const [moveRes1, moveRes2] = await Promise.all([
      request(`/api/files/${alphaId}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ targetParentId: betaId }),
      }),
      request(`/api/files/${betaId}/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ targetParentId: alphaId }),
      }),
    ]);

    console.log(
      `  Move Res 1 (Alpha -> Beta): status=${moveRes1.status}, code=${moveRes1.body?.code}`
    );
    console.log(
      `  Move Res 2 (Beta -> Alpha): status=${moveRes2.status}, code=${moveRes2.body?.code}`
    );

    const moveStatuses = [moveRes1.status, moveRes2.status].sort();
    const alphaDb = await prisma.file.findUnique({ where: { id: alphaId } });
    const betaDb = await prisma.file.findUnique({ where: { id: betaId } });

    // Verify whether a circular loop was created:
    const isCycle = alphaDb?.parentId === betaId && betaDb?.parentId === alphaId;
    assert(
      !isCycle,
      "Database does NOT have a circular loop (alpha.parentId === beta && beta.parentId === alpha)"
    );

    const oneWinnerOneRejected =
      (moveRes1.status === 200 && (moveRes2.status === 400 || moveRes2.status === 409)) ||
      (moveRes2.status === 200 && (moveRes1.status === 400 || moveRes1.status === 409));
    assert(
      oneWinnerOneRejected,
      "Concurrent mutual moves: exactly one succeeded and one was safely rejected"
    );

    // -------------------------------------------------------------------------
    // AUDIT TEST 3: Concurrent Recursive Deletion vs Child Creation
    // -------------------------------------------------------------------------
    console.log("\n--- [AUDIT TEST 3: Concurrent Deletion vs Child Creation] ---");
    // Create parent folder Gamma
    const folderGammaRes = await request(`/api/workspaces/${workspaceAId}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "FolderGamma", parentId: null }),
    });
    const gammaId = folderGammaRes.body?.data?.id;

    // Concurrently: Delete Gamma AND Create child inside Gamma
    const [delGammaRes, createChildRes] = await Promise.all([
      request(`/api/files/${gammaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenA}` },
      }),
      request(`/api/workspaces/${workspaceAId}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ name: "late_child.ts", parentId: gammaId }),
      }),
    ]);

    console.log(`  Delete Gamma status: ${delGammaRes.status}`);
    console.log(`  Create Child status: ${createChildRes.status}`);

    // Check if any orphaned file remains with parentId = gammaId
    const orphans = await prisma.file.findMany({
      where: { parentId: gammaId },
    });
    assert(
      orphans.length === 0,
      `No orphaned files remain referencing deleted parent Gamma, got ${orphans.length}`
    );

    // -------------------------------------------------------------------------
    // AUDIT TEST 4: Concurrent Simultaneous Deletions of Same Folder
    // -------------------------------------------------------------------------
    console.log("\n--- [AUDIT TEST 4: Concurrent Double Deletion of Same Resource] ---");
    // Create folder Delta
    const folderDeltaRes = await request(`/api/workspaces/${workspaceAId}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: "FolderDelta", parentId: null }),
    });
    const deltaId = folderDeltaRes.body?.data?.id;

    const [delDelta1, delDelta2] = await Promise.all([
      request(`/api/files/${deltaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenA}` },
      }),
      request(`/api/files/${deltaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenA}` },
      }),
    ]);

    console.log(`  Delete 1 status: ${delDelta1.status}, Delete 2 status: ${delDelta2.status}`);
    assert(
      (delDelta1.status === 200 && (delDelta2.status === 404 || delDelta2.status === 200)) ||
        (delDelta2.status === 200 && (delDelta1.status === 404 || delDelta1.status === 200)),
      "Concurrent deletion handled gracefully without unhandled server 500 error"
    );

    const deltaInDb = await prisma.file.findUnique({ where: { id: deltaId } });
    assert(deltaInDb === null, "FolderDelta is completely removed from database");

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("\n--- [CLEANUP] ---");
    await prisma.workspace.deleteMany({ where: { id: workspaceAId } });
    await prisma.session.deleteMany({ where: { userId: userIdA } });
    await prisma.user.deleteMany({ where: { id: userIdA } });
    console.log("  🧹 Test data cleaned up");

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
    console.error("❌ Unexpected error in concurrency audit test:", error);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`📊 CONCURRENCY AUDIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runConcurrencyAuditTests();
