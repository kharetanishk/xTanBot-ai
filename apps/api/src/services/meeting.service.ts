import { meetingRepository } from "@xtanbot/db";
import { emit } from "@xtanbot/events";
import { createLogger } from "@xtanbot/logger";
import { meetingCallQueue } from "@xtanbot/queues";
import type { CreateMeeting, UpdateMeeting } from "@xtanbot/zod-schemas";

const logger = createLogger("MeetingService");

export const meetingService = {
  async create(data: CreateMeeting, userId: string) {
    logger.info({ userId, title: data.title }, "Creating meeting");
    const meeting = await meetingRepository.create({ ...(data as CreateMeeting), userId } as any);

    await emit.meetingScheduled({
      meetingId: meeting.id,
      userId,
      title: data.title,
      startTime: data.startTime,
      attendees: data.attendees,
      timestamp: new Date().toISOString(),
    });

    const now = Date.now();
    const startTime = new Date(meeting.startTime).getTime();
    const delayMs = startTime - now;

    logger.info(
      {
        meetingId: meeting.id,
        startTime: meeting.startTime,
        startTimeMs: startTime,
        nowMs: now,
        delayMs,
        willQueue: delayMs > 0,
      },
      "Meeting created - checking if should queue auto-call",
    );

    if (delayMs > 0) {
      await meetingCallQueue.add(
        "auto-call-meeting",
        {
          meetingId: meeting.id,
          userId,
          title: meeting.title ?? "",
          attendees: meeting.attendees ?? [],
          startTime: meeting.startTime,
        },
        {
          delay: delayMs,
          jobId: `meeting-call-${meeting.id}`,
        },
      );
      logger.info({ meetingId: meeting.id, delayMs }, "Auto-call job queued");

      const reminderDelayMs = delayMs - 10 * 60 * 1000;
      if (reminderDelayMs > 0) {
        await meetingCallQueue.add(
          "meeting-reminder-notification",
          {
            meetingId: meeting.id,
            userId,
            title: meeting.title ?? "",
            startTime: meeting.startTime,
            minutesBefore: 10,
          },
          {
            delay: reminderDelayMs,
            jobId: `meeting-reminder-${meeting.id}`,
          },
        );
        logger.info(
          { meetingId: meeting.id, reminderDelayMs },
          "Reminder job queued",
        );
      }
    } else {
      logger.warn(
        { meetingId: meeting.id, delayMs },
        "Meeting start time is in the past - skipping auto-call queue",
      );
    }

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

    try {
      const autoCallJob = await meetingCallQueue.getJob(`meeting-call-${id}`);
      const reminderJob = await meetingCallQueue.getJob(
        `meeting-reminder-${id}`,
      );
      await autoCallJob?.remove();
      await reminderJob?.remove();
    } catch (err) {
      logger.warn(
        { err, meetingId: id },
        "Failed to remove scheduled meeting jobs",
      );
    }

    return meeting;
  },
} as const;
