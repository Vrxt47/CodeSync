const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

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

const startTime = Date.now();
const TIMEOUT_MS = 30000;

console.log("=================================================");
console.log("🔍 DIAGNOSTIC: LOCAL PRISMA CLI RESOLUTION & STATUS");
console.log("=================================================");

// 1. Root & working directory
const rootDir = path.resolve(__dirname, "..");
console.log(`[DIAG] Root directory:      ${rootDir}`);
console.log(`[DIAG] Working directory:   ${process.cwd()}`);

// 2. Load .env.test explicitly
const envTestPath = path.join(rootDir, ".env.test");
if (!fs.existsSync(envTestPath)) {
  console.error(`❌ [DIAG] .env.test not found at ${envTestPath}`);
  process.exit(1);
}

const parsedEnv = parseEnvFile(envTestPath);
const targetDbUrl = parsedEnv.DATABASE_URL;

if (!targetDbUrl || !targetDbUrl.includes("codesync_test")) {
  console.error(
    `❌ [DIAG] DATABASE_URL in .env.test is invalid or does not target codesync_test: ${targetDbUrl}`
  );
  process.exit(1);
}

const maskedUrl = targetDbUrl.replace(/:([^:@]+)@/, ":****@");
console.log(`[DIAG] Test DATABASE_URL:  ${maskedUrl}`);

// 3. Resolve local Prisma CLI entrypoint (guaranteed local Prisma 5.22, no npx download)
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

console.log(`[DIAG] Local Prisma CLI:    ${localPrismaCli}`);
console.log(`[DIAG] Schema Path:         ${schemaPath}`);

if (!fs.existsSync(localPrismaCli)) {
  console.error(`❌ [DIAG] Local Prisma CLI build entrypoint not found at ${localPrismaCli}`);
  process.exit(1);
}

if (!fs.existsSync(schemaPath)) {
  console.error(`❌ [DIAG] schema.prisma not found at ${schemaPath}`);
  process.exit(1);
}

// 4. Spawn child process with local node and bounded timeout
const args = [localPrismaCli, "migrate", "status", "--schema", schemaPath];

console.log(`[DIAG] Spawning: ${process.execPath} ${args.join(" ")}`);
console.log(`[DIAG] Timeout bounded at ${TIMEOUT_MS / 1000}s`);

const childEnv = {
  ...process.env,
  ...parsedEnv,
  NODE_ENV: "test",
  DATABASE_URL: targetDbUrl,
};

const child = spawn(process.execPath, args, {
  cwd: rootDir,
  env: childEnv,
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (data) => {
  stdout += data.toString();
});

child.stderr.on("data", (data) => {
  stderr += data.toString();
});

const timer = setTimeout(() => {
  console.error(
    `❌ [DIAG] TIMEOUT EXCEEDED (${TIMEOUT_MS}ms). Killing child process PID: ${child.pid}`
  );
  child.kill("SIGKILL");
}, TIMEOUT_MS);

child.on("error", (err) => {
  clearTimeout(timer);
  const elapsed = Date.now() - startTime;
  console.error(`❌ [DIAG] Child process error after ${elapsed}ms:`, err);
  process.exit(1);
});

child.on("close", (code, signal) => {
  clearTimeout(timer);
  const elapsed = Date.now() - startTime;
  console.log(`\n--- [CHILD PROCESS RESULTS] ---`);
  console.log(`  PID:          ${child.pid}`);
  console.log(`  Exit Code:    ${code}`);
  console.log(`  Signal:       ${signal || "none"}`);
  console.log(`  Elapsed Time: ${elapsed}ms`);

  if (stdout.trim()) {
    console.log(`\n--- [STDOUT] ---`);
    console.log(stdout.trim());
  }

  if (stderr.trim()) {
    console.log(`\n--- [STDERR] ---`);
    console.log(stderr.trim());
  }

  console.log("=================================================");
  if (code === 0) {
    console.log(
      "✅ DIAGNOSTIC PASSED: Local Prisma CLI executed and reported status successfully."
    );
    process.exit(0);
  } else {
    console.error(`❌ DIAGNOSTIC FAILED with exit code ${code}`);
    process.exit(code || 1);
  }
});
