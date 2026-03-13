import { Worker, type Job } from "bullmq";
import { AGENT_QUEUE_NAME } from "@xtanbot/queues";
import { runAgent } from "@xtanbot/ai-core";
import { getSession, setSession } from "@xtanbot/redis";
import { conversationRepository } from "@xtanbot/db";
import { emit } from "@xtanbot/events";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import type { AgentJob } from "@xtanbot/queues";

const logger = createLogger("AgentWorker");

const FALLBACK_PHRASES = [
  "I'm sorry, I ran into an issue. Could you please repeat that?",
  "Apologies, something went wrong on my end. Please try again.",
  "I encountered a problem. Let's try that again — what did you need?",
] as const;

let fallbackPhraseIndex = 0;

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

  logger.info({ sessionId, jobId: job.id }, "Processing agent job");

  // 1. Load session from Redis
  const session = await getSession(sessionId);
  if (!session) {
    logger.warn({ sessionId }, "Session not found — job skipped");
    return;
  }

  // 2. Add user message to conversation history
  const sanitised = sanitiseTranscript(transcript);

  if (sanitised !== transcript) {
    logger.warn(
      {
        sessionId,
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

  // 3. Run agent
  const agentResponse = await runAgent({
    sessionId,
    userId,
    callSid,
    messages: trimHistory(updatedMessages).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

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

  logger.info(
    {
      sessionId,
      toolsUsed: agentResponse.toolsUsed,
      inputTokens: agentResponse.usage.inputTokens,
      outputTokens: agentResponse.usage.outputTokens,
    },
    "Agent job completed",
  );
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
