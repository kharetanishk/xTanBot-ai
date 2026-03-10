import { redisConnection } from "./client";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("RedisCache");

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redisConnection.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  await redisConnection.setex(key, ttlSeconds, JSON.stringify(value));
  logger.debug({ key, ttlSeconds }, "Cache set");
}

export async function cacheDelete(key: string): Promise<void> {
  await redisConnection.del(key);
}

export async function cacheMGet<T>(keys: string[]): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  const values = await redisConnection.mget(...keys);
  return values.map((v) => (v ? (JSON.parse(v) as T) : null));
}
