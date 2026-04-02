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
      // Twilio Media Streams expect 8kHz μ-law (PCMU); default MP3/PCM breaks playback / may reset the WS.
      output_format: "ulaw_8000",
    });

    // Fetch/Web Streams yield Uint8Array; `Uint8Array#toString("base64")` does NOT base64-encode (Twilio 31951).
    for await (const chunk of audioStream as AsyncIterable<Buffer | Uint8Array>) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (buf.length === 0) continue;
      await onAudioChunk(buf.toString("base64"));
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
    output_format: "ulaw_8000",
  });

  for await (const chunk of audioStream as AsyncIterable<Buffer | Uint8Array>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (buf.length > 0) chunks.push(buf);
  }

  return Buffer.concat(chunks);
}
