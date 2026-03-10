"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), "../../.env") });
const EnvSchema = zod_1.z.object({
    // ─── App ─────────────────────────────────────────
    NODE_ENV: zod_1.z
        .enum(["development", "test", "production"])
        .default("development"),
    API_PORT: zod_1.z.coerce.number().default(3000),
    API_HOST: zod_1.z.string().default("0.0.0.0"),
    // ─── Database ─────────────────────────────────────
    DATABASE_URL: zod_1.z.string().url("DATABASE_URL must be a valid URL"),
    // ─── Redis ────────────────────────────────────────
    REDIS_URL: zod_1.z.string().url("REDIS_URL must be a valid URL"),
    // ─── Anthropic ────────────────────────────────────
    ANTHROPIC_API_KEY: zod_1.z.string().min(1, "ANTHROPIC_API_KEY is required"),
    ANTHROPIC_MODEL: zod_1.z.string().default("claude-opus-4-5"),
    // ─── ElevenLabs ───────────────────────────────────
    ELEVENLABS_API_KEY: zod_1.z.string().min(1, "ELEVENLABS_API_KEY is required"),
    ELEVENLABS_VOICE_ID: zod_1.z.string().min(1, "ELEVENLABS_VOICE_ID is required"),
    ELEVENLABS_MODEL_ID: zod_1.z.string().default("eleven_turbo_v2_5"),
    // ─── Twilio ───────────────────────────────────────
    TWILIO_ACCOUNT_SID: zod_1.z.string().min(1, "TWILIO_ACCOUNT_SID is required"),
    TWILIO_AUTH_TOKEN: zod_1.z.string().min(1, "TWILIO_AUTH_TOKEN is required"),
    TWILIO_PHONE_NUMBER: zod_1.z.string().min(1, "TWILIO_PHONE_NUMBER is required"),
    // ─── Deepgram ─────────────────────────────────────
    DEEPGRAM_API_KEY: zod_1.z.string().min(1, "DEEPGRAM_API_KEY is required"),
    // ─── Auth ─────────────────────────────────────────
    JWT_SECRET: zod_1.z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: zod_1.z.string().default("7d"),
    // ─── Worker ───────────────────────────────────────
    WORKER_CONCURRENCY: zod_1.z.coerce.number().default(10),
    // ─── Rate Limiting ────────────────────────────────
    RATE_LIMIT_CALLS_PER_HOUR: zod_1.z.coerce.number().default(20),
    RATE_LIMIT_AI_RPM: zod_1.z.coerce.number().default(60),
    VOICE_SESSION_MAX_DURATION_S: zod_1.z.coerce.number().default(1800),
});
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("❌ Invalid environment variables:\n");
    parsed.error.issues.forEach((issue) => {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    });
    console.error("\nFix the above variables in your .env file before starting.\n");
    process.exit(1);
}
exports.config = parsed.data;
//# sourceMappingURL=index.js.map