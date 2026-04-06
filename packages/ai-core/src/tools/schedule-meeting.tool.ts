import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
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
  timezone: z.string().optional().default("Asia/Kolkata"),
  agenda: z.string().optional(),
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
      { title: input.title, userId: input.userId },
      "Scheduling meeting via internal API",
    );

    try {
      const { config } = await import("@xtanbot/config");

      const start = new Date(input.startTime);
      const end = input.endTime
        ? new Date(input.endTime)
        : new Date(start.getTime() + 60 * 60 * 1000);

      const response = await fetch(`${config.API_URL}/meetings/internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Service": "ai-core",
        },
        body: JSON.stringify({
          userId: input.userId,
          title: input.title,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          attendees: input.attendees,
          description: input.description ?? null,
          location: input.location ?? null,
          timezone: input.timezone ?? "Asia/Kolkata",
          agenda: input.agenda ?? null,
        }),
      });

      if (!response.ok) {
        const err = (await response.json()) as { message?: string };
        return {
          success: false,
          message: err.message ?? "Failed to schedule meeting.",
        };
      }

      const meeting = (await response.json()) as {
        id: string;
        title: string;
        startTime: string;
      };

      const timeStr = new Date(meeting.startTime).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        success: true,
        meetingId: meeting.id,
        message:
          `Meeting "${meeting.title}" scheduled for ${timeStr} IST. ` +
          `I will call the attendees at the scheduled time.`,
      };
    } catch (err) {
      logger.error({ err }, "Failed to schedule meeting");
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
            description: "Optional meeting description",
          },
          location: {
            type: "string",
            description: "Optional meeting location or video call link",
          },
          timezone: {
            type: "string",
            description:
              "IANA timezone for the meeting; defaults to Asia/Kolkata if omitted",
          },
          agenda: {
            type: "string",
            description:
              "Questions or goals for the meeting call. What should the AI ask or achieve? e.g. 'Ask about project status, confirm deadline, check blockers'",
          },
        },
        required: ["title", "startTime", "attendees"],
      },
    };
  },
};
