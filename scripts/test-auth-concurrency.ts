import http from "node:http";
import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";
import { AuthService } from "../apps/api/src/modules/auth/auth.service";
import { hashRefreshToken } from "../apps/api/src/utils/token.utils";
import { assertTestDatabase, TestFixtureTracker } from "./testDbGuard";

async function runConcurrencyTests() {
  console.log("=================================================");
  console.log("🧪 STARTING AUTHENTICATION CONCURRENCY INTEGRATION TESTS");
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
  const testPort = 4097;

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      console.log(`  📡 Test server listening on http://localhost:${testPort}`);
      resolve();
    });
  });

  function extractCookie(res: Response, cookieName: string): string | null {
    const rawCookies = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") || ""];
    for (const cookieStr of rawCookies) {
      if (cookieStr.includes(`${cookieName}=`)) {
        const match = cookieStr.match(new RegExp(`${cookieName}=([^;]+)`));
        if (match) return match[1];
      }
    }
    return null;
  }

  async function request(path: string, options: RequestInit = {}) {
    const res = await fetch(`http://localhost:${testPort}${path}`, options);
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, body, res };
  }

  const testEmail = `concurrency-${Date.now()}@example.com`;
  const testPassword = "Password123!";
  const testName = "Concurrency Tester";

  let userId = "";

  try {
    // Register initial user
    const regRes = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: testName, email: testEmail, password: testPassword }),
    });

    const regData = regRes.body?.data as Record<string, unknown>;
    userId = (regData?.user as Record<string, unknown>)?.id as string;
    fixtures.trackUser(userId);
    let initialRefreshToken = extractCookie(regRes.res, "codesync_refresh_token") || "";

    assert(
      regRes.status === 201 && initialRefreshToken.length > 20,
      "Test user registered with initial session"
    );

    // -------------------------------------------------------------------------
    // TEST A: Concurrent Refresh
    // Send two simultaneous requests using the same original refresh token R1.
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST A: Concurrent Refresh] ---");

    const [refreshResA, refreshResB] = await Promise.all([
      request("/api/auth/refresh", {
        method: "POST",
        headers: { Cookie: `codesync_refresh_token=${initialRefreshToken}` },
      }),
      request("/api/auth/refresh", {
        method: "POST",
        headers: { Cookie: `codesync_refresh_token=${initialRefreshToken}` },
      }),
    ]);

    const statuses = [refreshResA.status, refreshResB.status];
    const winningRes = refreshResA.status === 200 ? refreshResA : refreshResB;
    const losingRes = refreshResA.status === 200 ? refreshResB : refreshResA;

    assert(
      statuses.filter((s) => s === 200).length === 1,
      "Exactly one request successfully rotates the token (HTTP 200)"
    );
    assert(
      losingRes.status === 409 && losingRes.body?.code === "CONCURRENT_REFRESH",
      "Losing concurrent request receives HTTP 409 with CONCURRENT_REFRESH"
    );

    // Verify database state: exactly one active successor session
    const activeSessionsTestA = await prisma.session.findMany({
      where: { userId, revokedAt: null },
    });
    assert(
      activeSessionsTestA.length === 1,
      "Exactly one active successor session exists in PostgreSQL (no duplicate sessions)"
    );

    const winningToken = extractCookie(winningRes.res, "codesync_refresh_token") || "";
    assert(winningToken.length > 20, "Winning request received a valid successor token R2");

    // -------------------------------------------------------------------------
    // TEST B: Winning Token Validity
    // Use the winning request's refresh token R2 to perform a subsequent refresh.
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST B: Winning Token Validity] ---");

    const validRefreshRes = await request("/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: `codesync_refresh_token=${winningToken}` },
    });

    assert(
      validRefreshRes.status === 200,
      "Winning successor token R2 is completely valid and succeeds with HTTP 200"
    );
    const nextToken = extractCookie(validRefreshRes.res, "codesync_refresh_token") || "";
    assert(
      nextToken.length > 20 && nextToken !== winningToken,
      "Successfully issued new successor token R3"
    );

    // -------------------------------------------------------------------------
    // TEST C: Genuine Token Reuse Detection & Session Family Invalidation
    // Replay an old revoked token outside the concurrency grace window.
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST C: Genuine Token Reuse] ---");

    // Create an independent session on a second device to verify it is NOT revoked
    const device2Login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const device2Token = extractCookie(device2Login.res, "codesync_refresh_token") || "";
    assert(
      device2Login.status === 200 && device2Token.length > 20,
      "Created independent session (Device 2)"
    );

    // Simulate R1 as an old revoked token outside the concurrency grace window (e.g. 60 seconds ago)
    const r1Hash = hashRefreshToken(initialRefreshToken);
    await prisma.session.update({
      where: { tokenHash: r1Hash },
      data: { revokedAt: new Date(Date.now() - 60_000), revocationReason: "ROTATED" },
    });

    // Replay R1 outside grace period
    const replayRes = await request("/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: `codesync_refresh_token=${initialRefreshToken}` },
    });

    assert(
      replayRes.status === 401,
      "Replaying old revoked token outside grace window returns HTTP 401"
    );
    assert(replayRes.body?.code === "TOKEN_REVOKED", "Error code is TOKEN_REVOKED");

    // Verify that the compromised session family (Device 1) has been revoked
    const nextTokenHash = hashRefreshToken(nextToken);
    const device1Session = await prisma.session.findUnique({ where: { tokenHash: nextTokenHash } });
    assert(
      device1Session?.revokedAt !== null,
      "Compromised session family was completely invalidated"
    );

    // Verify that independent session (Device 2) remains active and valid
    const device2SessionCheck = await request("/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: `codesync_refresh_token=${device2Token}` },
    });
    assert(
      device2SessionCheck.status === 200,
      "Independent session (Device 2) remains valid and unaffected by Device 1's compromise"
    );

    const device2NextToken = extractCookie(device2SessionCheck.res, "codesync_refresh_token") || "";

    // -------------------------------------------------------------------------
    // TEST D: Multiple Independent Sessions Under Concurrency
    // Create two independent sessions for the same user; refresh one concurrently.
    // The other independent session must remain valid.
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST D: Multiple Independent Sessions] ---");

    // Login for Device 3 to have another fresh independent session
    const device3Login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const device3Token = extractCookie(device3Login.res, "codesync_refresh_token") || "";
    assert(device3Login.status === 200, "Device 3 independent session created");

    // Concurrently refresh Device 2's session
    const [d2RefA, d2RefB] = await Promise.all([
      request("/api/auth/refresh", {
        method: "POST",
        headers: { Cookie: `codesync_refresh_token=${device2NextToken}` },
      }),
      request("/api/auth/refresh", {
        method: "POST",
        headers: { Cookie: `codesync_refresh_token=${device2NextToken}` },
      }),
    ]);

    assert(
      (d2RefA.status === 200 && d2RefB.status === 409) ||
        (d2RefA.status === 409 && d2RefB.status === 200),
      "Concurrent refresh on Device 2 has exactly 1 winner (200) and 1 conflict (409)"
    );

    // Verify Device 3's independent session is completely unaffected and can be refreshed
    const d3Ref = await request("/api/auth/refresh", {
      method: "POST",
      headers: { Cookie: `codesync_refresh_token=${device3Token}` },
    });
    assert(
      d3Ref.status === 200,
      "Device 3 independent session remains completely valid and active"
    );

    // -------------------------------------------------------------------------
    // TEST E: Transaction Rollback
    // Simulate successor-session creation failure.
    // The old session revocation must be rolled back.
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST E: Transaction Rollback] ---");

    // Login for a clean session to test rollback
    const rollbackLogin = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const rollbackToken = extractCookie(rollbackLogin.res, "codesync_refresh_token") || "";
    const rollbackTokenHash = hashRefreshToken(rollbackToken);

    // Initial state: unrevoked
    const initialSessionBeforeRollback = await prisma.session.findUnique({
      where: { tokenHash: rollbackTokenHash },
    });
    assert(
      initialSessionBeforeRollback?.revokedAt === null,
      "Rollback test session initially active"
    );

    // Call AuthService.refreshSession with simulateSuccessorFailure: true
    let caughtError = false;
    try {
      await AuthService.refreshSession(rollbackToken, { simulateSuccessorFailure: true });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Simulated successor session creation failure") {
        caughtError = true;
      }
    }
    assert(caughtError, "Successor creation failure was triggered and caught");

    // Verify database state: original session's revokedAt must still be null!
    const sessionAfterFailedCreation = await prisma.session.findUnique({
      where: { tokenHash: rollbackTokenHash },
    });
    assert(
      sessionAfterFailedCreation?.revokedAt === null,
      "Old session revocation was rolled back (revokedAt is still null in PostgreSQL)"
    );

    // Verify session can now be rotated successfully
    const successfulRetry = await AuthService.refreshSession(rollbackToken);
    assert(
      typeof successfulRetry.accessToken === "string",
      "Old session can now be rotated normally after rollback"
    );
  } catch (error) {
    console.error("❌ Unexpected concurrency test error:", error);
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
  console.log(`📊 CONCURRENCY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runConcurrencyTests();
