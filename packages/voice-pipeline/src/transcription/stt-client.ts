import { createClient } from "@deepgram/sdk";
import { config } from "@xtanbot/config";
import { createLogger } from "@xtanbot/logger";
import type { TranscriptResult } from "../types";

const logger = createLogger("STTClient");

/** Per-call cap; counter is not reset on each successful open (that caused infinite reconnects). */
const MAX_RECONNECT_ATTEMPTS = 8;
const RECONNECT_BASE_DELAY_MS = 1000;
const KEEPALIVE_INTERVAL_MS = 4000;

export type TranscriptCallback = (result: TranscriptResult) => Promise<void>;

export type SttLifecycle = {
  disposed: boolean;
  reconnectAttempts: number;
  keepAliveTimer: ReturnType<typeof setInterval> | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
};

export function createSttLifecycle(): SttLifecycle {
  return {
    disposed: false,
    reconnectAttempts: 0,
    keepAliveTimer: null,
    reconnectTimeout: null,
  };
}

function clearSttTimers(lifecycle: SttLifecycle): void {
  if (lifecycle.keepAliveTimer) {
    clearInterval(lifecycle.keepAliveTimer);
    lifecycle.keepAliveTimer = null;
  }
  if (lifecycle.reconnectTimeout) {
    clearTimeout(lifecycle.reconnectTimeout);
    lifecycle.reconnectTimeout = null;
  }
}

/** Call when the Twilio stream ends so we never reconnect or keep pinging Deepgram. */
export function markSttDisposed(lifecycle: SttLifecycle): void {
  lifecycle.disposed = true;
  clearSttTimers(lifecycle);
}

/** Start of a new call segment on this pipeline (same WS / same lifecycle object). */
export function resetSttLifecycleForCall(lifecycle: SttLifecycle): void {
  clearSttTimers(lifecycle);
  lifecycle.disposed = false;
  lifecycle.reconnectAttempts = 0;
}

export function createDeepgramConnection(
  lifecycle: SttLifecycle,
  onTranscript: TranscriptCallback,
  onReconnect?: (conn: ReturnType<typeof createDeepgramConnection>) => void,
) {
  if (!config.DEEPGRAM_API_KEY) {
    logger.warn("DEEPGRAM_API_KEY not set — STT disabled");
    return null;
  }

  if (lifecycle.disposed) {
    return null;
  }

  const deepgram = createClient(config.DEEPGRAM_API_KEY);

  const connection = deepgram.listen.live({
    model: "nova-2",
    language: "en-US",
    smart_format: true,
    encoding: "mulaw",
    sample_rate: 8000,
    channels: 1,
    endpointing: 500,
    interim_results: true,
    filler_words: false,
    utterance_end_ms: 1500,
  });

  connection.on("open", () => {
    if (lifecycle.disposed) return;
    logger.info("Deepgram connection opened");
    if (lifecycle.keepAliveTimer) {
      clearInterval(lifecycle.keepAliveTimer);
      lifecycle.keepAliveTimer = null;
    }
    // Avoid idle closes when the callee pauses: Deepgram expects audio or KeepAlive.
    lifecycle.keepAliveTimer = setInterval(() => {
      if (lifecycle.disposed) return;
      try {
        if (connection.isConnected()) {
          connection.keepAlive();
        }
      } catch (err) {
        logger.debug({ err }, "Deepgram keepAlive skipped");
      }
    }, KEEPALIVE_INTERVAL_MS);
  });

  connection.on("Results", async (data: unknown) => {
    try {
      const result = data as {
        channel?: {
          alternatives?: Array<{
            transcript: string;
            confidence: number;
          }>;
        };
        is_final?: boolean;
      };

      const transcript = result.channel?.alternatives?.[0]?.transcript;
      const confidence = result.channel?.alternatives?.[0]?.confidence ?? 0;
      const isFinal = result.is_final ?? false;

      if (transcript && transcript.trim().length > 0) {
        const trimmed = transcript.trim();
        if (isFinal) {
          logger.info(
            { transcript: trimmed, confidence },
            "Deepgram final transcript",
          );
        } else {
          logger.debug({ transcript: trimmed }, "Deepgram interim transcript");
        }
        await onTranscript({
          transcript: trimmed,
          isFinal,
          confidence,
        });
      }
    } catch (err) {
      logger.error({ err }, "Deepgram Results handler failed");
    }
  });

  connection.on("error", (err: unknown) => {
    logger.error({ err }, "Deepgram connection error");
    // Reconnect only from `close` to avoid double-scheduling reconnects.
  });

  connection.on("close", () => {
    clearSttTimers(lifecycle);
    logger.info("Deepgram connection closed");

    if (lifecycle.disposed) {
      logger.debug("Deepgram close after session end — not reconnecting");
      return;
    }

    if (lifecycle.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error(
        { attempts: lifecycle.reconnectAttempts },
        "Deepgram max reconnect attempts exceeded for this call",
      );
      return;
    }

    lifecycle.reconnectAttempts += 1;
    const delay =
      RECONNECT_BASE_DELAY_MS *
      Math.pow(2, Math.min(lifecycle.reconnectAttempts - 1, 5));

    logger.warn(
      { attempt: lifecycle.reconnectAttempts, delayMs: delay },
      "Deepgram closed during call — scheduling reconnect",
    );

    lifecycle.reconnectTimeout = setTimeout(() => {
      lifecycle.reconnectTimeout = null;
      if (lifecycle.disposed) return;
      const newConn = createDeepgramConnection(
        lifecycle,
        onTranscript,
        onReconnect,
      );
      if (newConn) {
        onReconnect?.(newConn);
      }
    }, delay);
  });

  return connection;
}

export function sendAudioToDeepgram(
  connection: ReturnType<typeof createDeepgramConnection>,
  audioBase64: string,
): void {
  if (!connection) return;
  const audioBuffer = Buffer.from(audioBase64, "base64");
  if (audioBuffer.length === 0) return;
  const slice = audioBuffer.buffer.slice(
    audioBuffer.byteOffset,
    audioBuffer.byteOffset + audioBuffer.byteLength,
  );
  connection.send(slice);
}
