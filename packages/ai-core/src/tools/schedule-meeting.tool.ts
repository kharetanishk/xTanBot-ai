import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("ScheduleMeetingTool");

const inputSchema = z.object({
  title: z.string().min(1).max(200),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  attendees: z.array(z.string().email()).min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional().default("UTC"),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  success: boolean;
  meetingId?: string;
  message: string;
};

export const scheduleMeetingTool: ToolDefinition<Input, Output> = {
  name: "schedule_meeting",
  description:
    "Schedule a new meeting with specified attendees at a given time. Use this when the user wants to create, book, or schedule a meeting or appointment.",
  requiresConfirmation: true,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    logger.info(
      { title: input.title, startTime: input.startTime },
      "Scheduling meeting",
    );

    // TODO Day 3: wire to meetingRepository via service layer
    // For now returns a mock response to validate the tool pipeline
    return {
      success: true,
      meetingId: `mock-${Date.now()}`,
      message: `Meeting "${input.title}" scheduled for ${input.startTime} with ${input.attendees.join(", ")}`,
    };
  },

  toClaudeToolDefinition(): ClaudeToolDef {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the meeting",
          },
          startTime: {
            type: "string",
            description:
              "Start time in ISO 8601 format e.g. 2024-01-15T10:00:00Z",
          },
          endTime: {
            type: "string",
            description:
              "End time in ISO 8601 format e.g. 2024-01-15T11:00:00Z",
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description: "List of attendee email addresses",
          },
          description: {
            type: "string",
            description: "Optional meeting description or agenda",
          },
          location: {
            type: "string",
            description: "Optional meeting location or video call link",
          },
          timezone: {
            type: "string",
            description: "Timezone for the meeting e.g. America/New_York",
          },
        },
        required: ["title", "startTime", "endTime", "attendees"],
      },
    };
  },
};
