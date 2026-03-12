import { meetingRepository } from "@xtanbot/db";
import { emit } from "@xtanbot/events";
import { createLogger } from "@xtanbot/logger";
import type { CreateMeeting, UpdateMeeting } from "@xtanbot/zod-schemas";

const logger = createLogger("MeetingService");

export const meetingService = {
  async create(data: CreateMeeting) {
    logger.info({ userId: data.userId, title: data.title }, "Creating meeting");
    const meeting = await meetingRepository.create(data);

    await emit.meetingScheduled({
      meetingId: meeting.id,
      userId: data.userId,
      title: data.title,
      startTime: data.startTime,
      attendees: data.attendees,
      timestamp: new Date().toISOString(),
    });

    return meeting;
  },

  async getById(id: string) {
    return meetingRepository.findById(id);
  },

  async getUserMeetings(userId: string) {
    return meetingRepository.findByUserId(userId);
  },

  async getUpcoming(userId: string) {
    return meetingRepository.findUpcoming(userId);
  },

  async update(id: string, data: UpdateMeeting) {
    return meetingRepository.update(id, data);
  },

  async cancel(id: string, userId: string) {
    const meeting = await meetingRepository.softDelete(id);

    await emit.meetingCancelled({
      meetingId: id,
      userId,
      timestamp: new Date().toISOString(),
    });

    return meeting;
  },
} as const;
