import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.middleware";
import { callService } from "../services/call.service";
import { CreateCallSchema } from "@xtanbot/zod-schemas";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import { prisma } from "@xtanbot/db";

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

  // POST /calls/story — initiate a story call directly from mobile
  app.post("/calls/story", { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as {
      toNumber?: string;
      contactName?: string;
      story: string;
      mood?: string;
      customMoodDescription?: string;
      objective?: string;
    };

    const { userId } = request.user;

    if (!body.story || body.story.trim().length < 10) {
      return reply.status(400).send({ error: "story must be at least 10 characters" });
    }

    let resolvedPhone = body.toNumber?.trim() ?? "";
    let resolvedName = body.contactName?.trim() ?? "Contact";

    if (!resolvedPhone && body.contactName) {
      const contact = await prisma.contact.findFirst({
        where: {
          userId,
          name: { contains: body.contactName.trim(), mode: "insensitive" },
          deletedAt: null,
        },
      });
      if (!contact?.phone) {
        return reply.status(404).send({ error: `No phone number found for "${body.contactName}"` });
      }
      resolvedPhone = contact.phone;
      resolvedName = contact.name;
    }

    if (!resolvedPhone) {
      return reply.status(400).send({ error: "toNumber or contactName is required" });
    }

    try {
      // 1. Create the Twilio call first so we have the real callSid.
      const call = await callService.initiateCall({
        toNumber: resolvedPhone,
        userId,
        streamBaseUrl: config.API_URL,
      });

      // 2. Store story context keyed by callSid — this is what the pipeline reads on
      //    onStart via `call-context:{callSid}`.  The twilio/voice route preserves this
      //    key and will NOT overwrite it with the generic { callType:"inbound" } default.
      const { redisConnection } = await import("@xtanbot/redis");
      const storyContext = JSON.stringify({
        userId,
        callType: "story-call",
        calleeName: resolvedName,
        story: body.story.trim(),
        mood: body.mood ?? "friendly",
        customMoodDescription: body.customMoodDescription ?? null,
        objective: body.objective?.trim() ?? "Complete the story objective",
        createdAt: new Date().toISOString(),
      });
      await redisConnection.set(`call-context:${call.callSid}`, storyContext, "EX", 3600);
      await redisConnection.set(`session:context:${call.callSid}`, storyContext, "EX", 3600);

      logger.info(
        { callId: call.id, callSid: call.callSid, toNumber: resolvedPhone, mood: body.mood },
        "Story call initiated — context stored at callSid key",
      );
      return reply.status(201).send(call);
    } catch (err) {
      logger.error({ err }, "Story call initiation failed");
      return reply.status(500).send({
        error: "Failed to initiate story call",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
}
