import type { FastifyInstance } from "fastify";
import corsPlugin from "./cors.plugin";
import helmetPlugin from "./helmet.plugin";
import jwtPlugin from "./jwt.plugin";
import rateLimitPlugin from "./rate-limit.plugin";
import websocketPlugin from "./websocket.plugin";

export async function registerPlugins(app: FastifyInstance): Promise<void> {
  await app.register(helmetPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(jwtPlugin);
  await app.register(websocketPlugin);
}
