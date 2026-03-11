import { createLogger } from "@xtanbot/logger";
import type { TwilioStreamEvent, AudioChunk } from "../types";

const logger = createLogger("TwilioStreamHandler");

export type StreamHandlerCallbacks = {
  onStart: (
    callSid: string,
    streamSid: string,
    from: string,
    to: string,
  ) => Promise<void>;
  onAudioChunk: (chunk: AudioChunk, streamSid: string) => Promise<void>;
  onStop: (callSid: string, streamSid: string) => Promise<void>;
};

export function createStreamHandler(callbacks: StreamHandlerCallbacks) {
  return async function handleMessage(rawMessage: string): Promise<void> {
    let event: TwilioStreamEvent;

    try {
      event = JSON.parse(rawMessage) as TwilioStreamEvent;
    } catch {
      logger.warn("Failed to parse Twilio stream message");
      return;
    }

    switch (event.event) {
      case "connected":
        logger.info({ protocol: event.protocol }, "Twilio stream connected");
        break;

      case "start":
        logger.info(
          {
            callSid: event.start.callSid,
            streamSid: event.streamSid,
          },
          "Twilio stream started",
        );
        await callbacks.onStart(
          event.start.callSid,
          event.streamSid,
          event.start.from,
          event.start.to,
        );
        break;

      case "media":
        await callbacks.onAudioChunk(
          {
            payload: event.media.payload,
            track: event.media.track,
            timestamp: event.media.timestamp,
          },
          event.streamSid,
        );
        break;

      case "stop":
        logger.info(
          {
            callSid: event.stop.callSid,
            streamSid: event.streamSid,
          },
          "Twilio stream stopped",
        );
        await callbacks.onStop(event.stop.callSid, event.streamSid);
        break;

      default:
        logger.debug({ event }, "Unknown Twilio stream event");
    }
  };
}

export function buildTwilioAudioMessage(
  streamSid: string,
  audioBase64: string,
): string {
  return JSON.stringify({
    event: "media",
    streamSid,
    media: {
      payload: audioBase64,
    },
  });
}

export function buildTwilioClearMessage(streamSid: string): string {
  return JSON.stringify({
    event: "clear",
    streamSid,
  });
}
