import pino from "pino";
import { config } from "@xtanbot/config";

export function createLogger(context: string) {
  return pino({
    level: config.NODE_ENV === "production" ? "info" : "debug",
    base: { context, service: "xtanbot" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ["*.password", "*.token", "*.apiKey", "*.authorization"],
      censor: "[REDACTED]",
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
