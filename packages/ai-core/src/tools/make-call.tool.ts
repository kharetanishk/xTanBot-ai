import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("MakeCallTool");

const callContextSchema = z.object({
  calleeName: z.string().optional(),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  userName: z.string().optional(),
  purpose: z.string().optional(),
});

const inputSchema = z.object({
  toNumber: z
    .string()
    .regex(
      /^\+[1-9]\d{1,14}$/,
      "Phone number must be in international format, e.g. +919876543210 or +12125551234",
    ),
  userId: z.string().uuid(),
  reason: z.string().optional(),
  confirmed: z.boolean().optional(),
  callContext: callContextSchema.optional(),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  success: boolean;
  callId?: string;
  message: string;
};

export const makeCallInputSchema = inputSchema;

export const makeCallTool: ToolDefinition<Input, Output> = {
  name: "make_call",
  description:
    "Initiate a phone call to a specified number on behalf of the user. Use this when the user explicitly asks to call someone or a phone number.",
  requiresConfirmation: true,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    logger.info(
      { toNumber: input.toNumber, userId: input.userId, hasContext: !!input.callContext },
      "Making real call via API",
    );

    try {
      const { config } = await import("@xtanbot/config");
      const streamBaseUrl = config.API_URL;

      // 1. Create the call first so we get the real Twilio callSid.
      const response = await fetch(`${streamBaseUrl}/calls/internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Service": "ai-core",
        },
        body: JSON.stringify({
          toNumber: input.toNumber,
          userId: input.userId,
          reason: input.reason,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { message?: string };
        logger.error({ status: response.status, err }, "Internal call endpoint failed");
        return {
          success: false,
          message: err.message ?? `Failed to initiate call (HTTP ${response.status}).`,
        };
      }

      const call = (await response.json()) as { id: string; callSid: string };

      // 2. Store call context keyed by callSid so the pipeline reads it on onStart.
      //    Done AFTER the call exists so twilio/voice route preserves it (not overwrites).
      if (call.callSid) {
        const { redisConnection } = await import("@xtanbot/redis");

        const purposeLower = (input.callContext?.purpose ?? input.reason ?? "").toLowerCase();
        const hasAppointmentHint =
          purposeLower.includes("appointment") ||
          purposeLower.includes("booking") ||
          (!!input.callContext?.appointmentDate && !!input.callContext?.appointmentTime);
        const callType = hasAppointmentHint ? "appointment" : "general-call";

        const ctx = JSON.stringify({
          ...(input.callContext ?? {}),
          callType,
          purpose: input.callContext?.purpose ?? input.reason ?? "",
          userId: input.userId,
          createdAt: new Date().toISOString(),
        });

        await redisConnection.set(`call-context:${call.callSid}`, ctx, "EX", 3600);
        await redisConnection.set(`session:context:${call.callSid}`, ctx, "EX", 3600);
        logger.info({ callSid: call.callSid, callType }, "Call context stored at callSid key");
      }

      return {
        success: true,
        callId: call.id,
        message: `Call initiated to ${input.toNumber}. Call ID: ${call.id}`,
      };
    } catch (err) {
      logger.error({ err }, "make_call failed");
      return {
        success: false,
        message: "Failed to place call. Please try again.",
      };
    }
  },

  toClaudeToolDefinition(): ClaudeToolDef {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          toNumber: {
            type: "string",
            description:
              "Phone number in E.164 format e.g. +919876543210",
          },
          reason: {
            type: "string",
            description: "Reason for the call e.g. 'book appointment'",
          },
          callContext: {
            type: "object",
            description:
              "Context for the AI voice agent to use during the call. Include who is being called, why, and any appointment details.",
            properties: {
              calleeName: {
                type: "string",
                description: "Name of the person or clinic being called",
              },
              appointmentDate: {
                type: "string",
                description: "Requested date e.g. 'tomorrow', 'April 8th'",
              },
              appointmentTime: {
                type: "string",
                description: "Requested time e.g. '8 PM', '10 AM'",
              },
              userName: {
                type: "string",
                description: "Name of the user on whose behalf the call is made",
              },
              purpose: {
                type: "string",
                description:
                  "Full purpose e.g. 'Book appointment for gastro consultation'",
              },
            },
          },
        },
        required: ["toNumber"],
      },
    };
  },
};
