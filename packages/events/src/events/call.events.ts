import { z } from "zod";

export const CallStartedEventSchema = z.object({
  type: z.literal("call.started"),
  callId: z.string().uuid(),
  userId: z.string().uuid(),
  callSid: z.string(),
  toNumber: z.string(),
  fromNumber: z.string(),
  timestamp: z.string().datetime(),
});

export const CallCompletedEventSchema = z.object({
  type: z.literal("call.completed"),
  callId: z.string().uuid(),
  userId: z.string().uuid(),
  callSid: z.string(),
  durationMs: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
});

export const CallFailedEventSchema = z.object({
  type: z.literal("call.failed"),
  callId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  callSid: z.string(),
  reason: z.string(),
  timestamp: z.string().datetime(),
});

export const CallEventSchema = z.discriminatedUnion("type", [
  CallStartedEventSchema,
  CallCompletedEventSchema,
  CallFailedEventSchema,
]);

export type CallStartedEvent = z.infer<typeof CallStartedEventSchema>;
export type CallCompletedEvent = z.infer<typeof CallCompletedEventSchema>;
export type CallFailedEvent = z.infer<typeof CallFailedEventSchema>;
export type CallEvent = z.infer<typeof CallEventSchema>;
