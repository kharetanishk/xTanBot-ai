import { z } from "zod";

export const SessionCreatedEventSchema = z.object({
  type: z.literal("session.created"),
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  callSid: z.string(),
  timestamp: z.string().datetime(),
});

export const SessionExpiredEventSchema = z.object({
  type: z.literal("session.expired"),
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export const SessionEventSchema = z.discriminatedUnion("type", [
  SessionCreatedEventSchema,
  SessionExpiredEventSchema,
]);

export type SessionCreatedEvent = z.infer<typeof SessionCreatedEventSchema>;
export type SessionExpiredEvent = z.infer<typeof SessionExpiredEventSchema>;
export type SessionEvent = z.infer<typeof SessionEventSchema>;
