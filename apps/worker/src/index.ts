import * as Sentry from "@sentry/node";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import { meetingCallQueue } from "@xtanbot/queues";
import { createAgentWorker } from "./workers/agent.worker";
import { createNotificationWorker } from "./workers/notification.worker";
import { createMeetingCallWorker } from "./workers/meeting-call.worker";
import {
  startAlarmScheduler,
  stopAlarmScheduler,
} from "./workers/alarm.worker";

const logger = createLogger("Worker");

async function scheduleDailyBriefings(): Promise<void> {
  try {
    await meetingCallQueue.removeRepeatable("daily-briefing", {
      pattern: "0 8 * * *",
      tz: "Asia/Kolkata",
    });
  } catch {
    // ignore if not present yet
  }

  await meetingCallQueue.add(
    "daily-briefing",
    { type: "daily-briefing" },
    {
      repeat: {
        pattern: "0 8 * * *",
        tz: "Asia/Kolkata",
      },
    },
  );

  logger.info("Daily briefing scheduled for 8am IST");
}

async function bootstrap(): Promise<void> {
  if (config.SENTRY_DSN) {
    Sentry.init({
      dsn: config.SENTRY_DSN,
      environment: config.NODE_ENV,
      tracesSampleRate: 0.1,
    });
    logger.info("Sentry initialised for Worker");
  } else {
    logger.info("Sentry DSN not set — error monitoring disabled");
  }

  logger.info("Starting xTanBot workers...");

  const agentWorker = createAgentWorker();
  const notificationWorker = createNotificationWorker();
  const meetingCallWorker = createMeetingCallWorker();

  await scheduleDailyBriefings();

  startAlarmScheduler();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down workers...");

    stopAlarmScheduler();

    await Promise.all([
      agentWorker.close(),
      notificationWorker.close(),
      meetingCallWorker.close(),
    ]);

    logger.info("All workers shut down cleanly");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.error({ err }, "Uncaught exception in worker");
    if (config.SENTRY_DSN) Sentry.captureException(err);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled rejection in worker");
    if (config.SENTRY_DSN) {
      Sentry.captureException(
        reason instanceof Error ? reason : new Error(String(reason)),
      );
    }
    process.exit(1);
  });

  logger.info("All workers running. Waiting for jobs...");
}

bootstrap().catch((err) => {
  console.error("Fatal error during worker bootstrap:", err);
  process.exit(1);
});
