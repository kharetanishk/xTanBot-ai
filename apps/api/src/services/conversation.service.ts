import { conversationRepository } from "@xtanbot/db";
import { runAgent } from "@xtanbot/ai-core";
import type { StructuredPayload } from "@xtanbot/ai-core";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("ConversationService");

const AGENT_HISTORY_WINDOW = 6;

function trimHistory<T>(arr: T[], window: number): T[] {
  if (arr.length <= window * 2) return arr;
  return arr.slice(arr.length - window * 2);
}

function compressMessageForHistory(msg: {
  role: string;
  content: string;
}): { role: "user" | "assistant"; content: string } {
  const role = msg.role as "user" | "assistant";
  // Compress long JSON-looking content (e.g. tool results stored as text)
  if (msg.role === "user" && msg.content.startsWith("{") && msg.content.length > 500) {
    try {
      const parsed = JSON.parse(msg.content) as Record<string, unknown>;
      if (typeof parsed.text === "string" && parsed.text.length > 300) {
        return {
          role,
          content: JSON.stringify({
            ...parsed,
            text: parsed.text.slice(0, 300) + "...[compressed]",
          }),
        };
      }
    } catch {
      return { role, content: msg.content.slice(0, 500) };
    }
  }
  return { role, content: msg.content };
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

    const messages = trimHistory(
      conv.messages.map((m) =>
        compressMessageForHistory({ role: m.role, content: m.content }),
      ),
      AGENT_HISTORY_WINDOW,
    );

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
