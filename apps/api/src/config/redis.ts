import Redis from "ioredis";
import { env } from "./env";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          // Cease retrying excessively if Redis service is not yet started in dev
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisClient.on("connect", () => {
      console.log("✅ Connected to Redis successfully");
    });

    redisClient.on("error", (err) => {
      // In development, log friendly warning if Redis service is not yet up
      if (process.env.NODE_ENV === "development") {
        console.warn(`⚠️ Redis notice: ${err.message}`);
      } else {
        console.error("❌ Redis connection error:", err);
      }
    });
  }

  return redisClient;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (client.status !== "ready") {
      await client.connect();
    }
    const pong = await client.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
