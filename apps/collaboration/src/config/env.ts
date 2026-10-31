import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number.parseInt(process.env.COLLAB_PORT || process.env.PORT || "1234", 10),
  HOST: process.env.COLLAB_HOST || "0.0.0.0",
};
