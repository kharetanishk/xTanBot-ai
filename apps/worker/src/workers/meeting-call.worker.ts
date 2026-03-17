import { Worker, type Job } from "bullmq";
import twilio from "twilio";
import { prisma } from "@xtanbot/db";
import { redisConnection } from "@xtanbot/redis";
import {
  MEETING_CALL_QUEUE_NAME,
} from "@xtanbot/queues";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";

const logger = createLogger("MeetingCallWorker");

const connection = {
  host: new URL(config.REDIS_URL).hostname,
  port: parseInt(new URL(config.REDIS_URL).port || "6379"),
  password: new URL(config.REDIS_URL).password || undefined,
};

const twilioClient = twilio(
  config.TWILIO_ACCOUNT_SID,
  config.TWILIO_AUTH_TOKEN,
);

type AutoCallMeetingPayload = {
  meetingId: string;
  userId: string;
  title: string;
  attendees: string[];
  startTime: string;
};

type ReminderPayload = {
  meetingId: string;
  userId: string;
  title: string;
  startTime: string;
  minutesBefore: number;
};

type PostCallPayload = {
  callId: string;
  callSid: string;
  userId: string;
  duration?: string;
};

type DailyBriefingPayload = {
  type: "daily-briefing";
};

export function createMeetingCallWorker(): Worker {
  const worker = new Worker<
    AutoCallMeetingPayload | ReminderPayload | PostCallPayload | DailyBriefingPayload
  >(
    MEETING_CALL_QUEUE_NAME,
    async (job: Job<AutoCallMeetingPayload | ReminderPayload | PostCallPayload | DailyBriefingPayload>) => {
      const log = logger.child({ jobId: job.id, jobName: job.name });

      if (job.name === "auto-call-meeting") {
        const { meetingId, userId, title, attendees } =
          job.data as AutoCallMeetingPayload;

        const meeting = await prisma.meeting.findUnique({
          where: { id: meetingId },
        });
        if (!meeting || meeting.status === "cancelled") {
          log.info({ meetingId }, "Meeting cancelled — skipping auto-call");
          return;
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        const contacts = await prisma.contact.findMany({
          where: {
            userId,
            email: { in: attendees },
            deletedAt: null,
          },
        });

        const phonesToCall: { name: string; phone: string }[] = [];

        for (const contact of contacts) {
          if (contact.phone) {
            phonesToCall.push({ name: contact.name, phone: contact.phone });
          }
        }

        if (phonesToCall.length === 0 && user.phone) {
          phonesToCall.push({ name: user.name, phone: user.phone });
        }

        if (phonesToCall.length === 0) {
          log.warn(
            { meetingId },
            "No phone numbers found for meeting attendees",
          );
          return;
        }

        for (const { name, phone } of phonesToCall) {
          try {
            const context = encodeURIComponent(
              JSON.stringify({
                meetingId,
                meetingTitle: title,
                attendeeName: name,
                userId,
                callType: "scheduled-meeting" as const,
              }),
            );

            const call = await twilioClient.calls.create({
              to: phone,
              from: config.TWILIO_PHONE_NUMBER,
              url: `${config.API_URL}/twilio/voice?context=${context}`,
              statusCallback: `${config.API_URL}/twilio/status`,
              statusCallbackMethod: "POST",
            });

            await prisma.call.create({
              data: {
                userId,
                callSid: call.sid,
                status: "initiated",
                toNumber: phone,
                fromNumber: config.TWILIO_PHONE_NUMBER,
              },
            });

            await prisma.meeting.update({
              where: { id: meetingId },
              data: { status: "confirmed" },
            });

            log.info(
              { callSid: call.sid, to: phone, meetingId },
              "Auto-call initiated for meeting",
            );
          } catch (err) {
            log.error({ err, phone, meetingId }, "Failed to initiate auto-call");
            throw err;
          }
        }
      }

      if (job.name === "meeting-reminder-notification") {
        const { meetingId, userId, title, startTime, minutesBefore } =
          job.data as ReminderPayload;

        const meeting = await prisma.meeting.findUnique({
          where: { id: meetingId },
        });
        if (!meeting || meeting.status === "cancelled") return;

        const pushToken = await redisConnection.get(`push-token:${userId}`);
        if (!pushToken) return;

        await sendExpoPushNotification({
          to: pushToken,
          title: "Meeting in 10 minutes",
          body: `"${title}" starts soon. xTanBot will auto-call attendees at the scheduled time.`,
          data: { meetingId, screen: "meeting-detail", startTime, minutesBefore },
        });

        log.info({ meetingId, userId }, "Meeting reminder notification sent");
      }

      if (job.name === "post-call-intelligence") {
        const { callId, userId } = job.data as PostCallPayload;

        const conversation = await prisma.conversation.findFirst({
          where: { callId },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });

        if (!conversation || conversation.messages.length === 0) return;

        const transcript = conversation.messages
          .filter((m) => (m.role as string) !== "tool")
          .map((m) =>
            `${m.role === "user" ? "Attendee" : "xTanBot"}: ${m.content}`,
          )
          .join("\n");

        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

        const analysis = await anthropic.messages.create({
          model: config.ANTHROPIC_HAIKU_MODEL,
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content:
                `Analyze this call transcript and respond ONLY with JSON:\n` +
                `{\n` +
                `  "summary": "2-3 sentence summary of what was discussed",\n` +
                `  "outcome": "confirmed" | "cancelled" | "rescheduled" | "no-answer" | "completed",\n` +
                `  "actionRequired": "string or null"\n` +
                `}\n\nTranscript:\n${transcript}`,
            },
          ],
        });

        let summary = "";
        try {
          const textBlock = analysis.content.find((b) => b.type === "text");
          const raw =
            textBlock && textBlock.type === "text" ? textBlock.text : "";
          const parsed = JSON.parse(
            raw.replace(/```json|```/g, "").trim(),
          ) as { summary?: string };
          summary = parsed.summary ?? "";
        } catch (err) {
          logger.warn({ err }, "Failed to parse post-call analysis JSON");
        }

        await prisma.call.update({
          where: { id: callId },
          data: { summary },
        });

        const pushToken = await redisConnection.get(`push-token:${userId}`);
        if (pushToken) {
          await sendExpoPushNotification({
            to: pushToken,
            title: "Call completed",
            body: summary || "Your scheduled call has ended.",
            data: { callId, screen: "call-detail" },
          });
        }

        log.info({ callId }, "Post-call intelligence completed");
      }

      if (job.name === "daily-briefing") {
        const users = await prisma.user.findMany({
          where: {
            deletedAt: null,
            phone: { not: null },
          },
        });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        for (const user of users) {
          const todayMeetings = await prisma.meeting.findMany({
            where: {
              userId: user.id,
              startTime: { gte: todayStart, lte: todayEnd },
              status: { in: ["scheduled", "confirmed"] },
            },
            orderBy: { startTime: "asc" },
          });

          if (todayMeetings.length === 0 || !user.phone) continue;

          const meetings = todayMeetings.map((m) => ({
            title: m.title,
            time: new Date(m.startTime).toLocaleTimeString("en-IN", {
              hour: "numeric",
              minute: "2-digit",
            }),
          }));

          const context = encodeURIComponent(
            JSON.stringify({
              callType: "daily-briefing" as const,
              userName: user.name,
              meetingCount: todayMeetings.length,
              meetings,
            }),
          );

          try {
            const call = await twilioClient.calls.create({
              to: user.phone,
              from: config.TWILIO_PHONE_NUMBER,
              url: `${config.API_URL}/twilio/voice?context=${context}`,
            });

            logger.info(
              { callSid: call.sid, userId: user.id },
              "Daily briefing call initiated",
            );
          } catch (err) {
            logger.error({ err, userId: user.id }, "Failed to initiate daily briefing call");
          }
        }
      }
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, name: job.name }, "Meeting job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, err }, "Meeting job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Meeting call worker error");
  });

  logger.info("Meeting call worker started");

  return worker;
}

async function sendExpoPushNotification(args: {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to: args.to,
        title: args.title,
        body: args.body,
        data: args.data,
        sound: "default",
        priority: "high",
      }),
    });
    await res.json().catch(() => undefined);
  } catch (err) {
    logger.warn({ err }, "Failed to send Expo push notification");
  }
}

