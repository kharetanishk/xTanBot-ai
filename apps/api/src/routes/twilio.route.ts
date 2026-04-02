import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { WebSocket } from "ws";
import fp from "fastify-plugin";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import { redisConnection } from "@xtanbot/redis";
import {
  validateTwilioSignature,
  buildInboundCallTwiML,
  getStreamWebSocketUrl,
  createPipeline,
} from "@xtanbot/voice-pipeline";
import { meetingCallQueue } from "@xtanbot/queues";
import { callService } from "../services/call.service";

const logger = createLogger("TwilioRoute");

function guardTwilioSignature(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (config.NODE_ENV === "development") {
    return true;
  }

  const signature = request.headers["x-twilio-signature"];

  if (!signature || typeof signature !== "string" || signature.trim() === "") {
    logger.warn(
      { ip: request.ip },
      "Missing Twilio signature — request rejected",
    );
    return false;
  }

  const url = `https://${request.hostname}${request.url}`;
  const isValid = validateTwilioSignature(
    url,
    request.body as Record<string, string>,
    signature,
  );

  if (!isValid) {
    logger.warn(
      { url, ip: request.ip },
      "Invalid Twilio signature — request rejected",
    );
    return false;
  }

  return true;
}

export const twilioRoutes = fp(async function twilioRoutes(
  app: FastifyInstance,
): Promise<void> {
  // POST /twilio/voice — Twilio calls this when a call comes in or for outbound calls
  app.post(
    "/twilio/voice",
    { config: { rawBody: true, rateLimit: { max: 300 } } },
    async (request, reply) => {
      try {
        if (!guardTwilioSignature(request, reply)) {
          return reply.status(403).send({ error: "Forbidden" });
        }

        const host = request.hostname;
        const streamUrl = getStreamWebSocketUrl(host);

        const query = (request.query ?? {}) as Record<string, string>;
        const contextRaw = query.context;
        let meetingContext: unknown = null;
        if (typeof contextRaw === "string" && contextRaw.trim() !== "") {
          try {
            meetingContext = JSON.parse(decodeURIComponent(contextRaw));
          } catch {
            // ignore malformed context
          }
        }

        const body = (request.body ?? {}) as Record<string, string>;
        const callSid = body.CallSid as string | undefined;
        const answeredBy = body.AnsweredBy;

        let enriched: Record<string, unknown> =
          meetingContext &&
          typeof meetingContext === "object" &&
          meetingContext !== null &&
          !Array.isArray(meetingContext)
            ? { ...(meetingContext as Record<string, unknown>) }
            : { callType: "inbound" };
        if (answeredBy && String(answeredBy).trim() !== "") {
          enriched = { ...enriched, answeredBy: String(answeredBy) };
        }

        logger.info(
          {
            callSid,
            contextRaw,
            contextParsed: meetingContext,
            answeredBy,
            host,
            streamUrl,
          },
          "twilio/voice hit",
        );
        if (callSid) {
          const json = JSON.stringify(enriched);
          await redisConnection.set(
            `call-context:${callSid}`,
            json,
            "EX",
            3600,
          );
          await redisConnection.set(
            `session:context:${callSid}`,
            json,
            "EX",
            3600,
          );
        }

        const twiml = buildInboundCallTwiML(streamUrl, enriched);

        logger.info({ host, streamUrl }, "Call — returning TwiML");

        return reply.header("Content-Type", "text/xml").send(twiml);
      } catch (err) {
        logger.error({ err }, "Voice webhook error");
        // Always return valid TwiML so Twilio doesn't play "application error"
        return reply.type("text/xml").send(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Hello! xTanBot is connecting you now.</Say>
</Response>`,
        );
      }
    },
  );

  // POST /twilio/status — Twilio calls this on call status changes
  app.post(
    "/twilio/status",
    { config: { rateLimit: { max: 300 } } },
    async (request, reply) => {
      if (!guardTwilioSignature(request, reply)) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const body = request.body as Record<string, string>;
      const {
        CallSid = "",
        CallStatus = "",
        CallDuration,
      } = body as Record<string, string>;

      logger.info({ CallSid, CallStatus }, "Call status update");

      const duration = CallDuration ? parseInt(CallDuration) : undefined;

      const call = await callService.updateCallStatus(
        CallSid,
        CallStatus,
        duration,
      );

      if (CallStatus === "completed" && call) {
        await meetingCallQueue.add(
          "post-call-intelligence",
          {
            callId: call.id,
            callSid: CallSid,
            userId: call.userId,
            duration: CallDuration,
          },
          { delay: 2000 },
        );
      }

      return reply.status(204).send();
    },
  );

  // WS /twilio/stream — Twilio media stream WebSocket
  app.get("/twilio/stream", { websocket: true }, (socket: WebSocket) => {
    // MUST be first to catch handshake/early errors
    socket.on("error", (err: Error) => {
      logger.error({ err }, "WebSocket error");
    });

    logger.info("WebSocket /twilio/stream connected");

    try {
      const pipeline = createPipeline(
        (data: string) => {
          if (socket.readyState === socket.OPEN) {
            socket.send(data);
          }
        },
        null,
        (code: number, reason: string) => socket.close(code, reason),
      );

      socket.on("message", async (rawMessage: Buffer) => {
        await pipeline.handleMessage(rawMessage.toString());
      });

      socket.on("close", () => {
        logger.info("Twilio WebSocket stream disconnected");
      });
    } catch (err) {
      logger.error({ err }, "WebSocket handler crashed");
      socket.close(1011, "internal error");
    }
  });
});
