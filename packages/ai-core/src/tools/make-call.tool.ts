import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("MakeCallTool");

const inputSchema = z.object({
  toNumber: z
    .string()
    .regex(
      /^\+[1-9]\d{1,14}$/,
      "Phone number must be in international format, e.g. +919876543210 or +12125551234",
    ),
  userId: z.string().uuid(),
  reason: z.string().optional(),
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
    logger.info({ toNumber: input.toNumber }, "Making call");

    // TODO Day 3: wire to callService via queue
    return {
      success: true,
      callId: `mock-call-${Date.now()}`,
      message: `Initiating call to ${input.toNumber}`,
    };
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
              "Phone number to call in E.164 format e.g. +1234567890",
          },
          reason: {
            type: "string",
            description: "Optional reason for the call",
          },
        },
        required: ["toNumber"],
      },
    };
  },
};
