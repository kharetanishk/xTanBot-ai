import { Worker, type Job } from "bullmq";
import { AGENT_QUEUE_NAME } from "@xtanbot/queues";
import { runAgent } from "@xtanbot/ai-core";
import { getSession, setSession, redisConnection } from "@xtanbot/redis";
import { conversationRepository, userRepository } from "@xtanbot/db";
import { emit } from "@xtanbot/events";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import { counter, histogram } from "@xtanbot/observability";
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

const agentResponseMs = histogram(
  "xtanbot_agent_response_ms",
  "Time from agent job start to runAgent completion in ms",
  [100, 500, 1000, 2000, 5000, 10000, 15000],
);
const queueWaitMs = histogram(
  "xtanbot_queue_wait_ms",
  "Time from job enqueue to processing start in ms",
  [100, 500, 1000, 2000, 5000, 10000],
);
const agentCostUsd = counter(
  "xtanbot_agent_cost_usd_total",
  "Cumulative Claude API cost in USD across all sessions",
);

const FALLBACK_BY_CATEGORY: Record<string, string> = {
  timeout:
    "I lost my connection briefly. Could you please repeat that?",
  rate_limit:
    "I'm a little busy right now. Please try again in a moment.",
  content_policy:
    "I'm not able to help with that. Is there something else I can do for you?",
  network:
    "I'm having trouble connecting. Please try again shortly.",
  iteration_limit:
    "That request was a bit complex for me. Could you rephrase it?",
  unknown:
    "I'm sorry, I ran into an issue. Could you please repeat that?",
};

const connection = {
  host: new URL(config.REDIS_URL).hostname,
  port: parseInt(new URL(config.REDIS_URL).port || "6379"),
  password: new URL(config.REDIS_URL).password || undefined,
};

const COST_PER_INPUT_TOKEN_USD  = 0.000003;  // $3.00 / 1M tokens
const COST_PER_OUTPUT_TOKEN_USD = 0.000015;  // $15.00 / 1M tokens

const AGENT_HISTORY_WINDOW = 10; // max user/assistant pairs

const MAX_TRANSCRIPT_LENGTH = 500;

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|prior|all)\s+instructions?/gi,
  /system\s*:/gi,
  /assistant\s*:/gi,
  /user\s*:/gi,
  /<\s*\/?\s*(tool|function|system|prompt|instruction)[^>]*>/gi,
  /\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>/gi,
];

function sanitiseTranscript(transcript: string): string {
  let result = transcript;

  // Strip XML/JSON control characters
  result = result.replace(/[<>{}[\]\\]/g, "");

  // Strip prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, "");
  }

  // Normalise whitespace left by stripping
  result = result.replace(/\s+/g, " ").trim();

  // Hard cap length
  result = result.slice(0, MAX_TRANSCRIPT_LENGTH);

  return result;
}

type SessionMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

function trimHistory(messages: SessionMessage[]): SessionMessage[] {
  const maxMessages = AGENT_HISTORY_WINDOW * 2;
  if (messages.length <= maxMessages) return messages;

  const trimmed = messages.slice(messages.length - maxMessages);
  logger.debug(
    {
      originalCount: messages.length,
      trimmedCount: trimmed.length,
      window: AGENT_HISTORY_WINDOW,
    },
    "Conversation history trimmed for LLM context",
  );
  return trimmed;
}

async function processAgentJob(job: Job<AgentJob>): Promise<void> {
  const { sessionId, userId, transcript, callSid, conversationId } = job.data;

  const log = logger.child({
    sessionId,
    userId,
    jobId: job.id ?? "unknown",
  });

  log.info("Processing agent job");

  try {
    const waitMs = job.processedOn ? job.processedOn - job.timestamp : 0;
    queueWaitMs.observe(waitMs);
  } catch (err) {
    log.error({ err }, "Failed to record queue_wait_ms metric");
  }

  // 1. Load session from Redis
  const session = await getSession(sessionId);
  if (!session) {
    log.warn("Session not found — job skipped");
    return;
  }

  // 2. Per-session cost cap check
  try {
    const costKey = `cost:session:${sessionId}`;
    const currentCostStr = await redisConnection.get(costKey);
    const currentCostUSD = parseFloat(currentCostStr ?? "0");

    if (currentCostUSD >= config.MAX_COST_PER_SESSION_USD) {
      log.warn(
        {
          currentCostUSD: parseFloat(currentCostUSD.toFixed(6)),
          capUSD: config.MAX_COST_PER_SESSION_USD,
        },
        "Session cost cap exceeded — terminating session",
      );

      await emit.agentResponded({
        sessionId,
        userId,
        text: "This call has reached its usage limit. Please call back to continue. Goodbye!",
        toolsUsed: [],
        inputTokens: 0,
        outputTokens: 0,
        timestamp: new Date().toISOString(),
      });

      return;
    }
  } catch (err) {
    log.error(
      { err },
      "Failed to read session cost from Redis — proceeding without cap check",
    );
  }

  // 3. Add user message to conversation history
  const sanitised = sanitiseTranscript(transcript);

  if (sanitised !== transcript) {
    log.warn(
      {
        originalLength: transcript.length,
        sanitisedLength: sanitised.length,
      },
      "Transcript modified by sanitisation — possible injection attempt",
    );
  }

  const userMessage = {
    role: "user" as const,
    content: sanitised,
    timestamp: new Date().toISOString(),
  };

  const updatedMessages = [...session.messages, userMessage];

  let voiceContext: Record<string, unknown> = {};
  try {
    const raw = await redisConnection.get(`session:context:${callSid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        voiceContext = parsed as Record<string, unknown>;
      }
    }
  } catch (err) {
    log.warn({ err, callSid }, "Failed to load session:context from Redis");
  }

  let userProfile: { name: string; timezone: string } | undefined;
  try {
    const u = await userRepository.findById(userId);
    if (u) userProfile = { name: u.name, timezone: u.timezone };
  } catch {
    // ignore
  }

  // 3. Run agent
  const agentStart = Date.now();
  const agentResponse = await runAgent({
    sessionId,
    userId,
    callSid,
    messages: trimHistory(updatedMessages).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    voiceContext,
    userProfile,
  });
  try {
    agentResponseMs.observe(Date.now() - agentStart);
  } catch (err) {
    log.error({ err }, "Failed to record agent_response_ms metric");
  }

  // 4. Add assistant response to history
  const assistantMessage = {
    role: "assistant" as const,
    content: agentResponse.text,
    timestamp: new Date().toISOString(),
  };

  const finalMessages = [...updatedMessages, assistantMessage];

  // 5. Update Redis session
  await setSession(sessionId, {
    ...session,
    messages: finalMessages,
    lastActivityAt: new Date().toISOString(),
  });

  // 6. Persist messages to DB
  await conversationRepository.addMessage({
    conversationId,
    role: "user",
    content: sanitised,
    toolsUsed: [],
  });

  await conversationRepository.addMessage({
    conversationId,
    role: "assistant",
    content: agentResponse.text,
    toolsUsed: agentResponse.toolsUsed,
  });

  // 7. Emit event
  await emit.agentResponded({
    sessionId,
    userId,
    text: agentResponse.text,
    toolsUsed: agentResponse.toolsUsed,
    inputTokens: agentResponse.usage.inputTokens,
    outputTokens: agentResponse.usage.outputTokens,
    timestamp: new Date().toISOString(),
  });

  log.info(
    {
      toolsUsed: agentResponse.toolsUsed,
      inputTokens: agentResponse.usage.inputTokens,
      outputTokens: agentResponse.usage.outputTokens,
      assistantReply: agentResponse.text,
      assistantReplyPreview: agentResponse.text.slice(0, 240),
    },
    "Agent job completed — emitting agent.responded for voice TTS",
  );

  // 8. Cost tracking
  const turnCostUSD =
    agentResponse.usage.inputTokens  * COST_PER_INPUT_TOKEN_USD +
    agentResponse.usage.outputTokens * COST_PER_OUTPUT_TOKEN_USD;

  log.info(
    {
      inputTokens: agentResponse.usage.inputTokens,
      outputTokens: agentResponse.usage.outputTokens,
      turnCostUSD: parseFloat(turnCostUSD.toFixed(6)),
    },
    "Agent turn cost",
  );

  try {
    agentCostUsd.inc(turnCostUSD);
  } catch (err) {
    log.error({ err }, "Failed to record agent_cost_usd metric");
  }

  try {
    const costKey = `cost:session:${sessionId}`;
    await redisConnection.incrbyfloat(costKey, turnCostUSD);
    await redisConnection.expire(costKey, 3600);

    const sessionTotalStr = await redisConnection.get(costKey);
    const sessionTotalUSD = parseFloat(sessionTotalStr ?? "0");

    log.info(
      {
        sessionTotalUSD: parseFloat(sessionTotalUSD.toFixed(6)),
      },
      "Session cumulative cost",
    );
  } catch (err) {
    log.error({ err }, "Failed to track session cost in Redis");
  }
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

    const category =
      err instanceof Error && "category" in err
        ? (err as { category: string }).category
        : "unknown";

    const phrase: string =
      FALLBACK_BY_CATEGORY[category] ??
      FALLBACK_BY_CATEGORY["unknown"]!;

    logger.info(
      { category, jobId: job?.id },
      "Selecting fallback phrase by error category",
    );

    emit.agentResponded({
      sessionId: data.sessionId,
      userId: data.userId,
      text: phrase,
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
