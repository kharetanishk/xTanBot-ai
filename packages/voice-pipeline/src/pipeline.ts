import { createLogger } from "@xtanbot/logger";
import { redisConnection, setSession, getSession, deleteSession } from "@xtanbot/redis";
import { enqueueAgentJob } from "@xtanbot/queues";
import { emit } from "@xtanbot/events";
import { config } from "@xtanbot/config";
import { callRepository, userRepository, prisma } from "@xtanbot/db";
import { counter, gauge } from "@xtanbot/observability";
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

/** Omit short reply words — they are often the entire user turn on a phone call. */
const FILLER_WORDS = [
  "um", "uh", "hmm", "mhm", "mm",
  "like", "you know", "i mean",
  "so", "well", "right",
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
    const MIN_TRANSCRIPT_LENGTH = 2;
    /** Avoid Twilio clear on an empty outbound buffer (can contribute to 31951). */
    let hasBufferedOutboundMedia = false;
    let currentVoiceSettings: VoiceSettings = getVoiceSettingsForMood("default");
    /** Ignore barge-in right after TTS starts (echo / line noise clears the whole reply). */
    let bargeInGraceUntil = 0;
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

    if (cleaned === lastTranscript) {
      logger.debug(
        { transcript: cleaned },
        "Duplicate transcript — skipped",
      );
      return;
    }

    lastTranscript = cleaned;

    logger.info(
      { transcript: cleaned, sessionId: currentSession.sessionId },
      "STT final — enqueueing agent job",
    );

    try {
      await enqueueAgentJob({
        sessionId: currentSession.sessionId,
        userId: currentSession.userId,
        transcript: cleaned,
        callSid: currentSession.callSid,
        conversationId: currentSession.conversationId,
      });
      logger.info(
        { sessionId: currentSession.sessionId },
        "Agent job queued successfully",
      );
    } catch (err) {
      logger.error(
        { err, sessionId: currentSession.sessionId, transcript: cleaned },
        "Failed to enqueue agent job — no AI reply for this turn",
      );
    }
  }

  async function handleTTSResponse(text: string): Promise<void> {
    isSpeaking = true;
    consecutiveLoudInboundChunks = 0;

    if (!currentStreamSid) {
      isSpeaking = false;
      return;
    }

    bargeInGraceUntil = Date.now() + BARGE_IN_GRACE_MS;

    logger.debug({ textLength: text.length }, "Streaming TTS to Twilio");

    if (hasBufferedOutboundMedia) {
      wsSend(buildTwilioClearMessage(currentStreamSid));
    }

    await streamTextToSpeech(
      text,
      async (audioBase64) => {
        if (!isSpeaking || !currentStreamSid) return;
        if (!audioBase64?.length) return;
        wsSend(buildTwilioAudioMessage(currentStreamSid, audioBase64));
        hasBufferedOutboundMedia = true;
      },
      undefined,
      currentVoiceSettings,
    );

    isSpeaking = false;
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

        // Load any pending call context stored by make_call tool (appointment booking, etc.)
        let pendingCallContext: Record<string, unknown> = {};
        try {
          const normalised = (to ?? "").replace(/^\+/, "");
          if (normalised) {
            const contextKey = `call:context:pending:${normalised}`;
            const storedCtx = await redisConnection.get(contextKey);
            if (storedCtx) {
              pendingCallContext = JSON.parse(storedCtx) as Record<string, unknown>;
              await redisConnection.del(contextKey);
              logger.info(
                { contextKey, pendingCallContext },
                "Loaded and consumed pending call context from Redis",
              );
            }
          }
        } catch (err) {
          logger.warn({ err }, "Failed to load pending call context from Redis");
        }

        // Merge pending context into the existing voice context (from call-context:callSid)
        const mergedCtx = { ...(ctx as Record<string, unknown>), ...pendingCallContext };

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

        // Write merged context back to callSid key so post-call-intelligence worker can read it
        if (Object.keys(pendingCallContext).length > 0 && callSid) {
          try {
            await redisConnection.set(
              `call-context:${callSid}`,
              JSON.stringify(mergedCtx),
              "EX",
              3600,
            );
            logger.info({ callSid }, "Call context stored at callSid key");
          } catch (err) {
            logger.warn({ err }, "Failed to store callContext at callSid");
          }
        }

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

        await handleTTSResponse(greeting);

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
      resetSilenceTimer();
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
    lastTranscript = "";

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
