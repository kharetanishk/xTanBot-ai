import { Worker, type Job } from "bullmq";
import { AGENT_QUEUE_NAME } from "@xtanbot/queues";
import { runVoiceTurn, fallbackPhraseFor } from "@xtanbot/ai-core";
import { emit } from "@xtanbot/events";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import { histogram } from "@xtanbot/observability";
import type { AgentJob } from "@xtanbot/queues";

async function sendPostCallWhatsApp(phone: string, message: string): Promise<void> {
  if (!config.MSG91_AUTH_KEY) return;
  const digits = phone.replace(/\D/g, "");
  const normalised =
    digits.startsWith("91") && digits.length === 12
      ? digits
      : `91${digits.slice(-10)}`;

  await fetch(
    "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: config.MSG91_AUTH_KEY,
      },
      body: JSON.stringify({
        integrated_number: config.MSG91_INTEGRATED_NUMBER,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: config.MSG91_TEMPLATE_NAME,
            language: { code: "en", policy: "deterministic" },
            namespace: null as string | null,
            to_and_components: [
              {
                to: [normalised],
                components: { body_1: { type: "text", value: message } },
              },
            ],
          },
        },
      }),
    },
  );
}


const logger = createLogger("AgentWorker");

const queueWaitMs = histogram(
  "xtanbot_queue_wait_ms",
  "Time from job enqueue to processing start in ms",
  [100, 500, 1000, 2000, 5000, 10000],
);

const connection = {
  host: new URL(config.REDIS_URL).hostname,
  port: parseInt(new URL(config.REDIS_URL).port || "6379"),
  password: new URL(config.REDIS_URL).password || undefined,
};

async function processAgentJob(job: Job<AgentJob>): Promise<void> {
  const log = logger.child({
    sessionId: job.data.sessionId,
    userId: job.data.userId,
    jobId: job.id ?? "unknown",
  });

  log.info("Processing agent job");

  try {
    const waitMs = job.processedOn ? job.processedOn - job.timestamp : 0;
    queueWaitMs.observe(waitMs);
  } catch (err) {
    log.error({ err }, "Failed to record queue_wait_ms metric");
  }

  await runVoiceTurn(job.data);
}

export function createAgentWorker(): Worker {
  const worker = new Worker(AGENT_QUEUE_NAME, processAgentJob, {
    connection,
    concurrency: config.WORKER_CONCURRENCY,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Agent job completed successfully");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Agent job failed");

    const data = job?.data as AgentJob | undefined;
    if (!data?.sessionId || !data?.userId) return;

    emit.agentResponded({
      sessionId: data.sessionId,
      userId: data.userId,
      text: fallbackPhraseFor(err),
      toolsUsed: [],
      inputTokens: 0,
      outputTokens: 0,
      timestamp: new Date().toISOString(),
    }).catch((emitErr) => {
      logger.error({ emitErr }, "Failed to emit fallback TTS phrase");
    });
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Agent worker error");
  });

  logger.info(
    { concurrency: config.WORKER_CONCURRENCY },
    "Agent worker started",
  );

  return worker;
}
