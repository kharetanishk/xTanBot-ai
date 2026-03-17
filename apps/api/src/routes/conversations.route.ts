import type { FastifyInstance } from "fastify";
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

      let fullResponse = "";
      try {
        await conversationService.runAgentAndStream(
          conversationId,
          userId,
          body.content,
          (chunk) => {
            fullResponse += chunk;
          },
        );
      } catch (err) {
        logger.error({ err, userId, conversationId }, "Agent run failed");
        fullResponse = "I'm sorry, something went wrong. Please try again.";
      }

      await conversationService.addAssistantMessage(conversationId, fullResponse);

      return reply.send({
        conversationId,
        message: fullResponse,
      });
    },
  );
}
