import { z } from "zod";

export const CallStatusSchema = z.enum([
  "initiated",
  "ringing",
  "in-progress",
  "completed",
  "failed",
  "busy",
  "no-answer",
]);

export const CreateCallSchema = z.object({
  userId: z.string().uuid(),
  toNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format e.g. +1234567890"),
  agentPrompt: z.string().max(500).optional(),
});

export const UpdateCallSchema = z.object({
  status: CallStatusSchema.optional(),
  duration: z.number().int().nonnegative().optional(),
  endedAt: z.date().optional(),
  summary: z.string().optional(),
});

export const CallSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  callSid: z.string(),
  toNumber: z.string(),
  fromNumber: z.string(),
  status: CallStatusSchema,
  duration: z.number().nullable(),
  summary: z.string().nullable(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CallStatus = z.infer<typeof CallStatusSchema>;
export type CreateCall = z.infer<typeof CreateCallSchema>;
export type UpdateCall = z.infer<typeof UpdateCallSchema>;
export type Call = z.infer<typeof CallSchema>;
