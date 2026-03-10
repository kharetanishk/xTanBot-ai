import { prisma } from "../client";
import type { CreateMeeting, UpdateMeeting } from "@xtanbot/zod-schemas";

export const meetingRepository = {
  async create(data: CreateMeeting) {
    return prisma.meeting.create({ data });
  },

  async findById(id: string) {
    return prisma.meeting.findFirst({
      where: { id, deletedAt: null },
    });
  },

  async findByUserId(userId: string) {
    return prisma.meeting.findMany({
      where: { userId, deletedAt: null },
      orderBy: { startTime: "asc" },
    });
  },

  async findUpcoming(userId: string) {
    return prisma.meeting.findMany({
      where: {
        userId,
        deletedAt: null,
        startTime: { gte: new Date() },
        status: { not: "cancelled" },
      },
      orderBy: { startTime: "asc" },
    });
  },

  async update(id: string, data: UpdateMeeting) {
    return prisma.meeting.update({
      where: { id },
      data,
    });
  },

  async softDelete(id: string) {
    return prisma.meeting.update({
      where: { id },
      data: { deletedAt: new Date(), status: "cancelled" },
    });
  },
} as const;
