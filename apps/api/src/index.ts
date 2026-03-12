import Fastify from "fastify";
import { createLogger } from "@xtanbot/logger";
import { serverConfig } from "./config/server.config";
import { registerPlugins } from "./plugins";
import { healthRoutes } from "./routes/health.route";
import { twilioRoutes } from "./routes/twilio.route";
import { callsRoutes } from "./routes/calls.route";
import { meetingsRoutes } from "./routes/meetings.route";
import { contactsRoutes } from "./routes/contacts.route";
import { usersRoutes } from "./routes/users.route";

const logger = createLogger("API");

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  await registerPlugins(app);

  await app.register(healthRoutes);
  await app.register(twilioRoutes);
  await app.register(usersRoutes);
  await app.register(callsRoutes);
  await app.register(meetingsRoutes);
  await app.register(contactsRoutes);

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
}

bootstrap().catch((err) => {
  console.error("Fatal error during bootstrap:", err);
  process.exit(1);
});
