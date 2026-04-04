import twilio from "twilio";
import type { Alarm, User } from "@prisma/client";
import { prisma } from "@xtanbot/db";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";

const logger = createLogger("AlarmWorker");

let alarmCheckInterval: ReturnType<typeof setInterval> | null = null;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Exact alarm script (only [TIME] and [NAME] substituted). */
function buildAlarmPhrase(alarmTime: string, userName: string): string {
  return `It's ${alarmTime}, wake up ${userName}, nahi toh teri gaaand phatt jyegi, jldi uth aur kaam par jaa re madarchod`;
}

export function startAlarmScheduler(): void {
  logger.info("Alarm scheduler started");

  alarmCheckInterval = setInterval(() => {
    void checkAndFireAlarms().catch((err) => {
      logger.error({ err }, "Alarm check failed");
    });
  }, 30 * 1000);

  void checkAndFireAlarms().catch((err) => {
    logger.error({ err }, "Initial alarm check failed");
  });
}

export function stopAlarmScheduler(): void {
  if (alarmCheckInterval) {
    clearInterval(alarmCheckInterval);
    alarmCheckInterval = null;
  }
}

async function checkAndFireAlarms(): Promise<void> {
  const now = new Date();

  const dueAlarms = await prisma.alarm.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now },
    },
    include: { user: true },
    take: 10,
    orderBy: { scheduledAt: "asc" },
  });

  if (dueAlarms.length === 0) return;

  logger.info({ count: dueAlarms.length }, "Found due alarms");

  for (const alarm of dueAlarms) {
    await fireAlarm(alarm);
  }
}

type AlarmWithUser = Alarm & { user: User };

async function fireAlarm(alarm: AlarmWithUser): Promise<void> {
  if (!alarm.user.phone) {
    logger.warn(
      { alarmId: alarm.id, userId: alarm.userId },
      "User has no phone number — cannot fire alarm",
    );
    await prisma.alarm.update({
      where: { id: alarm.id },
      data: { status: "failed" },
    });
    return;
  }

  try {
    const updated = await prisma.alarm.updateMany({
      where: { id: alarm.id, status: "scheduled" },
      data: { status: "ringing" },
    });
    if (updated.count === 0) {
      return;
    }

    const client = twilio(
      config.TWILIO_ACCOUNT_SID,
      config.TWILIO_AUTH_TOKEN,
    );

    const alarmTime = alarm.scheduledAt.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });

    const userName = alarm.user.name;
    const phrase = buildAlarmPhrase(alarmTime, userName);
    const safe = escapeXml(phrase);

    const actionUrl = `${config.API_URL.replace(/\/$/, "")}/alarm/response/${alarm.id}`;

    const sayBlocks = Array.from({ length: 10 }, () => {
      return `<Say voice="Polly.Aditi" language="hi-IN">${safe}</Say><Pause length="2"/>`;
    }).join("");

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" timeout="120" speechTimeout="auto" action="${escapeXml(actionUrl)}" method="POST">${sayBlocks}</Gather><Say>Goodbye.</Say><Hangup/></Response>`;

    const call = await client.calls.create({
      to: alarm.user.phone,
      from: config.TWILIO_PHONE_NUMBER,
      twiml,
    });

    await prisma.alarm.update({
      where: { id: alarm.id },
      data: { callSid: call.sid },
    });

    logger.info({ alarmId: alarm.id, callSid: call.sid }, "Alarm call initiated");
  } catch (err) {
    logger.error({ err, alarmId: alarm.id }, "Failed to fire alarm");
    await prisma.alarm.update({
      where: { id: alarm.id },
      data: { status: "failed" },
    });
  }
}
