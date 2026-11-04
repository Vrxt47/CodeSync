import { prisma } from "../apps/api/src/config/database";

export const REQUIRED_TEST_DATABASE_NAME = "codesync_test";

/**
 * Strict runtime safety guard for integration tests.
 * Refuses to run unless the active connection is explicitly codesync_test.
 * Prevents accidental execution against development or production databases.
 */
export async function assertTestDatabase(customPrisma?: any): Promise<void> {
  const activePrisma = customPrisma || prisma;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "❌ FATAL SAFETY GUARD: DATABASE_URL is not set! Integration tests must load .env.test with codesync_test."
    );
  }

  // Parse database name from URL
  let dbName = "";
  try {
    const parsed = new URL(
      databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://")
        ? databaseUrl
        : `postgresql://${databaseUrl}`
    );
    dbName = parsed.pathname.replace(/^\//, "");
  } catch {
    throw new Error(`❌ FATAL SAFETY GUARD: Invalid DATABASE_URL format: ${databaseUrl}`);
  }

  if (dbName !== REQUIRED_TEST_DATABASE_NAME) {
    const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ":****@");
    console.error("\n=======================================================");
    console.error("🛑 FATAL SAFETY GUARD TRIGGERED — EXECUTION ABORTED");
    console.error("=======================================================");
    console.error(`Connected to database: "${dbName}"`);
    console.error(`Required test database: "${REQUIRED_TEST_DATABASE_NAME}"`);
    console.error(`DATABASE_URL: ${maskedUrl}`);
    console.error("Integration tests must ONLY run against codesync_test.");
    console.error("Refusing to run tests to prevent database pollution.");
    console.error("=======================================================\n");
    throw new Error(
      `SAFETY GUARD REJECTION: Integration tests must connect to "${REQUIRED_TEST_DATABASE_NAME}", but connected to "${dbName}".`
    );
  }

  // Live SQL verification
  const result = await activePrisma.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database();
  `;
  const liveDbName = result[0]?.current_database;
  if (liveDbName !== REQUIRED_TEST_DATABASE_NAME) {
    console.error("\n=======================================================");
    console.error("🛑 FATAL LIVE DATABASE CHECK FAILED — EXECUTION ABORTED");
    console.error("=======================================================");
    console.error(`PostgreSQL current_database(): "${liveDbName}"`);
    console.error(`Required test database: "${REQUIRED_TEST_DATABASE_NAME}"`);
    console.error("=======================================================\n");
    throw new Error(
      `SAFETY GUARD REJECTION: Live database check reported "${liveDbName}" instead of "${REQUIRED_TEST_DATABASE_NAME}".`
    );
  }

  console.log(`  🛡️ Safety Guard Verified: Connected to isolated test database (${liveDbName})`);
}

/**
 * Safely and gracefully shuts down an HTTP test server without hanging
 * on keep-alive connections.
 */
export async function closeTestServer(server: any): Promise<void> {
  if (!server) return;
  if (typeof server.closeIdleConnections === "function") {
    server.closeIdleConnections();
  }
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

/**
 * Deterministic test fixture tracker for integration tests.
 * Tracks exact record IDs created during each test execution, cleans them up
 * in foreign-key safe order, and verifies that no tracked records linger.
 */
export class TestFixtureTracker {
  public userIds = new Set<string>();
  public workspaceIds = new Set<string>();
  public fileIds = new Set<string>();
  public sessionIds = new Set<string>();

  public trackUser(id?: string | null) {
    if (id) this.userIds.add(id);
  }

  public trackWorkspace(id?: string | null) {
    if (id) this.workspaceIds.add(id);
  }

  public trackFile(id?: string | null) {
    if (id) this.fileIds.add(id);
  }

  public trackSession(id?: string | null) {
    if (id) this.sessionIds.add(id);
  }

  public async cleanup(): Promise<void> {
    const wsIds = Array.from(this.workspaceIds);
    const uIds = Array.from(this.userIds);
    const fIds = Array.from(this.fileIds);
    const sIds = Array.from(this.sessionIds);

    // 1. Delete workspaces (cascades to files, members, invitations, messages, executions, activity logs)
    if (wsIds.length > 0) {
      await prisma.workspace.deleteMany({
        where: { id: { in: wsIds } },
      });
    }

    // 2. Delete any lingering files tracked directly
    if (fIds.length > 0) {
      await prisma.file.deleteMany({
        where: { id: { in: fIds } },
      });
    }

    // 3. Delete sessions
    if (sIds.length > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: sIds } },
      });
    }
    if (uIds.length > 0) {
      await prisma.session.deleteMany({
        where: { userId: { in: uIds } },
      });
      // 4. Delete users
      await prisma.user.deleteMany({
        where: { id: { in: uIds } },
      });
    }
  }

  public async verifyCleanup(): Promise<void> {
    const lingeringWorkspaces = await prisma.workspace.findMany({
      where: { id: { in: Array.from(this.workspaceIds) } },
      select: { id: true, name: true },
    });
    const lingeringUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(this.userIds) } },
      select: { id: true, email: true },
    });
    const lingeringFiles = await prisma.file.findMany({
      where: { id: { in: Array.from(this.fileIds) } },
      select: { id: true, name: true },
    });

    if (lingeringWorkspaces.length > 0 || lingeringUsers.length > 0 || lingeringFiles.length > 0) {
      const report = {
        lingeringWorkspaces,
        lingeringUsers,
        lingeringFiles,
      };
      const msg = `❌ FIXTURE CLEANUP VERIFICATION FAILED!\nLingering Records: ${JSON.stringify(report, null, 2)}`;
      console.error(msg);
      throw new Error(msg);
    }
    console.log("  🧹 Fixture cleanup verified: 0 test records remaining.");
  }
}
