import type { FastifyInstance } from "fastify";
import { AccessToken } from "livekit-server-sdk";
import { config } from "@xtanbot/config";
import { requireAuth } from "../middleware/auth.middleware";

export async function voiceRoutes(app: FastifyInstance): Promise<void> {
  // Mints a short-lived LiveKit room token. The voice-agent worker is auto-dispatched into
  // every new room and reads the userId from the participant identity set here.
  app.post("/voice/session", { preHandler: requireAuth }, async (request, reply) => {
    if (!config.LIVEKIT_URL || !config.LIVEKIT_API_KEY || !config.LIVEKIT_API_SECRET) {
      return reply.status(503).send({
        statusCode: 503,
        error: "Service Unavailable",
        message: "Voice chat is not configured (LIVEKIT_* env vars missing)",
      });
    }
    const { userId } = request.user;
    const roomName = `voice-${userId}-${Date.now()}`;
    const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
      identity: userId,
      ttl: "15m",
    });
    at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
    return reply.send({ url: config.LIVEKIT_URL, token: await at.toJwt(), roomName });
  });
}
