import http from "node:http";
import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";
import { hashRefreshToken } from "../apps/api/src/utils/token.utils";

async function runAuthTests() {
  console.log("=================================================");
  console.log("🚀 STARTING CHUNK 4 AUTHENTICATION INTEGRATION TESTS");
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
  const testPort = 4098;

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      console.log(`  📡 Test server listening on http://localhost:${testPort}`);
      resolve();
    });
  });

  // Cookie helper to extract cookie header value
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

  function getRawCookieHeader(res: Response): string | null {
    return res.headers.get("set-cookie");
  }

  async function request(path: string, options: RequestInit = {}) {
    const res = await fetch(`http://localhost:${testPort}${path}`, options);
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, body, res };
  }

  const testUserEmail = `authtest-${Date.now()}@example.com`;
  const testUserPassword = "Password123!";
  const testUserName = "Auth Tester";

  let accessToken1 = "";
  let refreshTokenCookie1 = "";
  let userId1 = "";

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Registration Validation Failure (short password & bad email)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 1: Registration Validation Failure] ---");
    const badReg = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "not-an-email", password: "123" }),
    });
    assert(badReg.status === 400, "Registration returns 400 on invalid input");
    assert(badReg.body?.code === "VALIDATION_ERROR", "Error code is VALIDATION_ERROR");

    // -------------------------------------------------------------------------
    // TEST 2: Successful Registration
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 2: Successful User Registration] ---");
    const regRes = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testUserName,
        email: testUserEmail,
        password: testUserPassword,
      }),
    });

    assert(regRes.status === 201, "Registration returns 201 Created");
    assert(regRes.body?.success === true, "Response has success: true");
    const regData = regRes.body?.data as Record<string, unknown>;
    assert(typeof regData?.accessToken === "string", "Access token is returned");
    assert(
      (regData?.user as Record<string, unknown>)?.email === testUserEmail,
      "User email matches"
    );
    assert(
      (regData?.user as Record<string, unknown>)?.passwordHash === undefined,
      "passwordHash is NOT exposed"
    );

    accessToken1 = regData?.accessToken as string;
    userId1 = (regData?.user as Record<string, unknown>)?.id as string;

    const cookieHeader = getRawCookieHeader(regRes.res);
    assert(
      cookieHeader !== null && cookieHeader.includes("codesync_refresh_token"),
      "Set-Cookie header includes codesync_refresh_token"
    );
    assert(cookieHeader?.toLowerCase().includes("httponly") === true, "Cookie is HttpOnly");
    assert(cookieHeader?.toLowerCase().includes("samesite=lax") === true, "Cookie is SameSite=Lax");

    refreshTokenCookie1 = extractCookie(regRes.res, "codesync_refresh_token") || "";
    assert(refreshTokenCookie1.length > 20, "Extracted refresh token string");

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate Registration Rejection
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 3: Duplicate Email Rejection] ---");
    const dupReg = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testUserName,
        email: testUserEmail,
        password: testUserPassword,
      }),
    });
    assert(dupReg.status === 409, "Duplicate email returns 409 Conflict");
    assert(dupReg.body?.code === "DUPLICATE_EMAIL", "Error code is DUPLICATE_EMAIL");

    // -------------------------------------------------------------------------
    // TEST 4: Login with Invalid Credentials
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 4: Login with Invalid Credentials] ---");
    const badLogin1 = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserEmail,
        password: "WrongPassword123!",
      }),
    });
    assert(badLogin1.status === 401, "Wrong password returns 401 Unauthorized");
    assert(badLogin1.body?.code === "INVALID_CREDENTIALS", "Error code is INVALID_CREDENTIALS");

    const badLogin2 = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent-user@example.com",
        password: testUserPassword,
      }),
    });
    assert(badLogin2.status === 401, "Non-existent user returns 401 Unauthorized");
    assert(badLogin2.body?.code === "INVALID_CREDENTIALS", "Error code is INVALID_CREDENTIALS");

    // -------------------------------------------------------------------------
    // TEST 5: Successful Login
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 5: Successful Login] ---");
    const loginRes = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserEmail,
        password: testUserPassword,
      }),
    });
    assert(loginRes.status === 200, "Login returns 200 OK");
    assert(loginRes.body?.success === true, "Response has success: true");
    const loginData = loginRes.body?.data as Record<string, unknown>;
    assert(typeof loginData?.accessToken === "string", "Login returns new accessToken");
    const refreshTokenCookie2 = extractCookie(loginRes.res, "codesync_refresh_token") || "";
    assert(refreshTokenCookie2.length > 20, "Login sets new refresh token cookie");

    // -------------------------------------------------------------------------
    // TEST 6: Protected Route GET /api/auth/me
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 6: Protected Route GET /api/auth/me] ---");
    // Missing token
    const noTokenRes = await request("/api/auth/me");
    assert(noTokenRes.status === 401, "Missing token returns 401");
    assert(noTokenRes.body?.code === "AUTH_HEADER_MISSING", "Code is AUTH_HEADER_MISSING");

    // Invalid token
    const badTokenRes = await request("/api/auth/me", {
      headers: { Authorization: "Bearer definitely.not.a.valid.jwt" },
    });
    assert(badTokenRes.status === 401, "Invalid token returns 401");
    assert(badTokenRes.body?.code === "INVALID_ACCESS_TOKEN", "Code is INVALID_ACCESS_TOKEN");

    // Valid token
    const meRes = await request("/api/auth/me", {
      headers: { Authorization: `Bearer ${loginData?.accessToken}` },
    });
    assert(meRes.status === 200, "Valid token returns 200 OK");
    const meUser = (meRes.body?.data as Record<string, unknown>)?.user as Record<string, unknown>;
    assert(meUser?.email === testUserEmail, "Current user email matches");
    assert(meUser?.id === userId1, "Current user id matches");
    assert(meUser?.passwordHash === undefined, "passwordHash is omitted from /me");

    // -------------------------------------------------------------------------
    // TEST 7: Refresh Token Rotation
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 7: Refresh Token Rotation] ---");
    // No cookie
    const noCookieRefresh = await request("/api/auth/refresh", { method: "POST" });
    assert(noCookieRefresh.status === 401, "Refresh without cookie returns 401");
    assert(noCookieRefresh.body?.code === "REFRESH_TOKEN_MISSING", "Code is REFRESH_TOKEN_MISSING");

    // Valid refresh
    const refreshRes = await request("/api/auth/refresh", {
      method: "POST",
      headers: {
        Cookie: `codesync_refresh_token=${refreshTokenCookie2}`,
      },
    });
    assert(refreshRes.status === 200, "Refresh returns 200 OK");
    const refreshData = refreshRes.body?.data as Record<string, unknown>;
    assert(typeof refreshData?.accessToken === "string", "Returns new accessToken");
    const refreshTokenCookie3 = extractCookie(refreshRes.res, "codesync_refresh_token") || "";
    assert(refreshTokenCookie3.length > 20, "Returns rotated refresh token cookie");
    assert(
      refreshTokenCookie3 !== refreshTokenCookie2,
      "Rotated refresh token is different from old token"
    );

    // -------------------------------------------------------------------------
    // TEST 8: Token Reuse Detection
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 8: Token Reuse Detection] ---");
    // Simulate an old revoked token replay outside the concurrency grace window (e.g. 60s ago)
    const tokenHash2 = hashRefreshToken(refreshTokenCookie2);
    await prisma.session.update({
      where: { tokenHash: tokenHash2 },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    // Attempt to reuse refreshTokenCookie2 (which was replaced by refreshTokenCookie3)
    const reuseRes = await request("/api/auth/refresh", {
      method: "POST",
      headers: {
        Cookie: `codesync_refresh_token=${refreshTokenCookie2}`,
      },
    });
    assert(reuseRes.status === 401, "Reusing revoked token returns 401");
    assert(reuseRes.body?.code === "TOKEN_REVOKED", "Error code is TOKEN_REVOKED");

    // Verify reuse detection invalidated ALL sessions for this user
    const checkPostReuse = await request("/api/auth/refresh", {
      method: "POST",
      headers: {
        Cookie: `codesync_refresh_token=${refreshTokenCookie3}`,
      },
    });
    assert(
      checkPostReuse.status === 401,
      "Session that was active before reuse detection is now also revoked"
    );

    // -------------------------------------------------------------------------
    // TEST 9: Logout & Session Revocation
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 9: Logout & Session Revocation] ---");
    // Login fresh to get a valid session
    const freshLogin = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
    });
    const freshCookie = extractCookie(freshLogin.res, "codesync_refresh_token") || "";
    assert(freshLogin.status === 200, "Fresh login succeeded");

    // Call logout
    const logoutRes = await request("/api/auth/logout", {
      method: "POST",
      headers: {
        Cookie: `codesync_refresh_token=${freshCookie}`,
      },
    });
    assert(logoutRes.status === 200, "Logout returns 200 OK");
    const logoutCookie = getRawCookieHeader(logoutRes.res);
    assert(
      logoutCookie !== null &&
        (logoutCookie.includes("Max-Age=0") || logoutCookie.includes("Expires=")),
      "Logout clears codesync_refresh_token cookie"
    );

    // Refresh after logout should fail
    const postLogoutRefresh = await request("/api/auth/refresh", {
      method: "POST",
      headers: {
        Cookie: `codesync_refresh_token=${freshCookie}`,
      },
    });
    assert(postLogoutRefresh.status === 401, "Refresh using logged out session fails with 401");

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("\n--- [CLEANUP] ---");
    await prisma.session.deleteMany({ where: { userId: userId1 } });
    await prisma.user.deleteMany({ where: { id: userId1 } });
    console.log("  🧹 Test user and sessions cleaned up");

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
    console.error("❌ Unexpected error in auth test:", error);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`📊 AUTH TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runAuthTests();
