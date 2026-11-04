import fs from "node:fs";
import path from "node:path";

// Explicitly load root .env with zero external dependencies
function loadRootDevEnv(): void {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) {
    throw new Error(`❌ FATAL: Root .env file not found at ${envPath}`);
  }

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadRootDevEnv();

import { prisma } from "../packages/database/src";

async function main() {
  console.log("Database URL present:", !!process.env.DATABASE_URL);
  if (process.env.DATABASE_URL) {
    const masked = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@");
    console.log("Database URL:", masked);
  }

  // 1. SELECT 1 connectivity test
  const start = Date.now();
  const ping = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
  console.log(`✅ Database connectivity test (SELECT 1):`, ping, `in ${Date.now() - start}ms`);

  // 2. Query Users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          workspaces: true,
          memberships: true,
        },
      },
    },
  });
  console.log("\n--- [DATABASE USERS] ---");
  console.log(JSON.stringify(users, null, 2));

  // 3. Query Workspaces
  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      owner: {
        select: {
          id: true,
          email: true,
        },
      },
      createdAt: true,
      _count: {
        select: {
          members: true,
          files: true,
        },
      },
    },
  });
  console.log("\n--- [DATABASE WORKSPACES] ---");
  console.log(JSON.stringify(workspaces, null, 2));

  // 4. Query files grouped by workspace
  for (const ws of workspaces) {
    const files = await prisma.file.findMany({
      where: { workspaceId: ws.id },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
      },
    });
    console.log(`\n--- [FILES IN WORKSPACE: ${ws.name} (${ws.id})] ---`);
    console.log(JSON.stringify(files, null, 2));
  }
}

main()
  .catch((err) => {
    console.error("❌ Database query failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
