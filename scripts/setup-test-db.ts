import { spawn } from "node:child_process";
import path from "node:path";
import { prisma } from "../apps/api/src/config/database";

async function setupTestDb() {
  console.log("=================================================");
  console.log("🛠️ SETTING UP CODESYNC ISOLATED TEST DATABASE");
  console.log("=================================================");

  try {
    // 1. Check if database exists
    const dbs = await prisma.$queryRaw<Array<{ datname: string }>>`
      SELECT datname FROM pg_database WHERE datname = 'codesync_test';
    `;

    if (dbs.length === 0) {
      console.log("Creating database codesync_test...");
      await prisma.$executeRawUnsafe("CREATE DATABASE codesync_test;");
      console.log("✅ Database codesync_test created.");
    } else {
      console.log("✅ Database codesync_test already exists.");
    }
  } catch (err) {
    console.warn("Notice checking/creating database:", err);
  } finally {
    await prisma.$disconnect();
  }

  // 2. Run migrations using local Prisma CLI runner with bounded execution
  console.log("\n📦 Applying migrations to codesync_test...");
  const prismaRunner = path.resolve(__dirname, "prisma-test.js");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [prismaRunner, "migrate", "deploy"], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Timeout applying test migrations after 60s"));
    }, 60000);

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Prisma migrate deploy exited with code ${code}`));
      }
    });
  });

  console.log("=================================================");
  console.log("✅ ISOLATED TEST DATABASE SETUP COMPLETE");
  console.log("=================================================");
}

setupTestDb().catch((err) => {
  console.error("❌ Failed to setup test database:", err);
  process.exit(1);
});
