import { z } from "zod";

export const CallSessionSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  callSid: z.string(),
  conversationId: z.string().uuid(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      timestamp: z.string().datetime(),
    }),
  ),
  createdAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
  status: z.enum(["active", "completed", "expired"]),
});

export type CallSession = z.infer<typeof CallSessionSchema>;
