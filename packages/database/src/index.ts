import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Ensure root .env is loaded if DATABASE_URL is not yet defined in the environment
if (!process.env.DATABASE_URL) {
  const startDirs = [process.cwd(), __dirname];
  for (const startDir of startDirs) {
    let currentDir = startDir;
    while (currentDir && currentDir !== path.parse(currentDir).root) {
      const candidateEnv = path.join(currentDir, ".env");
      if (fs.existsSync(candidateEnv)) {
        dotenv.config({ path: candidateEnv });
        if (process.env.DATABASE_URL) break;
      }
      currentDir = path.dirname(currentDir);
    }
    if (process.env.DATABASE_URL) break;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export * from "@prisma/client";
