import { Queue } from "bullmq";
import { config } from "@xtanbot/config";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("NotificationQueue");

export const NOTIFICATION_QUEUE_NAME = "xtanbot-notification" as const;
export const NOTIFICATION_JOB_NAME = "notification-send" as const;

const connection = {
  host: new URL(config.REDIS_URL).hostname,
  port: parseInt(new URL(config.REDIS_URL).port || "6379"),
  password: new URL(config.REDIS_URL).password || undefined,
};

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

notificationQueue.on("error", (err) => {
  logger.error({ err }, "Notification queue error");
});
