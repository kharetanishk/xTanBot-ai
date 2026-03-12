import { Worker, type Job } from "bullmq";
import { NOTIFICATION_QUEUE_NAME } from "@xtanbot/queues";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import type { NotificationJob } from "@xtanbot/queues";

const logger = createLogger("NotificationWorker");

const connection = {
  host: new URL(config.REDIS_URL).hostname,
  port: parseInt(new URL(config.REDIS_URL).port || "6379"),
  password: new URL(config.REDIS_URL).password || undefined,
};

async function processNotificationJob(
  job: Job<NotificationJob>,
): Promise<void> {
  const { userId, type, title, body } = job.data;

  logger.info({ userId, type, jobId: job.id }, "Processing notification job");

  // TODO Day 4: wire to push notification service (FCM/APNs)
  // For now just log
  logger.info({ userId, type, title, body }, "Notification sent (mock)");
}

export function createNotificationWorker(): Worker {
  const worker = new Worker(NOTIFICATION_QUEUE_NAME, processNotificationJob, {
    connection,
    concurrency: 20,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Notification job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Notification job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Notification worker error");
  });

  logger.info("Notification worker started");

  return worker;
}
