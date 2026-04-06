import { conversationRepository } from "@xtanbot/db";
import { runAgent } from "@xtanbot/ai-core";
import type { StructuredPayload } from "@xtanbot/ai-core";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("ConversationService");

const AGENT_HISTORY_WINDOW = 10;

function trimHistory<T>(arr: T[], window: number): T[] {
  if (arr.length <= window * 2) return arr;
  return arr.slice(arr.length - window * 2);
}

export const conversationService = {
  async getByCallId(callId: string, userId: string) {
    const conv = await conversationRepository.findByCallId(callId);
    if (!conv || conv.userId !== userId) return null;
    return {
      id: conv.id,
      userId: conv.userId,
      callId: conv.callId ?? undefined,
      messages: conv.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        toolsUsed: m.toolsUsed,
        createdAt: m.createdAt.toISOString(),
      })),
      summary: conv.summary ?? undefined,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    };
  },

  async getOrCreateConversation(userId: string, conversationId: string | null) {
    if (conversationId) {
      const existing = await conversationRepository.findById(conversationId);
      if (existing && existing.userId === userId) return existing;
    }
    return conversationRepository.create({ userId });
  },

  async addUserMessage(conversationId: string, content: string) {
    return conversationRepository.addMessage({
      conversationId,
      role: "user",
      content,
      toolsUsed: [],
    });
  },

  async addAssistantMessage(
    conversationId: string,
    content: string,
    toolsUsed: string[] = [],
  ) {
    return conversationRepository.addMessage({
      conversationId,
      role: "assistant",
      content,
      toolsUsed,
    });
  },

  async runAgentAndStream(
    conversationId: string,
    userId: string,
    userContent: string,
    onChunk: (text: string) => void,
  ): Promise<{
    fullText: string;
    toolsUsed: string[];
    structuredPayload?: StructuredPayload;
  }> {
    const conv = await conversationRepository.findById(conversationId);
    if (!conv || conv.userId !== userId) {
      throw new Error("Conversation not found");
    }

    const history = trimHistory(
      conv.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      AGENT_HISTORY_WINDOW,
    );

    const messages = history;

    logger.info(
      { userId, conversationId, messageCount: messages.length },
      "Running agent for text chat",
    );

    const response = await runAgent({
      sessionId: conversationId,
      userId,
      messages,
    });

    onChunk(response.text);
    return {
      fullText: response.text,
      toolsUsed: response.toolsUsed,
      structuredPayload: response.structuredPayload,
    };
  },
};
