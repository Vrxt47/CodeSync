import http from "node:http";
import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";
import { assertTestDatabase } from "./testDbGuard";

async function runBackendTests() {
  console.log("=================================================");
  console.log("🚀 STARTING CHUNK 3 BACKEND INTEGRATION TESTS");
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

  // Connect to DB
  await connectDatabase();
  await assertTestDatabase(prisma);
  const app = createApp();

  // Temporary route for testing validation middleware
  const { validate } = await import("../apps/api/src/middleware/validate.middleware");
  const { registerUserSchema } = await import("../apps/api/src/modules/users/user.schema");
  const { AppError } = await import("../apps/api/src/utils/AppError");
  const { apiRouter } = await import("../apps/api/src/routes");

  apiRouter.post("/test-validate", validate({ body: registerUserSchema }), (_req, res) => {
    res.json({ success: true, message: "Validation passed" });
  });

  apiRouter.get("/test-custom-error", () => {
    throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
  });

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
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, body };
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Health endpoint returns 200 and healthy DB
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 1: Health Endpoint GET /api/health] ---");
    const health = await request("/api/health");
    assert(health.status === 200, "Health check returns HTTP 200");
    assert(health.body?.success === true, "Health check returns success: true");
    const data = health.body?.data as Record<string, unknown> | undefined;
    assert(data?.database === "connected", "Database status reports 'connected'");
    assert(data?.status === "healthy", "Application status reports 'healthy'");

    // -------------------------------------------------------------------------
    // TEST 2: 404 handler for unknown routes
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 2: 404 Not Found Middleware] ---");
    const notFound = await request("/api/non-existent-endpoint-test");
    assert(notFound.status === 404, "Unknown route returns HTTP 404");
    assert(notFound.body?.success === false, "404 response returns success: false");
    assert(notFound.body?.code === "ROUTE_NOT_FOUND", "404 response code is ROUTE_NOT_FOUND");

    // -------------------------------------------------------------------------
    // TEST 3: Validation Middleware (Zod)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 3: Validation Middleware] ---");
    const invalidValidation = await request("/api/test-validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "not-an-email", password: "123" }),
    });
    assert(
      invalidValidation.status === 400,
      "Validation middleware returns HTTP 400 for invalid body"
    );
    assert(
      invalidValidation.body?.code === "VALIDATION_ERROR",
      "Validation response code is VALIDATION_ERROR"
    );
    assert(
      Array.isArray(invalidValidation.body?.errors),
      "Validation response contains error list"
    );

    // -------------------------------------------------------------------------
    // TEST 4: Centralized Error Handler with AppError
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 4: AppError Handling] ---");
    const customError = await request("/api/test-custom-error");
    assert(customError.status === 404, "Custom AppError returns mapped statusCode (404)");
    assert(
      customError.body?.code === "WORKSPACE_NOT_FOUND",
      "AppError code matches WORKSPACE_NOT_FOUND"
    );
    assert(customError.body?.message === "Workspace not found", "AppError message matches");

    // -------------------------------------------------------------------------
    // TEST 5: Graceful server shutdown & DB disconnect
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 5: Graceful Shutdown] ---");
    await new Promise<void>((resolve, reject) => {
      server.close(async (err) => {
        if (err) return reject(err);
        await disconnectDatabase();
        assert(true, "Server and database gracefully shut down");
        resolve();
      });
    });
  } catch (error) {
    console.error("❌ Unexpected backend test error:", error);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`📊 BACKEND TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runBackendTests();
