import { createLogger } from "@xtanbot/logger";
import { setSession, getSession, deleteSession } from "@xtanbot/redis";
import { enqueueAgentJob } from "@xtanbot/queues";
import { emit } from "@xtanbot/events";
import { config } from "@xtanbot/config";
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

export type WebSocketSend = (data: string) => void;

export function createPipeline(wsSend: WebSocketSend) {
  let deepgramConnection: ReturnType<typeof createDeepgramConnection> = null;
  let currentStreamSid: string | null = null;
  let currentSession: PipelineSession | null = null;

  async function handleTranscript(
    transcript: string,
    isFinal: boolean,
  ): Promise<void> {
    if (!isFinal || !currentSession) return;

    logger.info(
      { transcript, sessionId: currentSession.sessionId },
      "Final transcript received — enqueuing agent job",
    );

    await enqueueAgentJob({
      sessionId: currentSession.sessionId,
      userId: currentSession.userId,
      transcript,
      callSid: currentSession.callSid,
      conversationId: currentSession.conversationId,
    });
  }

  async function handleTTSResponse(text: string): Promise<void> {
    if (!currentStreamSid) return;

    logger.debug({ textLength: text.length }, "Streaming TTS to Twilio");

    wsSend(buildTwilioClearMessage(currentStreamSid));

    await streamTextToSpeech(text, async (audioBase64) => {
      if (currentStreamSid) {
        wsSend(buildTwilioAudioMessage(currentStreamSid, audioBase64));
      }
    });
  }

  const streamHandler = createStreamHandler({
    async onStart(callSid, streamSid, from, to) {
      currentStreamSid = streamSid;

      const sessionId = randomUUID();
      const conversationId = randomUUID();

      // TODO Day 3: look up userId from callSid via callRepository
      const userId = randomUUID(); // placeholder

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

      logger.info({ sessionId, callSid }, "Pipeline session started");

      deepgramConnection = createDeepgramConnection(async (result) => {
        await handleTranscript(result.transcript, result.isFinal);
      });

      // Send greeting
      await handleTTSResponse(
        "Hello! I'm xTanBot, your AI assistant. How can I help you today?",
      );
    },

    async onAudioChunk(chunk) {
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
    },

    async onStop(callSid, streamSid) {
      await handleStop(callSid, streamSid);
    },
  });

  async function handleStop(callSid: string, streamSid: string): Promise<void> {
    logger.info({ callSid, streamSid }, "Pipeline session ending");

    if (currentSession) {
      await deleteSession(currentSession.sessionId);

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
