import { createLogger } from "@xtanbot/logger";
import { createAgentWorker } from "./workers/agent.worker";
import { createNotificationWorker } from "./workers/notification.worker";

const logger = createLogger("Worker");

async function bootstrap(): Promise<void> {
  logger.info("Starting xTanBot workers...");

  const agentWorker = createAgentWorker();
  const notificationWorker = createNotificationWorker();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down workers...");

    await Promise.all([agentWorker.close(), notificationWorker.close()]);

    logger.info("All workers shut down cleanly");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  logger.info("All workers running. Waiting for jobs...");
}

bootstrap().catch((err) => {
  console.error("Fatal error during worker bootstrap:", err);
  process.exit(1);
});
