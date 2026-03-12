import type { FastifyRequest, FastifyReply } from "fastify";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("AuthMiddleware");

export type JwtPayload = {
  userId: string;
  email: string;
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    logger.warn({ err }, "Unauthorized request");
    await reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid or missing token",
    });
  }
}
