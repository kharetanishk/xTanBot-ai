import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware";
import { callService } from "../services/call.service";
import { CreateCallSchema } from "@xtanbot/zod-schemas";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";

const logger = createLogger("CallsRoute");

export async function callsRoutes(app: FastifyInstance): Promise<void> {
  // POST /calls/internal — initiate a call from an internal service (ai-core tool)
  app.post("/calls/internal", async (request, reply) => {
    if (request.headers["x-internal-service"] !== "ai-core") {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const body = request.body as {
      toNumber?: string;
      userId?: string;
      reason?: string;
    };

    if (!body.toNumber || !body.userId) {
      return reply.status(400).send({ error: "toNumber and userId required" });
    }

    try {
      const streamBaseUrl = config.API_URL;

      const call = await callService.initiateCall({
        toNumber: body.toNumber,
        userId: body.userId,
        streamBaseUrl,
      });

      logger.info(
        { callId: call.id, toNumber: body.toNumber, userId: body.userId },
        "Internal call initiated",
      );
      return reply.status(201).send(call);
    } catch (err) {
      logger.error({ err }, "Internal call initiation failed");
      return reply.status(500).send({
        error: "Failed to initiate call",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  // POST /calls — initiate a new call (authenticated user)
  app.post("/calls", { preHandler: requireAuth }, async (request, reply) => {
    const body = CreateCallSchema.parse(request.body);
    const { userId } = request.user;
    const host = `${request.protocol}://${request.hostname}`;

    const call = await callService.initiateCall({
      ...body,
      userId,
      streamBaseUrl: host,
    });

    return reply.status(201).send(call);
  });

  // GET /calls — get user's calls
  app.get("/calls", { preHandler: requireAuth }, async (request, reply) => {
    const { userId } = request.user;
    const calls = await callService.getUserCalls(userId);
    return reply.send(calls);
  });

  // GET /calls/:id — get specific call
  app.get("/calls/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const call = await callService.getCall(id);

    if (!call) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Call not found",
      });
    }

    return reply.send(call);
  });
}
