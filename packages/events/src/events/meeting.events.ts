import { z } from "zod";

export const MeetingScheduledEventSchema = z.object({
  type: z.literal("meeting.scheduled"),
  meetingId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  startTime: z.string().datetime(),
  attendees: z.array(z.string()),
  timestamp: z.string().datetime(),
});

export const MeetingCancelledEventSchema = z.object({
  type: z.literal("meeting.cancelled"),
  meetingId: z.string().uuid(),
  userId: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export const MeetingEventSchema = z.discriminatedUnion("type", [
  MeetingScheduledEventSchema,
  MeetingCancelledEventSchema,
]);

export type MeetingScheduledEvent = z.infer<typeof MeetingScheduledEventSchema>;
export type MeetingCancelledEvent = z.infer<typeof MeetingCancelledEventSchema>;
export type MeetingEvent = z.infer<typeof MeetingEventSchema>;
