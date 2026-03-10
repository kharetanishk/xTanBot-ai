import { z } from "zod";

export const CallStartedEventSchema = z.object({
  type: z.literal("call.started"),
  callId: z.string().uuid(),
  from: z.string(),
  to: z.string(),
  timestamp: z.string().datetime(),
});

export const CallEndedEventSchema = z.object({
  type: z.literal("call.ended"),
  callId: z.string().uuid(),
  durationSeconds: z.number(),
  timestamp: z.string().datetime(),
});

export type CallStartedEvent = z.infer<typeof CallStartedEventSchema>;
export type CallEndedEvent = z.infer<typeof CallEndedEventSchema>;
