import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import { prisma } from "@xtanbot/db";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("ScheduleMeetingTool");

const inputSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  attendees: z.array(z.string().min(1)).min(1),
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
    "Schedule a new meeting with specified attendees at a given time. Use this when the user wants to create, book, or schedule a meeting or appointment. Gather title, start time, and attendees first; attendee values may be names or emails (resolve emails via lookup_contact when possible).",
  requiresConfirmation: false,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    logger.info(
      {
        title: input.title,
        startTime: input.startTime,
        userId: input.userId,
      },
      "Scheduling meeting in database",
    );

    try {
      const start = new Date(input.startTime);
      const end = input.endTime
        ? new Date(input.endTime)
        : new Date(start.getTime() + 60 * 60 * 1000);

      const meeting = await prisma.meeting.create({
        data: {
          userId: input.userId,
          title: input.title,
          startTime: start,
          endTime: end,
          attendees: input.attendees,
          description: input.description ?? null,
          location: input.location ?? null,
          timezone: input.timezone ?? "UTC",
          status: "scheduled",
        },
      });

      return {
        success: true,
        meetingId: meeting.id,
        message: `Meeting "${input.title}" scheduled for ${start.toLocaleString()} with ${input.attendees.join(", ")}. Meeting ID: ${meeting.id}`,
      };
    } catch (err) {
      logger.error({ err }, "Failed to create meeting");
      return {
        success: false,
        message: "Failed to schedule meeting. Please try again.",
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
              "Optional end time in ISO 8601. If omitted, defaults to one hour after start.",
          },
          attendees: {
            type: "array",
            items: { type: "string" },
            description:
              "Attendee names or email addresses. Use lookup_contact first to find emails/phones when needed.",
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
            description: "IANA timezone for the meeting; defaults to the user's timezone if omitted",
          },
        },
        required: ["title", "startTime", "attendees"],
      },
    };
  },
};
