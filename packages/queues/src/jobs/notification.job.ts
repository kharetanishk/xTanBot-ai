import { z } from "zod";
import {
  notificationQueue,
  NOTIFICATION_JOB_NAME,
} from "../queues/notification.queue";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("NotificationJob");

export const NotificationJobSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(["meeting_reminder", "call_completed", "call_missed"]),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string()).optional(),
});

export type NotificationJob = z.infer<typeof NotificationJobSchema>;

export async function enqueueNotificationJob(
  data: NotificationJob,
): Promise<void> {
  const validated = NotificationJobSchema.parse(data);
  await notificationQueue.add(NOTIFICATION_JOB_NAME, validated, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
  logger.info(
    { userId: data.userId, type: data.type },
    "Notification job enqueued",
  );
}
