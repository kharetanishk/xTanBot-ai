import type { FastifyInstance } from "fastify";
import type { StructuredPayload } from "@xtanbot/ai-core";
import { requireAuth } from "../middleware/auth.middleware";
import { conversationService } from "../services/conversation.service";
import { createLogger } from "@xtanbot/logger";
import { z } from "zod";

const logger = createLogger("ConversationsRoute");

const PostMessageBodySchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  content: z.string().min(1).max(10000),
});

export async function conversationsRoutes(app: FastifyInstance): Promise<void> {
  // GET /conversations/:callId — get conversation for a call (transcript)
  app.get(
    "/conversations/:callId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { callId } = request.params as { callId: string };
      const { userId } = request.user;

      const conv = await conversationService.getByCallId(callId, userId);
      if (!conv) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Conversation not found",
        });
      }
      return reply.send(conv);
    },
  );

  // POST /conversations/message — send message, return JSON response
  app.post(
    "/conversations/message",
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = PostMessageBodySchema.parse(request.body);
      const { userId } = request.user;

      const conv = await conversationService.getOrCreateConversation(
        userId,
        body.conversationId ?? null,
      );
      const conversationId = conv.id;

      await conversationService.addUserMessage(conversationId, body.content);

      let result: {
        fullText: string;
        toolsUsed: string[];
        structuredPayload?: StructuredPayload;
      };
      try {
        result = await conversationService.runAgentAndStream(
          conversationId,
          userId,
          body.content,
          () => {
            /* non-streaming: full text returned with result */
          },
        );
      } catch (err) {
        logger.error({ err, userId, conversationId }, "Agent run failed");
        result = {
          fullText: "I'm sorry, something went wrong. Please try again.",
          toolsUsed: [],
        };
      }

      await conversationService.addAssistantMessage(
        conversationId,
        result.fullText,
        result.toolsUsed,
      );

      return reply.send({
        conversationId,
        message: result.fullText,
        structuredPayload: result.structuredPayload ?? null,
      });
    },
  );
}
