import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { WebSocket } from "ws";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
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
    logger.warn({ ip: request.ip }, "Missing Twilio signature — request rejected");
    return false;
  }

  const url = `https://${request.hostname}${request.url}`;
  const isValid = validateTwilioSignature(
    url,
    request.body as Record<string, string>,
    signature,
  );

  if (!isValid) {
    logger.warn({ url, ip: request.ip }, "Invalid Twilio signature — request rejected");
    return false;
  }

  return true;
}

export async function twilioRoutes(app: FastifyInstance): Promise<void> {
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

        const contextParam = (request.query as Record<string, unknown> | undefined)
          ?.context;
        let meetingContext: unknown = null;
        if (typeof contextParam === "string") {
          try {
            meetingContext = JSON.parse(decodeURIComponent(contextParam));
          } catch {
            // ignore malformed context
          }
        }

        const twiml = buildInboundCallTwiML(streamUrl, meetingContext);

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
    logger.info("Twilio WebSocket stream connected");

    const pipeline = createPipeline((data: string) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(data);
      }
    });

    socket.on("message", async (rawMessage: Buffer) => {
      await pipeline.handleMessage(rawMessage.toString());
    });

    socket.on("close", () => {
      logger.info("Twilio WebSocket stream disconnected");
    });

    socket.on("error", (err: Error) => {
      logger.error({ err }, "Twilio WebSocket error");
    });
  });
}
