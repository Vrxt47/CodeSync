import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();
const PORT = env.PORT || env.API_PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`🚀 CodeSync API server running on http://localhost:${PORT}`);
  console.log(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
});

function gracefulShutdown(signal: string): void {
  console.log(`\n🛑 Received ${signal}. Shutting down API server gracefully...`);
  server.close(() => {
    console.log("👋 CodeSync API server closed.");
    process.exit(0);
  });

  // Force shutdown after timeout if pending connections take too long
  setTimeout(() => {
    console.error("⚠️ Forcefully shutting down API server after timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
