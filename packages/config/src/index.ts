import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Resolves to repo root from packages/config/dist/
const rootDir = path.resolve(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(rootDir, ".env") });

const EnvSchema = z.object({
  // ─── App ─────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default("0.0.0.0"),

  // ─── Database ─────────────────────────────────────
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // ─── Redis ────────────────────────────────────────
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),

  // ─── Public API URL (for Twilio webhooks) ─────────
  API_URL: z.string().url("API_URL must be a valid URL"),

  // ─── Anthropic ────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  ANTHROPIC_MODEL: z.string().default("claude-opus-4-5"),
  ANTHROPIC_TIMEOUT_MS: z.coerce.number().default(15000),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().default(512),
  ANTHROPIC_HAIKU_MODEL: z.string().default("claude-haiku-4-5-20251001"),

  // ─── ElevenLabs ───────────────────────────────────
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY is required"),
  ELEVENLABS_VOICE_ID: z.string().min(1, "ELEVENLABS_VOICE_ID is required"),
  ELEVENLABS_MODEL_ID: z.string().default("eleven_turbo_v2_5"),

  // ─── Twilio ───────────────────────────────────────
  TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID is required"),
  TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN is required"),
  TWILIO_PHONE_NUMBER: z.string().min(1, "TWILIO_PHONE_NUMBER is required"),

  // ─── Deepgram ─────────────────────────────────────
  DEEPGRAM_API_KEY: z.string().min(1, "DEEPGRAM_API_KEY is required"),

  // ─── Auth ─────────────────────────────────────────
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // ─── Worker ───────────────────────────────────────
  WORKER_CONCURRENCY: z.coerce.number().default(10),

  // ─── Rate Limiting ────────────────────────────────
  RATE_LIMIT_CALLS_PER_HOUR: z.coerce.number().default(20),
  RATE_LIMIT_AI_RPM: z.coerce.number().default(60),
  VOICE_SESSION_MAX_DURATION_S: z.coerce.number().default(1800),

  // ─── Cost Control ───────────────────────────────
  MAX_COST_PER_SESSION_USD: z.coerce.number().default(0.50),

  // ─── Queue ──────────────────────────────────────
  MAX_AGENT_QUEUE_DEPTH: z.coerce.number().default(100),

  // ─── Monitoring ──────────────────────────────────
  SENTRY_DSN: z.string().optional().default(""),

  // ─── Bull Board ──────────────────────────────────
  BULL_BOARD_USERNAME: z.string().default("admin"),
  BULL_BOARD_PASSWORD: z.string().default(""),

  // ─── Expo / Mobile ───────────────────────────────
  EXPO_PUBLIC_PROJECT_ID: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:\n");
  parsed.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  });
  console.error(
    "\nFix the above variables in your .env file before starting.\n",
  );
  process.exit(1);
}

export const config: Env = parsed.data;
