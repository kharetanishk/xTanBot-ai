import { config } from "@xtanbot/config";
import {
  allTools,
  buildSystemPrompt,
  enrichToolInput,
  toolRouter,
  type AgentContext,
} from "@xtanbot/ai-core";
import { prisma } from "@xtanbot/db";
import { createLogger } from "@xtanbot/logger";
import { fileURLToPath } from "node:url";
import {
  AgentSession,
  AgentSessionEventTypes,
  ServerOptions,
  cli,
  defineAgent,
  llm,
  voice,
  type JobContext,
} from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import OpenAI from "openai";

const logger = createLogger("VoiceAgent");

// LiveKit Cloud runs the semantic turn detector + adaptive (ML) interruption on its inference
// gateway. A self-hosted livekit-server has neither, so fall back to Silero-VAD-driven turns.
const isLiveKitCloud = config.LIVEKIT_URL.includes("livekit.cloud");

/**
 * OpenRouter client that asks for the lowest-latency provider of the chosen model.
 * (The LiveKit OpenAI plugin can't pass OpenRouter's `provider` field, so we add it here.)
 */
const openRouter = new OpenAI({
  apiKey: config.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  fetch: (url, init) => {
    if (typeof init?.body === "string") {
      const body = JSON.parse(init.body) as Record<string, unknown>;
      body.provider = { sort: "latency" };
      init = { ...init, body: JSON.stringify(body) };
    }
    return fetch(url, init);
  },
});

/** Tools that take a beat — she acknowledges instantly instead of leaving dead air. */
const SLOW_TOOLS = new Set([
  "web_search",
  "web_fetch",
  "make_call",
  "story_call",
  "schedule_meeting",
  "set_alarm",
  "send_whatsapp",
  "lookup_contact",
  "get_location",
]);
const FILLERS = [
  "One sec, let me check.",
  "On it!",
  "Give me a moment.",
  "Sure, just a sec.",
  "Okay, let me do that.",
];

/** Current local time for the prompt, so "what time is it" needs no tool round-trip. */
function clockLine(timeZone: string): string {
  const now = new Date().toLocaleString("en-IN", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `\nCURRENT LOCAL TIME: ${now} (${timeZone}). Use this for any time/date question — never call get_current_time.`;
}

const VOICE_RULES = `
VOICE MODE: You are talking out loud in the xTanBot app. Your words are spoken by TTS, so:
- Reply in 1-2 short sentences. Never use markdown, lists, emojis, or URLs.
- Say numbers, times and phone numbers the way a person would speak them.
- Don't announce tool use — a short "one sec" is already played for you while slow tools run.`;

export default defineAgent({
  prewarm: async (proc) => {
    // Load the Silero ONNX model once per worker process instead of per session.
    // 300ms of silence marks "user stopped" (default 550). The semantic turn detector still
    // waits through mid-sentence pauses, so this only removes dead air after real stops.
    proc.userData.vad = await silero.VAD.load({ minSilenceDuration: 300 });
  },

  entry: async (ctx: JobContext) => {
    await ctx.connect();
    // The API mints the room token with identity = userId (see apps/api voice route).
    const participant = await ctx.waitForParticipant();
    const userId = participant.identity;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      logger.warn(
        { userId, room: ctx.room.name },
        "Unknown user joined voice room — disconnecting",
      );
      ctx.shutdown("unknown user");
      return;
    }

    let lastUserText = "";
    const agentCtx = (): AgentContext => ({
      sessionId: ctx.room.name ?? userId,
      userId,
      messages: [{ role: "user", content: lastUserText }],
      userProfile: {
        name: user.name,
        timezone: user.timezone,
        phone: user.phone ?? undefined,
      },
    });

    // Same 10 tools as text chat, same confirmation rules (enrichToolInput) — one source of truth.
    let session: AgentSession | null = null;
    const tools = allTools
      .filter((t) => t.name !== "get_current_time")
      .map((t) => {
        const def = t.toToolSchema();
        return llm.tool({
          name: def.name,
          description: def.description,
          parameters: def.parameters as NonNullable<
            Parameters<typeof llm.tool>[0]["parameters"]
          >,
          execute: async (args: unknown) => {
            const input = enrichToolInput(agentCtx(), def.name, args);
            logger.info({ userId, tool: def.name }, "Voice tool call");
            if (SLOW_TOOLS.has(def.name)) {
              // Instant acknowledgement; the real answer follows when the tool returns.
              session?.say(
                FILLERS[Math.floor(Math.random() * FILLERS.length)]!,
                { addToChatCtx: false },
              );
            }
            try {
              return await toolRouter.dispatch(
                def.name,
                input,
                !!input.confirmed,
              );
            } catch (err) {
              return {
                error: true,
                message: err instanceof Error ? err.message : String(err),
              };
            }
          },
        });
      });

    session = new AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: new deepgram.STT({
        apiKey: config.DEEPGRAM_API_KEY,
        model: "nova-3",
        language: "multi", // English + Hinglish code-switching
        smartFormat: false, // number/date reformatting delays every final transcript
      }),
      llm: new openai.LLM({
        client: openRouter,
        model: config.OPENROUTER_VOICE_MODEL,
      }),
      tts: new elevenlabs.TTS({
        apiKey: config.ELEVENLABS_API_KEY,
        voiceId: config.ELEVENLABS_VOICE_ID,
        // Turbo (not Flash): ~100ms slower to first audio but far more consistent timbre
        // sentence-to-sentence — Flash audibly drifted between "different voices".
        model: "eleven_turbo_v2_5",
        // Lock the language: per-chunk auto-detection changed her accent on short phrases.
        language: "en",
        voiceSettings: { stability: 0.6, similarity_boost: 0.85, style: 0, use_speaker_boost: true, speed: 1 },
        autoMode: true,
      }),
      // Barge-in (gideon-style): plain VAD interruption that needs 2 transcribed words, so
      // coughs / "mm-hmm" / speaker echo don't cut her off (or pause+resume her audio),
      // while a real "wait, actually…" stops her immediately.
      turnHandling: {
        ...(isLiveKitCloud
          ? {
              // Semantic end-of-turn model decides; only wait 300ms once it's confident.
              endpointing: { minDelay: 300 },
              // Start the LLM *and* TTS while the turn is still being confirmed.
              preemptiveGeneration: { enabled: true, preemptiveTts: true },
            }
          : { turnDetection: "vad" as const }),
        // minWords 1 so one-word interruptions ("stop", "wait", "no") cut her off; minDuration
        // 350ms still filters coughs and short noises, which don't last that long.
        interruption: { mode: "vad", minWords: 1, minDuration: 350 },
      },
      // LiveKit's default ignores ALL interruptions for the first 3s of every reply (echo
      // warm-up) — most replies are ~4s, so she was effectively uninterruptible. The browser's
      // WebRTC echo cancellation is already active; 300ms is plenty.
      aecWarmupDuration: 300,
    });

    session.on(AgentSessionEventTypes.UserInputTranscribed, (ev) => {
      if (ev.isFinal) lastUserText = ev.transcript;
    });

    // ── Latency instrumentation: one line per turn with the full breakdown ──
    // turn = user stops speaking (VAD) → agent starts speaking.
    let userStoppedAt: number | null = null;
    const stages: Record<string, number> = {};
    session.on(AgentSessionEventTypes.UserStateChanged, (ev) => {
      if (ev.oldState === "speaking" && ev.newState === "listening")
        userStoppedAt = Date.now();
    });
    session.on(AgentSessionEventTypes.AgentStateChanged, (ev) => {
      if (ev.newState === "speaking" && userStoppedAt) {
        logger.info(
          { turnMs: Date.now() - userStoppedAt, ...stages },
          "Turn latency",
        );
        userStoppedAt = null;
      }
    });
    session.on(AgentSessionEventTypes.MetricsCollected, (ev) => {
      const m = ev.metrics;
      if (m.type === "eou_metrics") {
        stages.eouMs = Math.round(m.endOfUtteranceDelayMs);
        stages.sttMs = Math.round(m.transcriptionDelayMs);
      } else if (m.type === "llm_metrics")
        stages.llmTtftMs = Math.round(m.ttftMs);
      else if (m.type === "tts_metrics")
        stages.ttsTtfbMs = Math.round(m.ttfbMs);
    });
    session.on(AgentSessionEventTypes.Error, (ev) => {
      const e = ev.error;
      logger.error(
        {
          message: e instanceof Error ? e.message : e.error.message,
          source: e.type,
        },
        "Voice session error",
      );
    });

    const baseInstructions = buildSystemPrompt(agentCtx()) + VOICE_RULES;
    const agent = new voice.Agent({
      instructions: baseInstructions + clockLine(user.timezone),
      tools,
    });
    await session.start({ agent, room: ctx.room });
    // Keep the clock in her instructions fresh (once a minute — cheap, and it never blocks a turn).
    const clock = setInterval(
      () =>
        void agent.updateInstructions(
          baseInstructions + clockLine(user.timezone),
        ),
      60_000,
    );
    ctx.addShutdownCallback(async () => clearInterval(clock));
    session.generateReply({
      instructions: `Greet ${user.name.split(" ")[0]} in one short sentence and ask how you can help.`,
    });
    logger.info(
      { userId, room: ctx.room.name, model: config.OPENROUTER_VOICE_MODEL },
      "Voice session started",
    );
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    wsURL: config.LIVEKIT_URL,
    apiKey: config.LIVEKIT_API_KEY,
    apiSecret: config.LIVEKIT_API_SECRET,
  }),
);
