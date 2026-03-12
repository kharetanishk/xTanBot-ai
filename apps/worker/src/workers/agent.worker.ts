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

const connection = {
  host: new URL(config.REDIS_URL).hostname,
  port: parseInt(new URL(config.REDIS_URL).port || "6379"),
  password: new URL(config.REDIS_URL).password || undefined,
};

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
  const userMessage = {
    role: "user" as const,
    content: transcript,
    timestamp: new Date().toISOString(),
  };

  const updatedMessages = [...session.messages, userMessage];

  // 3. Run agent
  const agentResponse = await runAgent({
    sessionId,
    userId,
    callSid,
    messages: updatedMessages.map((m) => ({
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
    content: transcript,
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

    const phrase: string =
      FALLBACK_PHRASES[fallbackPhraseIndex % FALLBACK_PHRASES.length] ??
      "I'm sorry, I ran into an issue. Could you please repeat that?";
    fallbackPhraseIndex++;

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
