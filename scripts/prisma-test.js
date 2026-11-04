const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const envTestPath = path.join(rootDir, ".env.test");

if (!fs.existsSync(envTestPath)) {
  console.error("❌ FATAL: .env.test not found at " + envTestPath);
  process.exit(1);
}

// Zero-dependency .env parser
function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const result = {};
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
      result[key] = val;
    }
  }
  return result;
}

const parsedEnv = parseEnvFile(envTestPath);
const targetDbUrl = parsedEnv.DATABASE_URL;

if (!targetDbUrl || !targetDbUrl.includes("codesync_test")) {
  console.error(
    "❌ FATAL: DATABASE_URL in .env.test must point strictly to codesync_test, got: " + targetDbUrl
  );
  process.exit(1);
}

const localPrismaCli = path.join(
  rootDir,
  "packages",
  "database",
  "node_modules",
  "prisma",
  "build",
  "index.js"
);
const schemaPath = path.join(rootDir, "packages", "database", "prisma", "schema.prisma");

if (!fs.existsSync(localPrismaCli)) {
  console.error("❌ FATAL: Local Prisma CLI build entrypoint not found at " + localPrismaCli);
  process.exit(1);
}

if (!fs.existsSync(schemaPath)) {
  console.error("❌ FATAL: schema.prisma not found at " + schemaPath);
  process.exit(1);
}

const userArgs = process.argv.slice(2);
const args = [localPrismaCli, ...userArgs, "--schema", schemaPath];

const childEnv = {
  ...process.env,
  ...parsedEnv,
  NODE_ENV: "test",
  DATABASE_URL: targetDbUrl,
};

const TIMEOUT_MS = Number(process.env.PRISMA_TIMEOUT_MS) || 60000;

const child = spawn(process.execPath, args, {
  cwd: rootDir,
  env: childEnv,
  stdio: "inherit",
});

const timer = setTimeout(() => {
  console.error(
    `❌ [PRISMA-TEST] Command timed out after ${TIMEOUT_MS / 1000}s. Terminating child process PID: ${child.pid}`
  );
  child.kill("SIGKILL");
}, TIMEOUT_MS);

child.on("error", (err) => {
  clearTimeout(timer);
  console.error("❌ [PRISMA-TEST] Child process error:", err);
  process.exit(1);
});

child.on("close", (code, signal) => {
  clearTimeout(timer);
  if (signal) {
    console.error(`⚠️ [PRISMA-TEST] Child process exited with signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
