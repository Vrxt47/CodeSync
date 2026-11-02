import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";

async function bootstrap(): Promise<void> {
  try {
    // 1. Connect to PostgreSQL and verify database connectivity
    await connectDatabase();

    // 2. Initialize Express application
    const app = createApp();
    const PORT = env.PORT || 4000;

    // 3. Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 CodeSync API server running on http://localhost:${PORT}`);
      console.log(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
    });

    // 4. Graceful shutdown handler
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`\n🛑 Received ${signal}. Shutting down API server gracefully...`);

      server.close(async () => {
        console.log("👋 CodeSync HTTP server closed.");
        try {
          await disconnectDatabase();
          process.exit(0);
        } catch (dbErr) {
          console.error("⚠️ Error disconnecting database during shutdown:", dbErr);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds if connections are hanging
      setTimeout(() => {
        console.error("⚠️ Forcefully shutting down API server after timeout.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Failed to start CodeSync API server:", error);
    process.exit(1);
  }
}

void bootstrap();
