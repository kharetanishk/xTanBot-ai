import { callRepository, userRepository } from "@xtanbot/db";
import { emit } from "@xtanbot/events";
import { createLogger } from "@xtanbot/logger";
import { config, PHONE_CALLS_PAUSED_MESSAGE } from "@xtanbot/config";
import { histogram } from "@xtanbot/observability";
import twilio from "twilio";
import type { CreateCall } from "@xtanbot/zod-schemas";

const logger = createLogger("CallService");

const callDurationSeconds = histogram(
  "xtanbot_call_duration_seconds",
  "Duration of Twilio calls in seconds",
  [5, 10, 30, 60, 120, 300, 600, 1800],
);

const twilioClient = twilio(
  config.TWILIO_ACCOUNT_SID,
  config.TWILIO_AUTH_TOKEN,
);

export const callService = {
  async initiateCall(data: CreateCall & { streamBaseUrl: string }) {
    if (!config.PHONE_CALLS_ENABLED) {
      throw Object.assign(new Error(PHONE_CALLS_PAUSED_MESSAGE), { statusCode: 503 });
    }

    logger.info(
      { toNumber: data.toNumber, userId: data.userId },
      "Initiating call",
    );

    const call = await twilioClient.calls.create({
      to: data.toNumber,
      from: config.TWILIO_PHONE_NUMBER,
      url: `${data.streamBaseUrl}/twilio/voice`,
      // Only to/from/url/statusCallback: Twilio trial accounts reject extra parameters
      // (statusCallbackMethod, twiml, …) with "Invalid or disallowed parameters". POST is the default.
      statusCallback: `${data.streamBaseUrl}/twilio/status`,
    });

    const dbCall = await callRepository.create({
      userId: data.userId,
      toNumber: data.toNumber,
      fromNumber: config.TWILIO_PHONE_NUMBER,
      callSid: call.sid,
    });

    await emit.callStarted({
      callId: dbCall.id,
      userId: data.userId,
      callSid: call.sid,
      toNumber: data.toNumber,
      fromNumber: config.TWILIO_PHONE_NUMBER,
      timestamp: new Date().toISOString(),
    });

    logger.info({ callSid: call.sid, callId: dbCall.id }, "Call initiated");
    return dbCall;
  },

  async getCall(id: string) {
    return callRepository.findById(id);
  },

  async getUserCalls(userId: string) {
    return callRepository.findByUserId(userId);
  },

  async updateCallStatus(callSid: string, status: string, duration?: number) {
    const result = await callRepository.updateByCallSid(callSid, {
      status: status as never,
      ...(duration !== undefined && { duration }),
      ...(status === "completed" && { endedAt: new Date() }),
    });

    try {
      if (duration !== undefined) {
        callDurationSeconds.observe(duration);
      }
    } catch (err) {
      logger.error({ err }, "Failed to record call_duration_seconds metric");
    }

    return result;
  },
} as const;
