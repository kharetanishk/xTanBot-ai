import Fastify from "fastify";
import { randomUUID, timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/node";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { createLogger } from "@xtanbot/logger";
import { subscribeToEvent } from "@xtanbot/events";
import { playAgentVoiceResponse } from "@xtanbot/voice-pipeline";
import { config } from "@xtanbot/config";
import { collectMetrics, metricsContentType } from "@xtanbot/observability";
import {
  agentQueue,
  ttsQueue,
  notificationQueue,
  meetingCallQueue,
} from "@xtanbot/queues";
import { serverConfig } from "./config/server.config";
import { registerPlugins } from "./plugins";
import { healthRoutes } from "./routes/health.route";
import { twilioRoutes } from "./routes/twilio.route";
import { callsRoutes } from "./routes/calls.route";
import { meetingsRoutes } from "./routes/meetings.route";
import { contactsRoutes } from "./routes/contacts.route";
import { conversationsRoutes } from "./routes/conversations.route";
import { pushRoutes } from "./routes/push.route";
import { usersRoutes } from "./routes/users.route";

const logger = createLogger("API");

async function bootstrap(): Promise<void> {
  if (config.SENTRY_DSN) {
    Sentry.init({
      dsn: config.SENTRY_DSN,
      environment: config.NODE_ENV,
      tracesSampleRate: 0.1,
    });
    logger.info("Sentry initialised for API");
  } else {
    logger.info("Sentry DSN not set — error monitoring disabled");
  }

  const app = Fastify({
    logger: false,
    trustProxy: true,
    genReqId: () => randomUUID(),
  });

  // Twilio webhooks send application/x-www-form-urlencoded bodies.
  // Parse them into a key/value object so routes can read request.body.CallSid, etc.
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        const parsed = Object.fromEntries(
          new URLSearchParams(body as string),
        ) as Record<string, string>;
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await registerPlugins(app);

  // ── Bull Board Admin Dashboard ─────────────────────────
  const serverAdapter = new FastifyAdapter();

  createBullBoard({
    queues: [
      new BullMQAdapter(agentQueue),
      new BullMQAdapter(ttsQueue),
      new BullMQAdapter(notificationQueue),
      new BullMQAdapter(meetingCallQueue),
    ],
    serverAdapter,
  });

  serverAdapter.setBasePath("/admin/queues");

  await app.register(serverAdapter.registerPlugin(), {
    prefix: "/admin/queues",
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/admin/queues")) return;
    if (!config.BULL_BOARD_PASSWORD) return;

    const authHeader = request.headers.authorization ?? "";
    if (!authHeader.startsWith("Basic ")) {
      void reply
        .status(401)
        .header("WWW-Authenticate", 'Basic realm="xTanBot Admin"')
        .send("Unauthorized");
      return;
    }

    const base64 = authHeader.slice(6);
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    const [username, ...passwordParts] = decoded.split(":");
    const password = passwordParts.join(":");

    const expectedUser = Buffer.from(config.BULL_BOARD_USERNAME);
    const expectedPass = Buffer.from(config.BULL_BOARD_PASSWORD);
    const actualUser   = Buffer.from(username ?? "");
    const actualPass   = Buffer.from(password ?? "");

    const userMatch =
      actualUser.length === expectedUser.length &&
      timingSafeEqual(actualUser, expectedUser);
    const passMatch =
      actualPass.length === expectedPass.length &&
      timingSafeEqual(actualPass, expectedPass);

    if (!userMatch || !passMatch) {
      void reply
        .status(401)
        .header("WWW-Authenticate", 'Basic realm="xTanBot Admin"')
        .send("Unauthorized");
    }
  });

  logger.info("Bull Board mounted at /admin/queues");

  await app.register(healthRoutes);
  await app.register(twilioRoutes);
  await app.register(usersRoutes);
  await app.register(callsRoutes);
  await app.register(meetingsRoutes);
  await app.register(contactsRoutes);
  await app.register(conversationsRoutes);
  await app.register(pushRoutes);

  app.get(
    "/metrics",
    { config: { rateLimit: { max: 600 } } },
    async (_request, reply) => {
      const metrics = await collectMetrics();
      return reply
        .status(200)
        .header("Content-Type", metricsContentType())
        .send(metrics);
    },
  );

  app.addHook("onSend", async (request, reply) => {
    void reply.header("X-Request-Id", request.id);
  });

  app.setErrorHandler((error, _request, reply) => {
    logger.error({ err: error }, "Unhandled error");

    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: error.message,
      });
    }

    return reply.status(500).send({
      statusCode: 500,
      error: "Internal Server Error",
      message: serverConfig.isDev ? error.message : "Something went wrong",
    });
  });

  await app.listen({
    port: serverConfig.port,
    host: serverConfig.host,
  });

  logger.info(
    { port: serverConfig.port, host: serverConfig.host },
    "API server started",
  );

  subscribeToEvent("agent.responded", async (event) => {
    if (event.type !== "agent.responded") return;
    const sessionId =
      typeof event.sessionId === "string" ? event.sessionId : "";
    const text = typeof event.text === "string" ? event.text : "";
    if (!sessionId || !text) return;
    await playAgentVoiceResponse(sessionId, text);
  });
  logger.info("Subscribed to agent.responded for voice TTS playback");

  const shutdown = async (signal: string, exitCode: number): Promise<void> => {
    logger.info({ signal }, "Shutting down API server...");
    try {
      await app.close();
      logger.info("API server shut down cleanly");
    } catch (err) {
      logger.error({ err }, "Error during API shutdown");
    } finally {
      process.exit(exitCode);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM", 0));
  process.on("SIGINT", () => void shutdown("SIGINT", 0));

  process.on("uncaughtException", (err) => {
    logger.error({ err }, "Uncaught exception");
    if (config.SENTRY_DSN) Sentry.captureException(err);
    void shutdown("uncaughtException", 1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled promise rejection");
    if (config.SENTRY_DSN) {
      Sentry.captureException(
        reason instanceof Error ? reason : new Error(String(reason)),
      );
    }
    void shutdown("unhandledRejection", 1);
  });
}

bootstrap().catch((err) => {
  console.error("Fatal error during bootstrap:", err);
  process.exit(1);
});
