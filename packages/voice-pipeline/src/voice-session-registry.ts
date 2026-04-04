import { createLogger } from "@xtanbot/logger";

const logger = createLogger("VoiceSessionRegistry");

type TtsHandler = (text: string) => Promise<void>;

const handlers = new Map<string, TtsHandler>();

export function registerVoiceTtsHandler(
  sessionId: string,
  handler: TtsHandler,
): void {
  handlers.set(sessionId, handler);
  logger.debug({ sessionId }, "Voice TTS handler registered");
}

export function unregisterVoiceTtsHandler(sessionId: string): void {
  handlers.delete(sessionId);
  logger.debug({ sessionId }, "Voice TTS handler unregistered");
}

/**
 * Called from API when agent.responded Redis event is received.
 */
export async function playAgentVoiceResponse(
  sessionId: string,
  text: string,
): Promise<void> {
  const fn = handlers.get(sessionId);
  if (!fn) {
    logger.warn(
      { sessionId },
      "No active voice TTS handler for session — agent response not played",
    );
    return;
  }
  try {
    logger.info(
      {
        sessionId,
        textLength: text.length,
        textPreview: text.slice(0, 120),
      },
      "Playing agent reply via voice TTS",
    );
    await fn(text);
  } catch (err) {
    logger.error({ err, sessionId }, "playAgentVoiceResponse failed");
  }
}
