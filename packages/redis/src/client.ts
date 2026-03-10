import { config } from "@xtanbot/config";

export function createRedisClient() {
  const { default: Redis } = await import("ioredis");
  return new Redis(config.REDIS_URL);
}
