import { Queue } from "bullmq";
import { config } from "@xtanbot/config";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("AgentQueue");

export const AGENT_QUEUE_NAME = "xtanbot:agent" as const;
export const AGENT_JOB_NAME = "agent:process" as const;

const connection = {
  host: new URL(config.REDIS_URL).hostname,
  port: parseInt(new URL(config.REDIS_URL).port || "6379"),
  password: new URL(config.REDIS_URL).password || undefined,
};

export const agentQueue = new Queue(AGENT_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

agentQueue.on("error", (err) => {
  logger.error({ err }, "Agent queue error");
});
