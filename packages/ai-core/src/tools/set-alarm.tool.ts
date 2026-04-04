import { z } from "zod";
import { prisma } from "@xtanbot/db";
import { createLogger } from "@xtanbot/logger";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("SetAlarmTool");

const inputSchema = z.object({
  userId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  label: z.string().optional().default("Wake up alarm"),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  success: boolean;
  alarmId?: string;
  message: string;
  scheduledAt?: string;
};

export const setAlarmTool: ToolDefinition<Input, Output> = {
  name: "set_alarm",
  description:
    "Set an alarm for the user. At the scheduled time, the AI will call the user and speak a wake-up message repeatedly until they acknowledge it. Use when the user asks to set an alarm, wake up call, or reminder call.",
  requiresConfirmation: false,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    logger.info(
      { userId: input.userId, scheduledAt: input.scheduledAt },
      "Setting alarm",
    );

    try {
      const scheduledAt = new Date(input.scheduledAt);

      if (scheduledAt <= new Date()) {
        return {
          success: false,
          message: "Alarm time must be in the future.",
        };
      }

      const alarm = await prisma.alarm.create({
        data: {
          userId: input.userId,
          label: input.label ?? "Wake up alarm",
          scheduledAt,
          status: "scheduled",
        },
      });

      const timeStr = scheduledAt.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      });

      return {
        success: true,
        alarmId: alarm.id,
        message: `Alarm set for ${timeStr} IST. I'll call you to wake you up!`,
        scheduledAt: alarm.scheduledAt.toISOString(),
      };
    } catch (err) {
      logger.error({ err }, "Failed to set alarm");
      return {
        success: false,
        message: "Failed to set alarm. Please try again.",
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
          scheduledAt: {
            type: "string",
            description:
              "ISO 8601 datetime for alarm e.g. 2026-04-06T07:00:00+05:30",
          },
          label: {
            type: "string",
            description: "Optional alarm label e.g. 'Morning alarm'",
          },
        },
        required: ["scheduledAt"],
      },
    };
  },
};
