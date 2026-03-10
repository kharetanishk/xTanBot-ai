import { z } from "zod";

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);

export const MessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string().min(1),
  timestamp: z.string().datetime(),
  toolsUsed: z.array(z.string()).optional(),
});

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  callId: z.string().uuid().nullable(),
  messages: z.array(MessageSchema),
  summary: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateConversationSchema = z.object({
  userId: z.string().uuid(),
  callId: z.string().uuid().optional(),
  initialMessage: z.string().optional(),
});

export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type CreateConversation = z.infer<typeof CreateConversationSchema>;
