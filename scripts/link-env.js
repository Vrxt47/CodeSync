const fs = require("node:fs");
const path = require("node:path");

const rootEnv = path.resolve(__dirname, "..", ".env");
const dbEnv = path.resolve(__dirname, "..", "packages", "database", ".env");

if (fs.existsSync(rootEnv)) {
  try {
    if (!fs.existsSync(dbEnv)) {
      fs.linkSync(rootEnv, dbEnv);
      console.log("🔗 Created hardlink: packages/database/.env -> .env");
    }
  } catch (error) {
    // If hardlinks are unsupported across devices/partitions, package scripts use dotenv-cli as fallback
    console.warn("⚠️ Could not create hardlink (handled by dotenv-cli):", error.message);
  }
}
