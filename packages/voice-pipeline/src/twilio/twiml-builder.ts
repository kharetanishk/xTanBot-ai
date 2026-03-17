import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";

const logger = createLogger("TwiMLBuilder");

export function buildInboundCallTwiML(
  streamUrl: string,
  _context?: unknown,
): string {
  logger.debug({ streamUrl }, "Building inbound call TwiML");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="direction" value="inbound"/>
    </Stream>
  </Connect>
</Response>`.trim();
}

export function buildOutboundCallTwiML(streamUrl: string): string {
  logger.debug({ streamUrl }, "Building outbound call TwiML");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="direction" value="outbound"/>
    </Stream>
  </Connect>
</Response>`.trim();
}

export function buildHangupTwiML(message?: string): string {
  const say = message ? `<Say voice="Polly.Joanna">${message}</Say>` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say}
  <Hangup/>
</Response>`.trim();
}

export function getStreamWebSocketUrl(host: string): string {
  const wsProtocol = config.NODE_ENV === "production" ? "wss" : "wss";
  return `${wsProtocol}://${host}/twilio/stream`;
}
