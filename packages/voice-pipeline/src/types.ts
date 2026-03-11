export type TwilioStreamEvent =
  | { event: "connected"; protocol: string; version: string }
  | {
      event: "start";
      streamSid: string;
      start: {
        callSid: string;
        streamSid: string;
        accountSid: string;
        from: string;
        to: string;
      };
    }
  | {
      event: "media";
      streamSid: string;
      media: {
        track: string;
        chunk: string;
        timestamp: string;
        payload: string;
      };
    }
  | {
      event: "stop";
      streamSid: string;
      stop: { accountSid: string; callSid: string };
    };

export type PipelineSession = {
  sessionId: string;
  userId: string;
  callSid: string;
  streamSid: string;
  conversationId: string;
  fromNumber: string;
  toNumber: string;
  createdAt: string;
  lastActivityAt: string;
  status: "active" | "completed" | "expired";
};

export type TranscriptResult = {
  transcript: string;
  isFinal: boolean;
  confidence: number;
};

export type AudioChunk = {
  payload: string;
  track: string;
  timestamp: string;
};
