import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("GetCurrentTimeTool");

const inputSchema = z.object({
  timezone: z.string().optional().default("UTC"),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  currentTime: string;
  timezone: string;
  timestamp: number;
};

export const getCurrentTimeTool: ToolDefinition<Input, Output> = {
  name: "get_current_time",
  description:
    "Get the current date and time in a specified timezone. Use this when the user asks about the current time or when you need to know the current time to schedule something.",
  requiresConfirmation: false,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    logger.debug({ timezone: input.timezone }, "Getting current time");

    const now = new Date();
    const currentTime = now.toLocaleString("en-US", {
      timeZone: input.timezone,
      dateStyle: "full",
      timeStyle: "long",
    });

    return {
      currentTime,
      timezone: input.timezone,
      timestamp: now.getTime(),
    };
  },

  toClaudeToolDefinition(): ClaudeToolDef {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description:
              "IANA timezone name e.g. America/New_York, Asia/Kolkata",
          },
        },
        required: [],
      },
    };
  },
};
