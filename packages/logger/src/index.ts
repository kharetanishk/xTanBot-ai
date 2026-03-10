import pino from "pino";
import { config } from "@xtanbot/config";

const isDevelopment = config.NODE_ENV === "development";

const transport = isDevelopment
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "SYS:HH:MM:ss",
      },
    }
  : undefined;

const baseLogger = pino({
  level: isDevelopment ? "debug" : "info",
  base: { service: "xtanbot" },
  redact: {
    paths: [
      "*.password",
      "*.token",
      "*.apiKey",
      "*.authorization",
      "*.ANTHROPIC_API_KEY",
      "*.ELEVENLABS_API_KEY",
      "*.TWILIO_AUTH_TOKEN",
      "*.DEEPGRAM_API_KEY",
      "*.JWT_SECRET",
    ],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport,
});

export type Logger = pino.Logger;

export function createLogger(context: string): Logger {
  return baseLogger.child({ context });
}

export { pino };
