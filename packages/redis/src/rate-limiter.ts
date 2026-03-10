import { redisConnection } from "./client";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("RateLimiter");

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const count = await redisConnection.incr(key);

  if (count === 1) {
    await redisConnection.expire(key, windowSeconds);
  }

  if (count > limit) {
    const ttl = await redisConnection.ttl(key);
    logger.warn({ key, count, limit }, "Rate limit exceeded");
    return { allowed: false, retryAfterSeconds: ttl };
  }

  return { allowed: true, remaining: limit - count };
}

export async function getRateLimitCount(key: string): Promise<number> {
  const val = await redisConnection.get(key);
  return val ? parseInt(val, 10) : 0;
}

export async function resetRateLimit(key: string): Promise<void> {
  await redisConnection.del(key);
}
