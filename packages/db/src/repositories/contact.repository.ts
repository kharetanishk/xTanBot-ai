import { prisma } from "../client";
import type { CreateContact, UpdateContact } from "@xtanbot/zod-schemas";

export const contactRepository = {
  async create(data: CreateContact) {
    return prisma.contact.create({ data });
  },

  async findById(id: string) {
    return prisma.contact.findFirst({
      where: { id, deletedAt: null },
    });
  },

  async findByUserId(userId: string) {
    return prisma.contact.findMany({
      where: { userId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  },

  async search(userId: string, query: string) {
    return prisma.contact.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query } },
        ],
      },
    });
  },

  async update(id: string, data: UpdateContact) {
    return prisma.contact.update({
      where: { id },
      data,
    });
  },

  async softDelete(id: string) {
    return prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
} as const;
