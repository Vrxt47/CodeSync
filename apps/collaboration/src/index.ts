import { createCollaborationServer } from "./server";

async function main(): Promise<void> {
  const server = createCollaborationServer();

  try {
    await server.listen();
  } catch (error) {
    console.error("❌ Failed to start CodeSync Collaboration Server:", error);
    process.exit(1);
  }

  async function shutdown(signal: string): Promise<void> {
    console.log(`\n🛑 Received ${signal}. Shutting down collaboration server gracefully...`);
    try {
      await server.destroy();
      process.exit(0);
    } catch (err) {
      console.error("Error during collaboration server shutdown:", err);
      process.exit(1);
    }
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main();
