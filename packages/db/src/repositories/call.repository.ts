import { prisma } from "../client";
import type { CallStatus, Prisma } from "@prisma/client";
import type { CreateCall } from "@xtanbot/zod-schemas";

export const callRepository = {
  async create(data: CreateCall & { callSid: string; fromNumber: string }) {
    return prisma.call.create({ data });
  },

  async findById(id: string) {
    return prisma.call.findUnique({ where: { id } });
  },

  async findByCallSid(callSid: string) {
    return prisma.call.findUnique({ where: { callSid } });
  },

  async findByUserId(userId: string) {
    return prisma.call.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async update(id: string, data: Prisma.CallUpdateInput) {
    return prisma.call.update({
      where: { id },
      data,
    });
  },

  async updateByCallSid(callSid: string, data: Prisma.CallUpdateInput) {
    return prisma.call.update({
      where: { callSid },
      data,
    });
  },

  async updateStatus(id: string, status: CallStatus) {
    return prisma.call.update({
      where: { id },
      data: { status },
    });
  },
} as const;
