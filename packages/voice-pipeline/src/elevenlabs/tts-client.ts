import { ElevenLabsClient } from "elevenlabs";
import { config } from "@xtanbot/config";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("TTSClient");

const elevenLabsClient = new ElevenLabsClient({
  apiKey: config.ELEVENLABS_API_KEY,
});

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

const MOOD_PRESETS = {
  friendly:     { stability: 0.5,  similarity_boost: 0.8,  style: 0.3, use_speaker_boost: true  },
  sales:        { stability: 0.4,  similarity_boost: 0.9,  style: 0.5, use_speaker_boost: true  },
  rude:         { stability: 0.3,  similarity_boost: 0.6,  style: 0.8, use_speaker_boost: false },
  intellectual: { stability: 0.8,  similarity_boost: 0.7,  style: 0.1, use_speaker_boost: true  },
  influencing:  { stability: 0.35, similarity_boost: 0.95, style: 0.6, use_speaker_boost: true  },
  custom:       { stability: 0.5,  similarity_boost: 0.75 },
  default:      { stability: 0.5,  similarity_boost: 0.75 },
} satisfies Record<string, VoiceSettings>;

export const MOOD_VOICE_SETTINGS: Readonly<typeof MOOD_PRESETS> = MOOD_PRESETS;

export function getVoiceSettingsForMood(mood?: string): VoiceSettings {
  if (!mood) return MOOD_PRESETS.default;
  const key = mood.toLowerCase() as keyof typeof MOOD_PRESETS;
  return MOOD_PRESETS[key] ?? MOOD_PRESETS.default;
}

export type AudioChunkCallback = (audioBase64: string) => Promise<void>;

export async function streamTextToSpeech(
  text: string,
  onAudioChunk: AudioChunkCallback,
  voiceId?: string,
  voiceSettings?: VoiceSettings,
): Promise<void> {
  const targetVoiceId = voiceId ?? config.ELEVENLABS_VOICE_ID;
  const settings = voiceSettings ?? MOOD_VOICE_SETTINGS.default;

  logger.debug(
    { voiceId: targetVoiceId, textLength: text.length, stability: settings.stability },
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
      voice_settings: settings,
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
  voiceSettings?: VoiceSettings,
): Promise<Buffer> {
  const targetVoiceId = voiceId ?? config.ELEVENLABS_VOICE_ID;
  const settings = voiceSettings ?? MOOD_VOICE_SETTINGS.default;

  logger.debug({ voiceId: targetVoiceId }, "Generating TTS buffer");

  const chunks: Buffer[] = [];

  const audioStream = await elevenLabsClient.generate({
    voice: targetVoiceId,
    model_id: config.ELEVENLABS_MODEL_ID,
    text,
    stream: true,
    output_format: "ulaw_8000",
    voice_settings: settings,
  });

  for await (const chunk of audioStream as AsyncIterable<Buffer | Uint8Array>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (buf.length > 0) chunks.push(buf);
  }

  return Buffer.concat(chunks);
}
