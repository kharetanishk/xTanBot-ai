import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default("claude-opus-4-5"),

  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_VOICE_ID: z.string().min(1),
  ELEVENLABS_MODEL_ID: z.string().default("eleven_turbo_v2_5"),

  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),

  DEEPGRAM_API_KEY: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),

  WORKER_CONCURRENCY: z.coerce.number().default(10),

  RATE_LIMIT_CALLS_PER_HOUR: z.coerce.number().default(20),
  RATE_LIMIT_AI_RPM: z.coerce.number().default(60),
  VOICE_SESSION_MAX_DURATION_S: z.coerce.number().default(1800),
});

export type Env = z.infer<typeof EnvSchema>;

export const config: Env = EnvSchema.parse(process.env);
