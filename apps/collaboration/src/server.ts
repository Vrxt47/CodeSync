import { Hocuspocus } from "@hocuspocus/server";
import { env } from "./config/env";

export function createCollaborationServer(): Hocuspocus {
  const server = new Hocuspocus({
    port: env.PORT,
    address: env.HOST,

    async onListen(data) {
      console.log(`🚀 CodeSync Collaboration Server running on ws://${env.HOST}:${data.port}`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
    },

    async onDestroy() {
      console.log("👋 CodeSync Collaboration Server stopped.");
    },

    async onConfigure() {
      console.log("⚙️  Configuring CodeSync Hocuspocus Collaboration Server...");
    },
  });

  return server;
}
