import { z } from "zod";
import { agentQueue, AGENT_JOB_NAME } from "../queues/agent.queue";
import { createLogger } from "@xtanbot/logger";

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
  await agentQueue.add(AGENT_JOB_NAME, validated, {
    jobId: `agent:${validated.sessionId}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
  logger.info(
    { sessionId: data.sessionId, userId: data.userId },
    "Agent job enqueued",
  );
}
