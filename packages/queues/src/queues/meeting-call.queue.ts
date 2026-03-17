import { Queue } from "bullmq";
import { config } from "@xtanbot/config";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("MeetingCallQueue");

export const MEETING_CALL_QUEUE_NAME = "xtanbot-meeting-call" as const;

const connection = {
  host: new URL(config.REDIS_URL).hostname,
  port: parseInt(new URL(config.REDIS_URL).port || "6379"),
  password: new URL(config.REDIS_URL).password || undefined,
};

export const meetingCallQueue = new Queue(MEETING_CALL_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

meetingCallQueue.on("error", (err) => {
  logger.error({ err }, "Meeting call queue error");
});

