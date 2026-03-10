export interface AudioStreamHandler {
  handleStream(stream: AsyncIterable<Buffer>): AsyncIterable<Buffer>;
}

export interface WebhookValidator {
  validate(payload: unknown, signature: string): boolean;
}

export interface TTSProvider {
  streamSynthesize(text: string, voiceId: string): AsyncIterable<Buffer>;
}

export interface STTProvider {
  streamTranscribe(audio: AsyncIterable<Buffer>): AsyncIterable<TranscriptResult>;
}

export interface TranscriptResult {
  text: string;
  isFinal: boolean;
  confidence: number;
}
