import { z } from "zod";

export const AutoCallMeetingJobSchema = z.object({
  meetingId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  attendees: z.array(z.string().email()),
  startTime: z.string(),
});

export const MeetingReminderJobSchema = z.object({
  meetingId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  startTime: z.string(),
  minutesBefore: z.number(),
});

export const PostCallIntelligenceJobSchema = z.object({
  callId: z.string().uuid(),
  callSid: z.string(),
  userId: z.string().uuid(),
  duration: z.string().optional(),
});

export const DailyBriefingJobSchema = z.object({
  type: z.literal("daily-briefing"),
});

export type AutoCallMeetingJob = z.infer<typeof AutoCallMeetingJobSchema>;
export type MeetingReminderJob = z.infer<typeof MeetingReminderJobSchema>;
export type PostCallIntelligenceJob = z.infer<
  typeof PostCallIntelligenceJobSchema
>;
export type DailyBriefingJob = z.infer<typeof DailyBriefingJobSchema>;

