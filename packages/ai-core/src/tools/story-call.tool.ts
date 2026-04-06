import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import { prisma } from "@xtanbot/db";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("StoryCallTool");

export type CallMood =
  | "friendly"
  | "sales"
  | "rude"
  | "intellectual"
  | "influencing"
  | "custom";

const inputSchema = z.object({
  userId: z.string().uuid(),
  toNumber: z.string().optional(),
  contactName: z.string().optional(),
  story: z.string().min(10).max(3000),
  mood: z
    .enum(["friendly", "sales", "rude", "intellectual", "influencing", "custom"])
    .default("friendly"),
  customMoodDescription: z.string().optional(),
  calleeName: z.string().optional(),
  objective: z.string().optional(),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  success: boolean;
  callId?: string;
  message: string;
};

export const storyCallTool: ToolDefinition<Input, Output> = {
  name: "story_call",
  description:
    "Make a phone call with a specific story context and mood/tone. Use when the user wants to call someone for sales, persuasion, pitching, or any scripted conversation. The AI will conduct the entire call following the story and speaking in the specified mood.",
  requiresConfirmation: true,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    logger.info(
      { userId: input.userId, mood: input.mood, hasStory: !!input.story },
      "Story call executing",
    );

    // Resolve phone number — look up contact if only a name was given
    let resolvedPhone = input.toNumber ?? "";
    let resolvedName = input.contactName ?? input.calleeName ?? "Contact";

    if (!resolvedPhone && input.contactName) {
      const contact = await prisma.contact.findFirst({
        where: {
          userId: input.userId,
          name: { contains: input.contactName, mode: "insensitive" },
          deletedAt: null,
        },
      });

      if (!contact?.phone) {
        return {
          success: false,
          message: `Could not find a phone number for "${input.contactName}". Please provide the number directly.`,
        };
      }
      resolvedPhone = contact.phone;
      resolvedName = contact.name;
    }

    if (!resolvedPhone) {
      return {
        success: false,
        message: "Please provide a phone number or a contact name to look up.",
      };
    }

    // Store story context in Redis so the voice pipeline picks it up when the call connects
    const { redisConnection } = await import("@xtanbot/redis");
    const normalised = resolvedPhone.replace(/^\+/, "");
    const contextKey = `call:context:pending:${normalised}`;

    await redisConnection.set(
      contextKey,
      JSON.stringify({
        userId: input.userId,
        callType: "story-call",
        calleeName: resolvedName,
        story: input.story,
        mood: input.mood,
        customMoodDescription: input.customMoodDescription ?? null,
        objective: input.objective ?? "Complete the story objective",
        createdAt: new Date().toISOString(),
      }),
      "EX",
      300,
    );

    logger.info({ contextKey, mood: input.mood }, "Story call context stored in Redis");

    // Trigger the call via the internal API endpoint
    try {
      const response = await fetch(`${config.API_URL}/calls/internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Service": "ai-core",
        },
        body: JSON.stringify({
          toNumber: resolvedPhone,
          userId: input.userId,
          reason: `Story call: ${input.mood}`,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { message?: string };
        return {
          success: false,
          message: err.message ?? `Failed to initiate story call (HTTP ${response.status}).`,
        };
      }

      const call = (await response.json()) as { id: string };

      const moodEmoji: Record<string, string> = {
        friendly: "😊",
        sales: "💼",
        rude: "😤",
        intellectual: "🎓",
        influencing: "🎯",
        custom: "⚡",
      };

      return {
        success: true,
        callId: call.id,
        message:
          `${moodEmoji[input.mood] ?? "📞"} Story call initiated to ${resolvedName} ` +
          `in **${input.mood}** mode. I will follow your story and speak accordingly.`,
      };
    } catch (err) {
      logger.error({ err }, "Story call failed");
      return {
        success: false,
        message: "Failed to place the story call. Please try again.",
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
              "Phone number in E.164 format e.g. +919876543210. Optional if contactName is provided.",
          },
          contactName: {
            type: "string",
            description:
              "Contact name to look up when no number is given. Will resolve to phone from contacts.",
          },
          story: {
            type: "string",
            description:
              "The full story, script, or context for the call. What to say, sell, or achieve. Be as detailed as possible — this drives the entire conversation.",
          },
          mood: {
            type: "string",
            enum: ["friendly", "sales", "rude", "intellectual", "influencing", "custom"],
            description:
              "Tone and speaking style for the call. " +
              "friendly=warm and conversational, " +
              "sales=persuasive and closing-focused, " +
              "rude=direct and blunt, " +
              "intellectual=formal and analytical, " +
              "influencing=inspiring and visionary, " +
              "custom=use customMoodDescription to define the style.",
          },
          customMoodDescription: {
            type: "string",
            description:
              "Only used when mood=custom. Describe exactly how the AI should speak and behave.",
          },
          objective: {
            type: "string",
            description:
              "The main goal to achieve by the end of the call. e.g. 'Get them to agree to a product demo'.",
          },
          calleeName: {
            type: "string",
            description: "Name of the person being called, for the greeting.",
          },
        },
        required: ["story"],
      },
    };
  },
};
