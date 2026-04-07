import twilio from "twilio";
import IORedis from "ioredis";
import type { Alarm, User } from "@prisma/client";
import { prisma } from "@xtanbot/db";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";

const logger = createLogger("AlarmWorker");

export const ALARM_CREATED_CHANNEL = "alarm:created";

/**
 * Three-layer scheduling strategy for near-exact firing:
 *  1. precisionTimer    — setTimeout aimed at the exact scheduledAt millisecond.
 *  2. pubsub subscriber — re-arms the precision timer the instant a new alarm is
 *                         created, so even a 5-second-away alarm is caught.
 *  3. fallbackInterval  — polls every 10 s as a last-resort safety net.
 */
let precisionTimer: ReturnType<typeof setTimeout> | null = null;
let fallbackInterval: ReturnType<typeof setInterval> | null = null;
let subscriber: IORedis | null = null;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildAlarmPhrase(alarmTime: string, userName: string): string {
  return `It's ${alarmTime}, wake up ${userName}, nahi toh teri gaaand phatt jyegi, jldi uth aur kaam par jaa re madarchod`;
}

export function startAlarmScheduler(): void {
  logger.info("Alarm scheduler started (precision mode)");

  // 1. Immediate bootstrap — fire overdue alarms and arm the first precision timer.
  void bootstrap().catch((err) =>
    logger.error({ err }, "Alarm scheduler bootstrap failed"),
  );

  // 2. Subscribe to alarm:created so new alarms reschedule the timer immediately.
  subscriber = new IORedis(config.REDIS_URL, { lazyConnect: false });
  void subscriber.subscribe(ALARM_CREATED_CHANNEL).catch((err) =>
    logger.warn({ err }, "Could not subscribe to alarm:created channel"),
  );
  subscriber.on("message", (_channel: string) => {
    void scheduleNextPrecisionTimer().catch((err) =>
      logger.error({ err }, "Re-schedule after alarm:created failed"),
    );
  });

  // 3. Fallback: re-arm every 10 s in case pub/sub misses anything.
  fallbackInterval = setInterval(() => {
    void scheduleNextPrecisionTimer().catch((err) =>
      logger.error({ err }, "Fallback scheduler error"),
    );
  }, 10_000);
}

export function stopAlarmScheduler(): void {
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
  if (precisionTimer) {
    clearTimeout(precisionTimer);
    precisionTimer = null;
  }
  if (subscriber) {
    void subscriber.quit().catch(() => undefined);
    subscriber = null;
  }
  logger.info("Alarm scheduler stopped");
}

async function bootstrap(): Promise<void> {
  await checkAndFireAlarms();
  await scheduleNextPrecisionTimer();
}

/**
 * Query the very next upcoming alarm and arm a setTimeout that fires exactly
 * when it is due (to the millisecond).  Cancels any previously pending timer.
 */
async function scheduleNextPrecisionTimer(): Promise<void> {
  if (precisionTimer) {
    clearTimeout(precisionTimer);
    precisionTimer = null;
  }

  const nextAlarm = await prisma.alarm.findFirst({
    where: {
      status: "scheduled",
      scheduledAt: { gt: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
  });

  if (!nextAlarm) {
    logger.debug("No upcoming alarms — precision timer idle");
    return;
  }

  const msUntil = new Date(nextAlarm.scheduledAt).getTime() - Date.now();

  logger.info(
    { alarmId: nextAlarm.id, scheduledAt: nextAlarm.scheduledAt, msUntil },
    "Precision timer armed for next alarm",
  );

  precisionTimer = setTimeout(() => {
    precisionTimer = null;
    void checkAndFireAlarms()
      .then(() => scheduleNextPrecisionTimer())
      .catch((err) => logger.error({ err }, "Precision alarm fire failed"));
  }, Math.max(0, msUntil));
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

  logger.info({ count: dueAlarms.length }, "Found due alarms — firing");

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
    // Atomic status transition: only one worker instance fires each alarm.
    const updated = await prisma.alarm.updateMany({
      where: { id: alarm.id, status: "scheduled" },
      data: { status: "ringing" },
    });
    if (updated.count === 0) return; // already fired by another instance

    const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

    const alarmTime = alarm.scheduledAt.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });

    const phrase = buildAlarmPhrase(alarmTime, alarm.user.name);
    const safe = escapeXml(phrase);

    const actionUrl = `${config.API_URL.replace(/\/$/, "")}/alarm/response/${alarm.id}`;

    const sayBlocks = Array.from({ length: 10 }, () =>
      `<Say voice="Polly.Aditi" language="hi-IN">${safe}</Say><Pause length="2"/>`,
    ).join("");

    const twiml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response>` +
      `<Gather input="speech" timeout="120" speechTimeout="auto" action="${escapeXml(actionUrl)}" method="POST">` +
      sayBlocks +
      `</Gather>` +
      `<Say>Goodbye.</Say><Hangup/>` +
      `</Response>`;

    const call = await client.calls.create({
      to: alarm.user.phone,
      from: config.TWILIO_PHONE_NUMBER,
      twiml,
    });

    await prisma.alarm.update({
      where: { id: alarm.id },
      data: { callSid: call.sid },
    });

    logger.info(
      { alarmId: alarm.id, callSid: call.sid },
      "Alarm call initiated",
    );
  } catch (err) {
    logger.error({ err, alarmId: alarm.id }, "Failed to fire alarm");
    await prisma.alarm.update({
      where: { id: alarm.id },
      data: { status: "failed" },
    });
  }
}
