import IORedis from "ioredis";
import { config } from "@xtanbot/config";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("RedisClient");

export const redisConnection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
  retryStrategy: (times: number): number | null => {
    if (times > 5) {
      logger.error({ attempts: times }, "Redis max reconnect attempts exceeded");
      return null;
    }
    const delay = Math.min(Math.pow(2, times - 1) * 500, 2000);
    logger.warn({ attempt: times, delayMs: delay }, "Redis reconnecting");
    return delay;
  },
  reconnectOnError: (err: Error): boolean => {
    const reconnectCodes = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"];
    return reconnectCodes.some((code) => err.message.includes(code));
  },
});

redisConnection.on("connect", () => {
  logger.info("Redis connected");
});

redisConnection.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

redisConnection.on("close", () => {
  logger.warn("Redis connection closed");
});
