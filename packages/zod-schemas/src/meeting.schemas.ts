import { z } from "zod";

export const MeetingStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
  "rescheduled",
]);

export const CreateMeetingSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  attendees: z.array(z.string().email()).min(1),
  location: z.string().max(300).optional(),
  meetingUrl: z.string().url().optional(),
  timezone: z.string().default("UTC"),
});

export const UpdateMeetingSchema = CreateMeetingSchema.partial().omit({
  userId: true,
});

export const MeetingSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z.date(),
  endTime: z.date(),
  attendees: z.array(z.string()),
  location: z.string().nullable(),
  meetingUrl: z.string().nullable(),
  timezone: z.string(),
  status: MeetingStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MeetingStatus = z.infer<typeof MeetingStatusSchema>;
export type CreateMeeting = z.infer<typeof CreateMeetingSchema>;
export type UpdateMeeting = z.infer<typeof UpdateMeetingSchema>;
export type Meeting = z.infer<typeof MeetingSchema>;
