import type { FastifyInstance } from "fastify";
import { prisma } from "@xtanbot/db";
import { requireAuth } from "../middleware/auth.middleware";
import { meetingService } from "../services/meeting.service";
import { CreateMeetingSchema, UpdateMeetingSchema } from "@xtanbot/zod-schemas";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("MeetingsRoute");

export async function meetingsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/meetings", { preHandler: requireAuth }, async (request, reply) => {
    const body = CreateMeetingSchema.parse(request.body);
    const userId = (request.user as any).userId as string;
    const meeting = await meetingService.create(body, userId);
    return reply.status(201).send(meeting);
  });

  app.get("/meetings", { preHandler: requireAuth }, async (request, reply) => {
    const { userId } = request.user;
    const meetings = await meetingService.getUserMeetings(userId);
    return reply.send(meetings);
  });

  app.get(
    "/meetings/upcoming",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user;
      const meetings = await meetingService.getUpcoming(userId);
      return reply.send(meetings);
    },
  );

  app.get(
    "/meetings/:id/summary",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { userId } = request.user;

      const meeting = await prisma.meeting.findFirst({
        where: { id, userId, deletedAt: null },
      });
      if (!meeting) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Meeting not found",
        });
      }

      const call = await prisma.call.findFirst({
        where: { meetingId: id, userId },
        orderBy: { createdAt: "desc" },
      });

      if (!call) {
        return reply.send({
          hasSummary: false,
          summary: null,
          transcript: [],
        });
      }

      const conv = await prisma.conversation.findFirst({
        where: { callId: call.id },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            where: { role: { in: ["user", "assistant"] } },
          },
        },
      });

      if (!conv) {
        return reply.send({
          hasSummary: false,
          summary: null,
          transcript: [],
        });
      }

      return reply.send({
        hasSummary: !!conv.summary,
        summary: conv.summary,
        transcript: conv.messages.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
        callId: call.id,
        callStatus: call.status,
        callDuration: call.duration,
      });
    },
  );

  app.get(
    "/meetings/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const meeting = await meetingService.getById(id);

      if (!meeting) {
        return reply
          .status(404)
          .send({
            statusCode: 404,
            error: "Not Found",
            message: "Meeting not found",
          });
      }

      return reply.send(meeting);
    },
  );

  app.patch(
    "/meetings/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateMeetingSchema.parse(request.body);
      const meeting = await meetingService.update(id, body);
      return reply.send(meeting);
    },
  );

  app.delete(
    "/meetings/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { userId } = request.user;
      await meetingService.cancel(id, userId);
      return reply.status(204).send();
    },
  );
}
