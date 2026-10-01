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
  // GET /conversations — the user's text chats, newest first
  app.get("/conversations", { preHandler: requireAuth }, async (request) =>
    conversationService.listChats(request.user.userId),
  );

  // GET /conversations/chat/:id — messages of one text chat
  app.get(
    "/conversations/chat/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const messages = await conversationService.getChat(id, request.user.userId);
      if (!messages) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "Conversation not found",
        });
      }
      return reply.send(messages);
    },
  );

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

  // POST /conversations/message — streams the reply as Server-Sent Events:
  //   start {conversationId} → tool {name}* / delta {text}* → done {conversationId, message, structuredPayload}
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

      // Take over the raw socket; keep headers already set by plugins (CORS, helmet).
      reply.hijack();
      reply.raw.writeHead(200, {
        ...(reply.getHeaders() as Record<string, string>),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      const send = (event: string, data: unknown) => {
        if (!reply.raw.writableEnded) {
          reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      };
      send("start", { conversationId });

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
          {
            onText: (text) => send("delta", { text }),
            onTool: (name) => send("tool", { name }),
          },
        );
      } catch (err) {
        logger.error({ err, userId, conversationId }, "Agent run failed");
        result = {
          fullText: "I'm sorry, something went wrong. Please try again.",
          toolsUsed: [],
        };
      }

      // Persist even if the client disconnected mid-stream, so history stays complete.
      await conversationService.addAssistantMessage(
        conversationId,
        result.fullText,
        result.toolsUsed,
      );

      send("done", {
        conversationId,
        message: result.fullText,
        structuredPayload: result.structuredPayload ?? null,
      });
      reply.raw.end();
    },
  );
}
