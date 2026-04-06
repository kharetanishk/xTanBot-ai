import { prisma } from "../client";
import type { CreateUser, UpdateUser } from "@xtanbot/zod-schemas";

export const userRepository = {
  async create(data: CreateUser & { passwordHash: string }) {
    return prisma.user.create({ data });
  },

  async findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  },

  async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  },

  async update(id: string, data: UpdateUser) {
    return prisma.user.update({
      where: { id },
      data,
    });
  },

  async softDelete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
} as const;
