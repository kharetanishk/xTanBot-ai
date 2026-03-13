import { createLogger } from "@xtanbot/logger";
import { setSession, getSession, deleteSession } from "@xtanbot/redis";
import { enqueueAgentJob } from "@xtanbot/queues";
import { emit } from "@xtanbot/events";
import { config } from "@xtanbot/config";
import { callRepository, userRepository } from "@xtanbot/db";
import { counter, gauge } from "@xtanbot/observability";
import {
  createStreamHandler,
  buildTwilioAudioMessage,
  buildTwilioClearMessage,
} from "./twilio/stream-handler";
import {
  createDeepgramConnection,
  sendAudioToDeepgram,
} from "./transcription/stt-client";
import { streamTextToSpeech } from "./elevenlabs/tts-client";
import type { PipelineSession } from "./types";
import { randomUUID } from "crypto";

const logger = createLogger("VoicePipeline");

const activeCallsGauge = gauge(
  "xtanbot_active_calls",
  "Number of currently active voice call sessions",
);
const bargeInTotal = counter(
  "xtanbot_barge_in_total",
  "Total number of barge-in interruptions detected",
);

const FILLER_WORDS = [
  "um", "uh", "hmm", "mhm", "mm",
  "like", "you know", "i mean",
  "okay", "ok", "yeah", "yes", "no",
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

export type WebSocketSend = (data: string) => void;

export function createPipeline(wsSend: WebSocketSend) {
  let deepgramConnection: ReturnType<typeof createDeepgramConnection> = null;
  let currentStreamSid: string | null = null;
  let currentSession: PipelineSession | null = null;
  let isSpeaking = false;
  let silenceTimer: NodeJS.Timeout | null = null;
  let disconnectTimer: NodeJS.Timeout | null = null;
  const SILENCE_PROMPT_MS = 8000;
  const SILENCE_DISCONNECT_MS = 10000;
  let lastTranscript = "";
  const MIN_TRANSCRIPT_LENGTH = 3;

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
      "Final transcript received — enqueuing agent job",
    );

    await enqueueAgentJob({
      sessionId: currentSession.sessionId,
      userId: currentSession.userId,
      transcript: cleaned,
      callSid: currentSession.callSid,
      conversationId: currentSession.conversationId,
    });
  }

  async function handleTTSResponse(text: string): Promise<void> {
    isSpeaking = true;

    if (!currentStreamSid) {
      isSpeaking = false;
      return;
    }

    logger.debug({ textLength: text.length }, "Streaming TTS to Twilio");

    wsSend(buildTwilioClearMessage(currentStreamSid));

    await streamTextToSpeech(text, async (audioBase64) => {
      if (!isSpeaking || !currentStreamSid) return;
      wsSend(buildTwilioAudioMessage(currentStreamSid, audioBase64));
    });

    isSpeaking = false;
  }

  const streamHandler = createStreamHandler({
    async onStart(callSid, streamSid, from, to) {
      currentStreamSid = streamSid;

      const sessionId = randomUUID();
      const conversationId = randomUUID();

      let userId: string;
      let userName: string | undefined;
      let userTimezone = "UTC";

      try {
        const callRecord = await callRepository.findByCallSid(callSid);
        if (callRecord) {
          userId = callRecord.userId;
          const userRecord = await userRepository.findById(userId);
          if (userRecord) {
            userName = userRecord.name;
            userTimezone = userRecord.timezone;
          }
        } else {
          logger.warn({ callSid }, "Call record not found — using fallback userId");
          userId = callSid;
        }
      } catch (err) {
        logger.error({ err, callSid }, "Failed to look up user for call — using fallback");
        userId = callSid;
      }

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
        messages: [],
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        status: "active",
      });

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

      logger.info({ sessionId, callSid, userId, userName, userTimezone }, "Pipeline session started");

      deepgramConnection = createDeepgramConnection(
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

      const greeting = userName
        ? `Hello ${userName}! I'm xTanBot, your AI assistant. How can I help you today?`
        : "Hello! I'm xTanBot, your AI assistant. How can I help you today?";
      await handleTTSResponse(greeting);
      resetSilenceTimer();
    },

    async onAudioChunk(chunk) {
      if (isSpeaking && currentStreamSid) {
        isSpeaking = false;
        wsSend(buildTwilioClearMessage(currentStreamSid));
        logger.info(
          { sessionId: currentSession?.sessionId },
          "Barge-in detected — interrupting AI speech",
        );
        try {
          bargeInTotal.inc();
        } catch (err) {
          logger.error({ err }, "Failed to record barge_in_total metric");
        }
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

    if (currentSession) {
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
      deepgramConnection.finish();
      deepgramConnection = null;
    }

    currentSession = null;
    currentStreamSid = null;
  }

  return {
    handleMessage: streamHandler,
    handleTTSResponse,
  };
}
