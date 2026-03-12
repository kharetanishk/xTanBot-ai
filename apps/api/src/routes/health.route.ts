import type { FastifyInstance } from "fastify";
import { prisma } from "@xtanbot/db";
import { redisConnection } from "@xtanbot/redis";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("HealthRoute");

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_req, reply) => {
    const checks = {
      api: "ok",
      database: "unknown",
      redis: "unknown",
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
      logger.error("Database health check failed");
    }

    try {
      await redisConnection.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
      logger.error("Redis health check failed");
    }

    const allOk = Object.values(checks).every((v) => v === "ok");

    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
