import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { serverConfig } from "../config/server.config";

export default fp(async function jwtPlugin(app: FastifyInstance) {
  await app.register(jwt, {
    secret: serverConfig.jwtSecret,
    sign: {
      expiresIn: serverConfig.jwtExpiresIn,
    },
  });
});
