import { prisma, PrismaClient } from "@codesync/database";

export { prisma, PrismaClient };

/**
 * Connect to PostgreSQL and verify database connectivity with a lightweight query.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    // Execute a lightweight query to verify active connectivity
    await prisma.$queryRawUnsafe("SELECT 1");
    console.log("✅ Successfully connected to PostgreSQL database.");
  } catch (error) {
    console.error("❌ Failed to connect to PostgreSQL database:", error);
    throw error;
  }
}

/**
 * Disconnect from PostgreSQL cleanly for graceful shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log("👋 Disconnected from PostgreSQL database.");
  } catch (error) {
    console.error("⚠️ Error while disconnecting from PostgreSQL:", error);
  }
}

/**
 * Check if the database connection is currently healthy.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
