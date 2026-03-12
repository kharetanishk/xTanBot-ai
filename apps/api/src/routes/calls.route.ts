import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware";
import { callService } from "../services/call.service";
import { CreateCallSchema } from "@xtanbot/zod-schemas";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("CallsRoute");

export async function callsRoutes(app: FastifyInstance): Promise<void> {
  // POST /calls — initiate a new call
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
