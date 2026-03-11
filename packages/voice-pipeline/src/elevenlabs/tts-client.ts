import { ElevenLabsClient } from "elevenlabs";
import { config } from "@xtanbot/config";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("TTSClient");

const elevenLabsClient = new ElevenLabsClient({
  apiKey: config.ELEVENLABS_API_KEY,
});

export type AudioChunkCallback = (audioBase64: string) => Promise<void>;

export async function streamTextToSpeech(
  text: string,
  onAudioChunk: AudioChunkCallback,
  voiceId?: string,
): Promise<void> {
  const targetVoiceId = voiceId ?? config.ELEVENLABS_VOICE_ID;

  logger.debug(
    { voiceId: targetVoiceId, textLength: text.length },
    "Starting TTS stream",
  );

  try {
    const audioStream = await elevenLabsClient.generate({
      voice: targetVoiceId,
      model_id: config.ELEVENLABS_MODEL_ID,
      text,
      stream: true,
    });

    for await (const chunk of audioStream as AsyncIterable<Buffer>) {
      const audioBase64 = chunk.toString("base64");
      await onAudioChunk(audioBase64);
    }

    logger.debug("TTS stream completed");
  } catch (err) {
    logger.error({ err }, "TTS stream failed");
    throw err;
  }
}

export async function textToSpeechBuffer(
  text: string,
  voiceId?: string,
): Promise<Buffer> {
  const targetVoiceId = voiceId ?? config.ELEVENLABS_VOICE_ID;

  logger.debug({ voiceId: targetVoiceId }, "Generating TTS buffer");

  const chunks: Buffer[] = [];

  const audioStream = await elevenLabsClient.generate({
    voice: targetVoiceId,
    model_id: config.ELEVENLABS_MODEL_ID,
    text,
    stream: true,
  });

  for await (const chunk of audioStream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}
