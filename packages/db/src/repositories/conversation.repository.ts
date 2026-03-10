import { prisma } from "../client";

export const conversationRepository = {
  async create(data: { userId: string; callId?: string }) {
    return prisma.conversation.create({ data });
  },

  async findById(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  },

  async findByCallId(callId: string) {
    return prisma.conversation.findUnique({
      where: { callId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  },

  async addMessage(data: {
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    toolsUsed?: string[];
  }) {
    return prisma.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        toolsUsed: data.toolsUsed ?? [],
      },
    });
  },

  async updateSummary(id: string, summary: string) {
    return prisma.conversation.update({
      where: { id },
      data: { summary },
    });
  },
} as const;
