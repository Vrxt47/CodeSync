const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const envTestPath = path.join(rootDir, ".env.test");

if (!fs.existsSync(envTestPath)) {
  console.error("❌ FATAL SAFETY GUARD: .env.test not found at " + envTestPath);
  console.error("Integration tests must strictly use .env.test. Refusing to run.");
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

if (!targetDbUrl) {
  console.error("❌ FATAL SAFETY GUARD: DATABASE_URL is missing from .env.test!");
  process.exit(1);
}

// Extract database name from URL
let dbName = "";
try {
  const parsed = new URL(
    targetDbUrl.startsWith("postgresql://") || targetDbUrl.startsWith("postgres://")
      ? targetDbUrl
      : `postgresql://${targetDbUrl}`
  );
  dbName = parsed.pathname.replace(/^\//, "");
} catch {
  console.error(`❌ FATAL SAFETY GUARD: Malformed DATABASE_URL: ${targetDbUrl}`);
  process.exit(1);
}

if (dbName !== "codesync_test") {
  console.error("\n=======================================================");
  console.error("🛑 FATAL SAFETY GUARD: INCORRECT TEST DATABASE TARGET");
  console.error("=======================================================");
  console.error(`Connected URL specifies database: "${dbName}"`);
  console.error('Required database is strictly: "codesync_test"');
  console.error("Tests must NEVER target development or production databases.");
  console.error("=======================================================\n");
  process.exit(1);
}

// Target test script
const targetScriptArg = process.argv[2];
if (!targetScriptArg) {
  console.error("Usage: node scripts/run-test.js <path-to-test-script> [...extra-args]");
  process.exit(1);
}

const targetScript = path.isAbsolute(targetScriptArg)
  ? targetScriptArg
  : path.resolve(rootDir, targetScriptArg);

if (!fs.existsSync(targetScript)) {
  console.error(`❌ FATAL: Target test script does not exist: ${targetScript}`);
  process.exit(1);
}

// Resolve local tsx CLI entrypoint
const tsxCli = path.join(rootDir, "packages", "database", "node_modules", "tsx", "dist", "cli.mjs");

if (!fs.existsSync(tsxCli)) {
  console.error(`❌ FATAL: Local tsx CLI not found at ${tsxCli}`);
  process.exit(1);
}

const extraArgs = process.argv.slice(3);
const childArgs = [tsxCli, targetScript, ...extraArgs];

const childEnv = {
  ...process.env,
  ...parsedEnv,
  NODE_ENV: "test",
  DATABASE_URL: targetDbUrl,
};

const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS) || 180000; // 3 minutes default timeout

console.log(`[TEST-RUNNER] Launching: ${path.basename(targetScript)} (PID: pending)`);
console.log(`[TEST-RUNNER] Target Database: codesync_test`);
console.log(`[TEST-RUNNER] Timeout Bounded: ${TIMEOUT_MS / 1000}s`);

const startTime = Date.now();
const child = spawn(process.execPath, childArgs, {
  cwd: rootDir,
  env: childEnv,
  stdio: "inherit",
});

console.log(`[TEST-RUNNER] Child PID: ${child.pid}`);

const timer = setTimeout(() => {
  console.error(
    `\n❌ [TEST-RUNNER] Test exceeded timeout of ${TIMEOUT_MS / 1000}s! Killing child process PID: ${child.pid}`
  );
  child.kill("SIGKILL");
}, TIMEOUT_MS);

// Forward process termination signals cleanly
process.on("SIGINT", () => {
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});

child.on("error", (err) => {
  clearTimeout(timer);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.error(`❌ [TEST-RUNNER] Child process failed to launch after ${elapsed}s:`, err);
  process.exit(1);
});

child.on("close", (code, signal) => {
  clearTimeout(timer);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  if (signal) {
    console.error(
      `⚠️ [TEST-RUNNER] Child process terminated with signal ${signal} after ${elapsed}s`
    );
    process.exit(1);
  }
  console.log(`[TEST-RUNNER] Completed in ${elapsed}s with exit code ${code ?? 0}`);
  process.exit(code ?? 0);
});
