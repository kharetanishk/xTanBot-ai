import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import WebSocket, { WebSocketServer } from "ws";
import { createLogger } from "@xtanbot/logger";
import { createPipeline } from "@xtanbot/voice-pipeline";

const log = createLogger("TwilioMediaStream");

/**
 * Twilio Media Streams must use a raw HTTP upgrade + `ws` server.
 * @fastify/websocket dispatches upgrades through Fastify’s reply lifecycle and
 * can leave the TCP socket in a bad state (Twilio 31921, no audio) even when
 * ngrok shows 101 Switching Protocols.
 */
export function attachTwilioMediaStreamWss(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head) => {
    const path = (request.url ?? "").split("?")[0];
    if (path !== "/twilio/stream") {
      return;
    }

    log.info(
      {
        upgrade: request.headers.upgrade,
        connection: request.headers.connection,
        ip: request.socket.remoteAddress,
        "x-forwarded-for": request.headers["x-forwarded-for"],
      },
      "Twilio Media Stream: upgrade request",
    );

    try {
      wss.handleUpgrade(request, socket, head, (ws) => {
        log.info("Twilio Media Stream: WebSocket open");

        ws.on("error", (err: Error) => {
          log.error({ err }, "Twilio Media Stream WebSocket error");
        });

        ws.on("close", (code: number, reason: Buffer) => {
          log.info(
            { code, reason: reason.toString() },
            "Twilio Media Stream WebSocket closed",
          );
        });

        try {
          const pipeline = createPipeline(
            (data: string) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
              }
            },
            null,
            (code: number, reason: string) => {
              ws.close(code, reason);
            },
          );

          ws.on("message", async (rawMessage: Buffer) => {
            try {
              await pipeline.handleMessage(rawMessage.toString());
            } catch (err) {
              log.error({ err }, "Twilio stream message handler failed");
            }
          });
        } catch (err) {
          log.error({ err }, "Twilio Media Stream pipeline init failed");
          ws.close(1011, "internal error");
        }
      });
    } catch (err) {
      log.error({ err }, "Twilio Media Stream handleUpgrade failed");
      socket.destroy();
    }
  });
}
