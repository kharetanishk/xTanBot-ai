import { z } from "zod";

export const AgentResponseEventSchema = z.object({
  type: z.literal("agent.response"),
  callId: z.string().uuid(),
  transcript: z.string(),
  timestamp: z.string().datetime(),
});

export type AgentResponseEvent = z.infer<typeof AgentResponseEventSchema>;
