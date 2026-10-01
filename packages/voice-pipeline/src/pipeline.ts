import { createLogger } from "@xtanbot/logger";
import { redisConnection, setSession, getSession, deleteSession } from "@xtanbot/redis";
import { runVoiceTurn, fallbackPhraseFor, createSentenceChunker } from "@xtanbot/ai-core";
import { emit } from "@xtanbot/events";
import { config } from "@xtanbot/config";
import { callRepository, userRepository, prisma } from "@xtanbot/db";
import { counter, gauge, histogram } from "@xtanbot/observability";
import {
  createStreamHandler,
  buildTwilioAudioMessage,
  buildTwilioClearMessage,
} from "./twilio/stream-handler";
import {
  createDeepgramConnection,
  createSttLifecycle,
  markSttDisposed,
  resetSttLifecycleForCall,
  sendAudioToDeepgram,
} from "./transcription/stt-client";
import {
  streamTextToSpeech,
  getVoiceSettingsForMood,
  type VoiceSettings,
} from "./elevenlabs/tts-client";
import type { PipelineSession } from "./types";
import { randomUUID } from "crypto";
import {
  registerVoiceTtsHandler,
  unregisterVoiceTtsHandler,
} from "./voice-session-registry";

const logger = createLogger("VoicePipeline");

const activeCallsGauge = gauge(
  "xtanbot_active_calls",
  "Number of currently active voice call sessions",
);
const bargeInTotal = counter(
  "xtanbot_barge_in_total",
  "Total number of barge-in interruptions detected",
);
const voiceFirstAudioMs = histogram(
  "xtanbot_voice_first_audio_ms",
  "Time from STT final transcript to first reply audio sent to Twilio in ms",
  [250, 500, 750, 1000, 1500, 2000, 3000, 5000],
);

/** Per-turn latency marks (epoch ms); gen is the TTS generation of the reply. */
type TurnTiming = {
  sttFinalAt: number;
  llmFirstTokenAt?: number;
  firstSentenceAt?: number;
  gen?: number;
};

/** Omit short reply words — they are often the entire user turn on a phone call. */
const FILLER_WORDS = [
  "um", "uh", "hmm", "mhm", "mm",
  "like", "you know", "i mean",
  "so", "well",
] as const;

function stripFillerWords(transcript: string): string {
  let result = transcript.toLowerCase().trim();
  for (const filler of FILLER_WORDS) {
    const pattern = new RegExp(
      `\\b${filler.replace(" ", "\\s+")}\\b`,
      "gi",
    );
    result = result.replace(pattern, "");
  }
  return result.replace(/\s+/g, " ").trim();
}

/** μ-law frame energy: silence/comfort-noise stays near one code; speech varies more. */
function mulawPayloadLooksLikeSpeech(
  base64Payload: string,
  minVariance = 72,
): boolean {
  const buf = Buffer.from(base64Payload, "base64");
  if (buf.length < 32) return false;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i]!;
  const mean = sum / buf.length;
  let varAcc = 0;
  for (let i = 0; i < buf.length; i++) {
    const d = buf[i]! - mean;
    varAcc += d * d;
  }
  const variance = varAcc / buf.length;
  return variance >= minVariance;
}

export type WebSocketSend = (data: string) => void;
export type WebSocketClose = (code: number, reason: string) => void;

type MeetingContext = {
  callType?: "scheduled-meeting" | "daily-briefing";
  meetingTitle?: string;
  attendeeName?: string;
  userName?: string;
  meetingCount?: number;
  meetings?: { title: string; time: string }[];
  userId?: string;
};

export function createPipeline(
  wsSend: WebSocketSend,
  meetingContext?: MeetingContext | null,
  wsClose?: WebSocketClose,
) {
  try {
    const sttLifecycle = createSttLifecycle();
    let deepgramConnection: ReturnType<typeof createDeepgramConnection> = null;
    let currentStreamSid: string | null = null;
    let currentSession: PipelineSession | null = null;
    let isSpeaking = false;
    /** Twilio sends inbound media immediately (silence/comfort noise). Treating that as barge-in clears the greeting before it plays. */
    let bargeInAllowed = false;
    let silenceTimer: NodeJS.Timeout | null = null;
    let disconnectTimer: NodeJS.Timeout | null = null;
    const SILENCE_PROMPT_MS = 8000;
    const SILENCE_DISCONNECT_MS = 10000;
    let lastTranscript = "";
    const MIN_TRANSCRIPT_LENGTH = 1;
    const MIN_WORD_COUNT = 1;
    let enqueueDebounceTimer: NodeJS.Timeout | null = null;
    let lastSttFinalAt = 0;
    let turnTiming: TurnTiming | null = null;
    /** Turns run one at a time so session history writes never interleave. */
    let voiceTurnChain: Promise<void> = Promise.resolve();
    /** Sentences of the current reply play in order through this chain. */
    let ttsChain: Promise<void> = Promise.resolve();
    /** Finals arriving inside the debounce window are appended, not replaced. */
    let pendingTranscript: string | null = null;
    /** Avoid Twilio clear on an empty outbound buffer (can contribute to 31951). */
    let hasBufferedOutboundMedia = false;
    let currentVoiceSettings: VoiceSettings = getVoiceSettingsForMood("default");
    /** Ignore barge-in right after TTS starts (echo / line noise clears the whole reply). */
    let bargeInGraceUntil = 0;
    /** Bumped per TTS utterance; a stale stream's chunks are dropped on mismatch. */
    let ttsGeneration = 0;
    let currentTTSAbort: AbortController | null = null;
    let consecutiveLoudInboundChunks = 0;
    const BARGE_IN_GRACE_MS = 750;
    const BARGE_IN_LOUD_CHUNKS_REQUIRED = 4;

    function resetSilenceTimer(): void {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      if (!currentSession) return;

      silenceTimer = setTimeout(() => {
        if (!currentSession || isSpeaking) return;
        logger.warn(
          { sessionId: currentSession.sessionId },
          "Silence detected — prompting user",
        );
        void handleTTSResponse("Are you still there? I didn't catch anything.");

        disconnectTimer = setTimeout(() => {
          if (!currentSession) return;
          logger.warn(
            { sessionId: currentSession.sessionId },
            "Silence timeout — terminating call",
          );
          void handleTTSResponse("I'll end the call now. Goodbye!")
            .then(() =>
              handleStop(currentSession!.callSid, currentSession!.streamSid),
            )
            .catch((err) =>
              logger.error({ err }, "Error during silence disconnect"),
            );
        }, SILENCE_DISCONNECT_MS);
      }, SILENCE_PROMPT_MS);
    }

  async function handleTranscript(
    transcript: string,
    isFinal: boolean,
  ): Promise<void> {
    if (!isFinal || !currentSession) return;

    const cleaned = stripFillerWords(transcript);

    if (cleaned.length < MIN_TRANSCRIPT_LENGTH) {
      logger.debug(
        { transcript, cleaned },
        "Transcript too short after cleaning — skipped",
      );
      return;
    }

    const wordCount = cleaned.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < MIN_WORD_COUNT) {
      logger.debug(
        { transcript, cleaned, wordCount },
        "Transcript word count too low — skipped",
      );
      return;
    }

    pendingTranscript = pendingTranscript
      ? `${pendingTranscript} ${cleaned}`
      : cleaned;
    lastSttFinalAt = Date.now();

    // Debounce: if another final fires within 350 ms (user still speaking),
    // append it and restart the timer so no segment is lost.
    if (enqueueDebounceTimer) {
      clearTimeout(enqueueDebounceTimer);
      enqueueDebounceTimer = null;
    }

    const sessionSnapshot = currentSession;
    logger.info(
      { transcript: cleaned, sessionId: sessionSnapshot.sessionId },
      "STT final — buffering for enqueue",
    );

    enqueueDebounceTimer = setTimeout(() => {
      enqueueDebounceTimer = null;
      const finalTranscript = pendingTranscript;
      pendingTranscript = null;
      if (!finalTranscript) return;

      if (finalTranscript === lastTranscript) {
        logger.debug(
          { transcript: finalTranscript },
          "Duplicate transcript — skipped",
        );
        return;
      }
      lastTranscript = finalTranscript;

      const sttFinalAt = lastSttFinalAt;
      // ponytail: after a barge-in the next turn waits for the abandoned LLM stream to
      // finish (it's usually done by then); pass an AbortSignal into runAgent if that bites.
      voiceTurnChain = voiceTurnChain.then(() =>
        runStreamedTurn(sessionSnapshot, finalTranscript, sttFinalAt),
      );
    }, 350);
  }

  /**
   * In-process voice turn: LLM tokens → sentence chunker → TTS, one sentence at a time.
   * Barge-in (or any newer reply) bumps ttsGeneration; from then on the rest of the
   * LLM stream is ignored and nothing more is spoken for this reply.
   */
  async function runStreamedTurn(
    session: PipelineSession,
    transcript: string,
    sttFinalAt: number,
  ): Promise<void> {
    const timing: TurnTiming = { sttFinalAt };
    turnTiming = timing;
    let replyGen: number | null = null;
    const abandoned = () =>
      currentSession !== session ||
      (replyGen !== null && replyGen !== ttsGeneration);

    const speak = (sentence: string) => {
      if (abandoned()) return;
      const first = replyGen === null;
      if (first) timing.firstSentenceAt = Date.now();
      handleTTSResponse(sentence, !first).catch((err) =>
        logger.error({ err, sessionId: session.sessionId }, "Sentence TTS failed"),
      );
      if (first) {
        replyGen = ttsGeneration;
        timing.gen = replyGen;
      }
    };
    const chunker = createSentenceChunker(speak);

    try {
      await runVoiceTurn(
        {
          sessionId: session.sessionId,
          userId: session.userId,
          transcript,
          callSid: session.callSid,
          conversationId: session.conversationId,
        },
        {
          onText: (delta) => {
            timing.llmFirstTokenAt ??= Date.now();
            if (!abandoned()) chunker.push(delta);
          },
        },
      );
      if (!abandoned()) chunker.flush();
    } catch (err) {
      logger.error(
        { err, sessionId: session.sessionId, transcript },
        "Voice turn failed — speaking fallback phrase",
      );
      speak(fallbackPhraseFor(err));
    }
  }

  function recordFirstAudio(gen: number): void {
    const t = turnTiming;
    if (!t || t.gen !== gen) return;
    turnTiming = null;
    const now = Date.now();
    const since = (at?: number) => (at ? at - t.sttFinalAt : null);
    try {
      voiceFirstAudioMs.observe(now - t.sttFinalAt);
    } catch (err) {
      logger.error({ err }, "Failed to record voice_first_audio_ms metric");
    }
    logger.info(
      {
        sessionId: currentSession?.sessionId,
        sttToLlmFirstTokenMs: since(t.llmFirstTokenAt),
        sttToFirstSentenceMs: since(t.firstSentenceAt),
        sttToFirstAudioMs: now - t.sttFinalAt,
      },
      "Voice turn latency (stt_final -> llm_first_token -> first_sentence_flushed -> first_tts_audio_chunk)",
    );
  }

  /**
   * Speak text. A new reply (append = false) takes a new generation, aborts and clears
   * whatever was playing, and restarts the barge-in grace. append = true queues the
   * text behind the current reply's sentences in the same generation.
   */
  async function handleTTSResponse(text: string, append = false): Promise<void> {
    let gen = ttsGeneration;
    if (!append) {
      gen = ++ttsGeneration;
      currentTTSAbort?.abort();
      currentTTSAbort = null;
      ttsChain = Promise.resolve();
    }
    isSpeaking = true;

    if (!currentStreamSid) {
      isSpeaking = false;
      return;
    }

    if (!append) {
      consecutiveLoudInboundChunks = 0;
      bargeInGraceUntil = Date.now() + BARGE_IN_GRACE_MS;
      if (hasBufferedOutboundMedia) {
        wsSend(buildTwilioClearMessage(currentStreamSid));
      }
    }

    logger.debug({ textLength: text.length, append }, "Streaming TTS to Twilio");

    const play = ttsChain.then(async () => {
      // Barge-in or a newer reply happened while this sentence was queued.
      if (gen !== ttsGeneration || !currentStreamSid) return;
      const abortController = new AbortController();
      currentTTSAbort = abortController;
      try {
        await streamTextToSpeech(
          text,
          async (audioBase64) => {
            if (gen !== ttsGeneration || !currentStreamSid) return;
            if (!audioBase64?.length) return;
            wsSend(buildTwilioAudioMessage(currentStreamSid, audioBase64));
            hasBufferedOutboundMedia = true;
            recordFirstAudio(gen);
          },
          abortController.signal,
          currentVoiceSettings,
        );
      } finally {
        if (currentTTSAbort === abortController) currentTTSAbort = null;
      }
    });
    const tail = play.catch(() => undefined);
    ttsChain = tail;

    try {
      await play;
    } finally {
      // Only the last queued sentence of the newest reply clears isSpeaking.
      if (gen === ttsGeneration && ttsChain === tail) {
        isSpeaking = false;
      }
    }
  }

  const streamHandler = createStreamHandler({
    async onStart(callSid, streamSid, from, to) {
      try {
        bargeInAllowed = false;
        currentStreamSid = streamSid;

        const sessionId = randomUUID();
        let conversationId = randomUUID();

        let userId: string;
        let userName: string | undefined;
        let userTimezone = "UTC";
        let ctx: unknown = { callType: "inbound" };
        try {
          const raw = await redisConnection.get(`call-context:${callSid}`);
          if (raw) {
            ctx = JSON.parse(raw);
          }
        } catch (err) {
          logger.warn({ err, callSid }, "Failed to read call context from Redis");
        }

        logger.info({ callSid, ctx }, "Pipeline onStart — context loaded");

        try {
          const callRecord = await callRepository.findByCallSid(callSid);
          if (callRecord) {
            userId = callRecord.userId;
            const userRecord = await userRepository.findById(userId);
            if (userRecord) {
              userName = userRecord.name;
              userTimezone = userRecord.timezone;
            }
          } else if (
            (ctx as any)?.userId &&
            typeof (ctx as any).userId === "string"
          ) {
            userId = (ctx as any).userId as string;
            const userRecord = await userRepository.findById(userId);
            if (userRecord) {
              userName = userRecord.name;
              userTimezone = userRecord.timezone;
            }
          } else if (meetingContext?.userId) {
            userId = meetingContext.userId;
            const userRecord = await userRepository.findById(userId);
            if (userRecord) {
              userName = userRecord.name;
              userTimezone = userRecord.timezone;
            }
          } else {
            logger.warn({ callSid }, "Call record not found — using fallback userId");
            userId = callSid;
          }

          // Ensure outbound calls have a Conversation row (and use it as conversationId)
          try {
            let conversation = await prisma.conversation.findFirst({
              where: { callId: callRecord?.id ?? undefined },
            });

            if (!conversation) {
              const ctxUserId = (ctx as any)?.userId as string | undefined;
              conversation = await prisma.conversation.create({
                data: {
                  userId: ctxUserId ?? userId,
                  callId: callRecord?.id ?? null,
                },
              });
              logger.info(
                { conversationId: conversation.id, callSid },
                "Created new conversation for outbound call",
              );
            }

            conversationId = conversation.id as typeof conversationId;
          } catch (err) {
            logger.error({ err, callSid }, "Failed to find-or-create conversation for call");
          }
        } catch (err) {
          logger.error({ err, callSid }, "Failed to look up user for call — using fallback");
          userId = callSid;
        }

        // ctx is already the full call context (story/appointment/general/inbound),
        // written to call-context:{callSid} by the story-call/make_call path before
        // the twilio/voice webhook fires, and preserved by that webhook.
        const mergedCtx = ctx as Record<string, unknown>;

        // Set voice settings based on mood in call context (for story calls)
        const ctxMood = (mergedCtx.mood as string | undefined) ?? "default";
        currentVoiceSettings = getVoiceSettingsForMood(ctxMood);

        const session: PipelineSession = {
          sessionId,
          userId,
          callSid,
          streamSid,
          conversationId,
          fromNumber: from,
          toNumber: to,
          createdAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          status: "active",
        };

        currentSession = session;

        await setSession(sessionId, {
          sessionId,
          userId,
          callSid,
          conversationId,
          voiceContext: mergedCtx,
          messages: [],
          createdAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          status: "active",
        });

        // mergedCtx is already at call-context:{callSid}; nothing extra to write back.

        registerVoiceTtsHandler(sessionId, handleTTSResponse);

        await emit.sessionCreated({
          sessionId,
          userId,
          callSid,
          timestamp: new Date().toISOString(),
        });

        try {
          activeCallsGauge.inc();
        } catch (err) {
          logger.error({ err }, "Failed to record active_calls metric");
        }

        logger.info(
          { sessionId, callSid, userId, userName, userTimezone },
          "Pipeline session started",
        );

        let greeting = "Hello! I'm xTanBot, your AI assistant. How can I help you today?";

        // Use mergedCtx (base ctx + pending appointment context) for greeting selection
        const ctxCallType = (mergedCtx as any)?.callType as string | undefined;
        const ctxPurpose = (mergedCtx as any)?.purpose as string | undefined;
        const isAppointmentCall =
          ctxPurpose?.toLowerCase().includes("appointment") ||
          ctxPurpose?.toLowerCase().includes("booking");
        const isStoryCall = ctxCallType === "story-call";

        if (isStoryCall) {
          const calleeName = (mergedCtx as any)?.calleeName as string | undefined;
          const ctxMoodLabel = (mergedCtx as any)?.mood as string | undefined;
          const moodGreeting: Record<string, string> = {
            friendly: "Hi there",
            sales: "Hello",
            rude: "Hey",
            intellectual: "Good day",
            influencing: "Hello",
            custom: "Hello",
          };
          const prefix = moodGreeting[ctxMoodLabel ?? "friendly"] ?? "Hello";
          greeting =
            `${prefix}${calleeName ? `, ${calleeName}` : ""}! ` +
            `This is xTanBot calling on behalf of ${userName}. Do you have a moment?`;
        } else if (ctxCallType === "general-call" || (ctxPurpose && !isAppointmentCall)) {
          const calleeName = (mergedCtx as any)?.calleeName as string | undefined;
          const un =
            ((mergedCtx as any)?.userName as string | undefined) ?? userName;
          // Do NOT say "how can I help" — we placed this call, state our purpose
          greeting =
            `Hello${calleeName ? `, ${calleeName}` : ""}! This is xTanBot calling on behalf of ${un ?? "the user"}. ` +
            `${ctxPurpose}. Is this a good time?`;
        } else if (isAppointmentCall) {
          const calleeName = (mergedCtx as any)?.calleeName as string | undefined;
          const un =
            ((mergedCtx as any)?.userName as string | undefined) ?? userName;
          const appointmentDate = (mergedCtx as any)?.appointmentDate as string | undefined;
          const appointmentTime = (mergedCtx as any)?.appointmentTime as string | undefined;
          greeting =
            `Hello, I am xTanBot calling on behalf of ${un ?? "the user"} to book an appointment` +
            (calleeName ? ` with ${calleeName}` : "") +
            (appointmentDate ? ` for ${appointmentDate}` : "") +
            (appointmentTime ? ` at ${appointmentTime}` : "") +
            ". Am I speaking with the right person?";
        } else if (ctxCallType === "scheduled-meeting") {
          const contactName =
            ((mergedCtx as any)?.contactName as string | undefined) ??
            ((mergedCtx as any)?.attendeeName as string | undefined);
          const un =
            ((mergedCtx as any)?.userName as string | undefined) ?? userName;
          greeting = `Hi, this is xTanBot calling on behalf of ${un ?? "the user"}. Am I speaking with ${contactName ?? "there"}?`;
        } else if (ctxCallType === "daily-briefing") {
          const name = (mergedCtx as any)?.userName as string | undefined;
          greeting = `Good morning ${name ?? "there"}! This is your xTanBot daily briefing.`;
        } else if (
          !meetingContext &&
          ctxCallType !== "scheduled-meeting" &&
          ctxCallType !== "daily-briefing"
        ) {
          const callerPhone = from;
          if (callerPhone) {
            try {
              const contact = await prisma.contact.findFirst({
                where: { phone: callerPhone, deletedAt: null },
              });
              if (contact) {
                const upcomingMeeting = await prisma.meeting.findFirst({
                  where: {
                    userId: contact.userId,
                    attendees: { has: contact.email ?? "" },
                    startTime: { gte: new Date() },
                    status: { in: ["scheduled", "confirmed"] },
                  },
                  orderBy: { startTime: "asc" },
                });
                if (upcomingMeeting) {
                  const timeStr = new Date(
                    upcomingMeeting.startTime,
                  ).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });
                  greeting = `Hi ${contact.name}! Great to hear from you. I see you have "${upcomingMeeting.title}" scheduled for ${timeStr}. Would you like to discuss that, or is there something else I can help with?`;
                } else {
                  greeting = `Hi ${contact.name}! Great to hear from you. How can I help you today?`;
                }
              }
            } catch (err) {
              logger.error({ err }, "Failed to build smart inbound greeting");
            }
          }
        } else if (userName) {
          greeting = `Hello ${userName}! I'm xTanBot, your AI assistant. How can I help you today?`;
        }

        try {
          await handleTTSResponse(greeting);
        } catch (err) {
          // isSpeaking is already reset by the finally in handleTTSResponse.
          logger.error({ err, callSid }, "Greeting TTS failed — call stays open");
        }

        // Open STT only after the greeting so Deepgram is not idle with no audio (drops the socket).
        resetSttLifecycleForCall(sttLifecycle);
        deepgramConnection = createDeepgramConnection(
          sttLifecycle,
          async (result) => {
            await handleTranscript(result.transcript, result.isFinal);
          },
          (newConn) => {
            deepgramConnection = newConn;
            logger.info(
              { sessionId: currentSession?.sessionId },
              "Deepgram connection reference updated after reconnect",
            );
          },
          async () => {
            logger.error(
              { sessionId: currentSession?.sessionId },
              "STT unrecoverable — speaking fallback and closing call",
            );
            try {
              await handleTTSResponse(
                "I'm having trouble hearing you right now — let me have someone call you back.",
              );
            } catch (err) {
              logger.error({ err }, "STT fallback TTS failed");
            }
            // Closing the socket ourselves means Twilio never sends `stop`,
            // so run the same teardown that the stop event would have.
            if (currentSession) {
              try {
                await handleStop(
                  currentSession.callSid,
                  currentSession.streamSid,
                );
              } catch (err) {
                logger.error({ err }, "handleStop failed on STT unrecoverable path");
              }
            }
            wsClose?.(1011, "stt_unrecoverable");
          },
        );

        bargeInAllowed = true;
        resetSilenceTimer();
      } catch (err) {
        logger.error({ err, callSid }, "Pipeline init failed — closing gracefully");
        if (wsClose) {
          wsClose(1011, "Pipeline initialization error");
        }
        return;
      }
    },

    async onAudioChunk(chunk) {
      const fromCallee = chunk.track !== "outbound";

      if (bargeInAllowed && isSpeaking && currentStreamSid && fromCallee) {
        const pastGrace = Date.now() >= bargeInGraceUntil;
        const loud = mulawPayloadLooksLikeSpeech(chunk.payload);
        if (!pastGrace) {
          consecutiveLoudInboundChunks = 0;
        } else if (!loud) {
          consecutiveLoudInboundChunks = 0;
        } else {
          consecutiveLoudInboundChunks += 1;
          if (consecutiveLoudInboundChunks >= BARGE_IN_LOUD_CHUNKS_REQUIRED) {
            consecutiveLoudInboundChunks = 0;
            isSpeaking = false;
            currentTTSAbort?.abort();
            currentTTSAbort = null;
            ttsGeneration++;
            wsSend(buildTwilioClearMessage(currentStreamSid));
            logger.info(
              { sessionId: currentSession?.sessionId },
              "Barge-in — user speech during AI playback (after grace + sustained level)",
            );
            try {
              bargeInTotal.inc();
            } catch (err) {
              logger.error({ err }, "Failed to record barge_in_total metric");
            }
          }
        }
      } else {
        consecutiveLoudInboundChunks = 0;
      }

      if (!currentSession) return;

      const sessionAge =
        Date.now() - new Date(currentSession.createdAt).getTime();

      if (sessionAge > config.VOICE_SESSION_MAX_DURATION_S * 1000) {
        logger.warn(
          { sessionId: currentSession.sessionId },
          "Session max duration exceeded — terminating",
        );
        await handleStop(currentSession.callSid, currentSession.streamSid);
        return;
      }

      sendAudioToDeepgram(deepgramConnection, chunk.payload);
      // Twilio streams comfort-noise frames continuously; resetting on every
      // frame meant the silence watchdog could never elapse.
      if (mulawPayloadLooksLikeSpeech(chunk.payload)) {
        resetSilenceTimer();
      }
    },

    async onStop(callSid, streamSid) {
      await handleStop(callSid, streamSid);
    },
  });

  async function handleStop(callSid: string, streamSid: string): Promise<void> {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    if (enqueueDebounceTimer) {
      clearTimeout(enqueueDebounceTimer);
      enqueueDebounceTimer = null;
    }
    pendingTranscript = null;
    lastTranscript = "";
    turnTiming = null;

    logger.info({ callSid, streamSid }, "Pipeline session ending");

    markSttDisposed(sttLifecycle);

    if (currentSession) {
      unregisterVoiceTtsHandler(currentSession.sessionId);
      await deleteSession(currentSession.sessionId);

      try {
        activeCallsGauge.dec();
      } catch (err) {
        logger.error({ err }, "Failed to record active_calls metric");
      }

      await emit.sessionExpired({
        sessionId: currentSession.sessionId,
        userId: currentSession.userId,
        timestamp: new Date().toISOString(),
      });
    }

    if (deepgramConnection) {
      try {
        deepgramConnection.finish();
      } catch (err) {
        logger.debug({ err }, "Deepgram finish after dispose");
      }
      deepgramConnection = null;
    }

    currentSession = null;
    currentStreamSid = null;
  }

  return {
    handleMessage: streamHandler,
    handleTTSResponse,
  };
  } catch (err) {
    logger.error({ err }, "PIPELINE CRASH");
    throw err;
  }
}
