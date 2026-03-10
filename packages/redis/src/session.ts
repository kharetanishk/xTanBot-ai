import { redisConnection } from "./client";
import { createLogger } from "@xtanbot/logger";
import { CallSessionSchema } from "@xtanbot/zod-schemas";
import type { CallSession } from "@xtanbot/zod-schemas";

const logger = createLogger("RedisSession");

const SESSION_KEY = (id: string) => `voice:session:${id}`;
const DEFAULT_TTL = 3600;

export async function getSession(
  sessionId: string,
): Promise<CallSession | null> {
  const raw = await redisConnection.get(SESSION_KEY(sessionId));
  if (!raw) return null;

  const parsed = CallSessionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    logger.warn({ sessionId }, "Invalid session data in Redis — discarding");
    await redisConnection.del(SESSION_KEY(sessionId));
    return null;
  }

  return parsed.data;
}

export async function setSession(
  sessionId: string,
  data: CallSession,
  ttlSeconds = DEFAULT_TTL,
): Promise<void> {
  await redisConnection.setex(
    SESSION_KEY(sessionId),
    ttlSeconds,
    JSON.stringify(data),
  );
  logger.debug({ sessionId, ttlSeconds }, "Session stored");
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redisConnection.del(SESSION_KEY(sessionId));
  logger.debug({ sessionId }, "Session deleted");
}

export async function refreshSession(
  sessionId: string,
  ttlSeconds = DEFAULT_TTL,
): Promise<void> {
  await redisConnection.expire(SESSION_KEY(sessionId), ttlSeconds);
}
