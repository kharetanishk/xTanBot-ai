import { z } from "zod";

export const AgentRespondedEventSchema = z.object({
  type: z.literal("agent.responded"),
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  text: z.string(),
  toolsUsed: z.array(z.string()),
  inputTokens: z.number(),
  outputTokens: z.number(),
  timestamp: z.string().datetime(),
});

export const AgentToolCalledEventSchema = z.object({
  type: z.literal("agent.tool_called"),
  sessionId: z.string().uuid(),
  toolName: z.string(),
  timestamp: z.string().datetime(),
});

export const AgentEventSchema = z.discriminatedUnion("type", [
  AgentRespondedEventSchema,
  AgentToolCalledEventSchema,
]);

export type AgentRespondedEvent = z.infer<typeof AgentRespondedEventSchema>;
export type AgentToolCalledEvent = z.infer<typeof AgentToolCalledEventSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
