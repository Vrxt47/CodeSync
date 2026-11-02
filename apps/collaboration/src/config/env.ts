import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

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

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number.parseInt(process.env.COLLAB_PORT || process.env.PORT || "1234", 10),
  HOST: process.env.COLLAB_HOST || "0.0.0.0",
};
