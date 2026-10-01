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

  /** Text chats only (no call transcripts), newest first, with the opening message as a title. */
  async listChatsByUser(userId: string, take = 30) {
    return prisma.conversation.findMany({
      where: { userId, callId: null, messages: { some: {} } },
      orderBy: { createdAt: "desc" },
      take,
      include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
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
