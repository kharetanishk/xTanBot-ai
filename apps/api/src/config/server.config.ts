import { config } from "@xtanbot/config";

export const serverConfig = {
  port: config.API_PORT,
  host: config.API_HOST,
  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN,
  rateLimitCallsPerHour: config.RATE_LIMIT_CALLS_PER_HOUR,
  rateLimitAiRpm: config.RATE_LIMIT_AI_RPM,
  isDev: config.NODE_ENV === "development",
  isProd: config.NODE_ENV === "production",
} as const;
