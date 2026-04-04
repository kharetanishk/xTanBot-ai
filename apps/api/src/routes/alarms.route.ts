import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@xtanbot/db";
import { requireAuth } from "../middleware/auth.middleware";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("AlarmsRoute");

const CreateAlarmSchema = z.object({
  scheduledAt: z.string().datetime(),
  label: z.string().optional().default("Wake up alarm"),
});

export async function alarmsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/alarms", { preHandler: requireAuth }, async (request, reply) => {
    const { userId } = request.user;
    const alarms = await prisma.alarm.findMany({
      where: { userId, status: { not: "cancelled" } },
      orderBy: { scheduledAt: "asc" },
    });
    return reply.send(alarms);
  });

  app.post("/alarms", { preHandler: requireAuth }, async (request, reply) => {
    const { userId } = request.user;
    const body = CreateAlarmSchema.parse(request.body);
    const scheduledAt = new Date(body.scheduledAt);
    if (scheduledAt <= new Date()) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Alarm time must be in the future.",
      });
    }
    const alarm = await prisma.alarm.create({
      data: {
        userId,
        scheduledAt,
        label: body.label,
        status: "scheduled",
      },
    });
    return reply.status(201).send(alarm);
  });

  app.delete(
    "/alarms/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { userId } = request.user;
      await prisma.alarm.updateMany({
        where: { id, userId, status: { not: "cancelled" } },
        data: { status: "cancelled" },
      });
      return reply.status(204).send();
    },
  );

  app.post(
    "/alarm/response/:alarmId",
    async (request, reply) => {
      const { alarmId } = request.params as { alarmId: string };
      const body = request.body as Record<string, string | undefined>;
      const speech = (body.SpeechResult ?? "").toLowerCase();

      const acknowledged =
        speech.includes("stop") ||
        speech.includes("okay") ||
        speech.includes("ok") ||
        speech.includes("awake") ||
        speech.includes("yes") ||
        speech.includes("uth") ||
        speech.includes("jaga") ||
        speech.includes("i'm awake") ||
        speech.includes("im awake");

      if (acknowledged) {
        try {
          await prisma.alarm.updateMany({
            where: { id: alarmId, status: "ringing" },
            data: { status: "acknowledged" },
          });
        } catch (err) {
          logger.warn({ err, alarmId }, "Alarm acknowledge update failed");
        }
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Great! Have a productive day!</Say><Hangup/></Response>`;
        return reply.type("text/xml").send(twiml);
      }

      try {
        await prisma.alarm.updateMany({
          where: { id: alarmId, status: "ringing" },
          data: { status: "acknowledged" },
        });
      } catch (err) {
        logger.warn({ err, alarmId }, "Alarm finalize update failed");
      }
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
      return reply.type("text/xml").send(twiml);
    },
  );
}
