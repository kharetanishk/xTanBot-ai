import { createClient } from "@deepgram/sdk";
import { config } from "@xtanbot/config";
import { createLogger } from "@xtanbot/logger";
import type { TranscriptResult } from "../types";

const logger = createLogger("STTClient");

export type TranscriptCallback = (result: TranscriptResult) => Promise<void>;

export function createDeepgramConnection(onTranscript: TranscriptCallback) {
  if (!config.DEEPGRAM_API_KEY) {
    logger.warn("DEEPGRAM_API_KEY not set — STT disabled");
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
    endpointing: 300,
    interim_results: true,
  });

  connection.on("open", () => {
    logger.info("Deepgram connection opened");
  });

  connection.on("Results", async (data: unknown) => {
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
      await onTranscript({
        transcript: transcript.trim(),
        isFinal,
        confidence,
      });
    }
  });

  connection.on("error", (err: unknown) => {
    logger.error({ err }, "Deepgram connection error");
  });

  connection.on("close", () => {
    logger.info("Deepgram connection closed");
  });

  return connection;
}

export function sendAudioToDeepgram(
  connection: ReturnType<typeof createDeepgramConnection>,
  audioBase64: string,
): void {
  if (!connection) return;
  const audioBuffer = Buffer.from(audioBase64, "base64");
  connection.send(audioBuffer.buffer as ArrayBuffer);
}
