import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Automatically locate and load the root .env file by traversing upwards
function loadRootEnv(): void {
  const startDirs = [process.cwd(), __dirname];
  for (const startDir of startDirs) {
    let currentDir = startDir;
    while (currentDir && currentDir !== path.parse(currentDir).root) {
      const candidateEnv = path.join(currentDir, ".env");
      if (fs.existsSync(candidateEnv)) {
        dotenv.config({ path: candidateEnv });
        return;
      }
      currentDir = path.dirname(currentDir);
    }
  }
  dotenv.config();
}

loadRootEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLIENT_URL: z.string().default(process.env.CORS_ORIGIN || "http://localhost:3000"),
  CORS_ORIGIN: z.string().default(process.env.CLIENT_URL || "http://localhost:3000"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16)
    .default("codesync-dev-jwt-access-secret-minimum-32-chars-long"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().default(7),
  REFRESH_TOKEN_GRACE_WINDOW_MS: z.coerce.number().default(15000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment configuration. Check your .env file.");
}

export const env = parsed.data;
export type EnvConfig = z.infer<typeof envSchema>;
