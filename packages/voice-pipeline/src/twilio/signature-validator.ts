import twilio from "twilio";
import { config } from "@xtanbot/config";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("TwilioSignatureValidator");

export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const isValid = twilio.validateRequest(
    config.TWILIO_AUTH_TOKEN,
    signature,
    url,
    params,
  );

  if (!isValid) {
    logger.warn({ url }, "Invalid Twilio signature — request rejected");
  }

  return isValid;
}
