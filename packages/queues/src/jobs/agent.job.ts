import { randomUUID } from "crypto";
import { z } from "zod";
import { agentQueue, AGENT_JOB_NAME } from "../queues/agent.queue";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";

const logger = createLogger("AgentJob");

export const AgentJobSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  transcript: z.string().min(1).max(2000),
  callSid: z.string().min(1),
  conversationId: z.string().uuid(),
});

export type AgentJob = z.infer<typeof AgentJobSchema>;

export async function enqueueAgentJob(data: AgentJob): Promise<void> {
  const validated = AgentJobSchema.parse(data);

  try {
    const waitingCount = await agentQueue.getWaitingCount();
    if (waitingCount >= config.MAX_AGENT_QUEUE_DEPTH) {
      logger.warn(
        {
          waitingCount,
          maxDepth: config.MAX_AGENT_QUEUE_DEPTH,
          sessionId: validated.sessionId,
        },
        "Agent queue depth exceeded — job not enqueued",
      );
      return;
    }
  } catch (err) {
    logger.error(
      { err },
      "Failed to check agent queue depth — proceeding with enqueue",
    );
  }

  await agentQueue.add(AGENT_JOB_NAME, validated, {
    // One job id per utterance so a new user turn can enqueue while a prior job is waiting/active.
    jobId: `agent:${validated.sessionId}:${randomUUID()}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
  logger.info(
    {
      sessionId: data.sessionId,
      userId: data.userId,
      transcriptPreview: validated.transcript.slice(0, 160),
    },
    "Agent job enqueued",
  );
}
