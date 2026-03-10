import { Queue } from "bullmq";
import { config } from "@xtanbot/config";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("TtsQueue");

export const TTS_QUEUE_NAME = "xtanbot:tts" as const;
export const TTS_JOB_NAME = "tts:synthesize" as const;

const connection = {
  host: new URL(config.REDIS_URL).hostname,
  port: parseInt(new URL(config.REDIS_URL).port || "6379"),
  password: new URL(config.REDIS_URL).password || undefined,
};

export const ttsQueue = new Queue(TTS_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 500 },
    removeOnComplete: 50,
    removeOnFail: 200,
  },
});

ttsQueue.on("error", (err) => {
  logger.error({ err }, "TTS queue error");
});
