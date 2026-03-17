import type { FastifyInstance } from "fastify";
import { redisConnection } from "@xtanbot/redis";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("PushRoute");

export async function pushRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/push/register",
    {
      preHandler: async (request, reply) => {
        // Reuse existing JWT auth middleware
        // @ts-expect-error decorated in plugins
        await app.authenticate(request, reply);
      },
    },
    async (request, reply) => {
      const { token } = request.body as { token?: string };
      const user = request.user as { userId: string } | undefined;

      if (!user?.userId) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      if (!token) {
        return reply.status(400).send({ message: "token is required" });
      }

      await redisConnection.set(
        `push-token:${user.userId}`,
        token,
        "EX",
        30 * 24 * 60 * 60,
      );

      logger.info({ userId: user.userId }, "Push token registered");

      return reply.send({ success: true });
    },
  );
}

