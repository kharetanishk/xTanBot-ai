import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import { prisma } from "@xtanbot/db";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("SendWhatsappTool");

const inputSchema = z.object({
  userId: z.string().uuid(),
  toPhone: z.string().optional(),
  contactName: z.string().optional(),
  message: z.string().min(1).max(4000),
  confirmed: z.boolean().optional().default(false),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  success: boolean;
  message: string;
  requiresConfirmation?: boolean;
  confirmationData?: {
    toPhone: string;
    contactName: string;
    messagePreview: string;
  };
  sent?: boolean;
};

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export const sendWhatsappTool: ToolDefinition<Input, Output> = {
  name: "send_whatsapp",
  description:
    "Send a WhatsApp message to a contact. ALWAYS ask for confirmation before sending. " +
    "Use when user wants to send wishes, information, location, lists, or any message via WhatsApp. " +
    "If only a name is given, look up the contact first to get their number.",
  requiresConfirmation: false,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    logger.info(
      {
        userId: input.userId,
        contactName: input.contactName,
        hasPhone: Boolean(input.toPhone),
      },
      "Send WhatsApp executing",
    );

    let resolvedPhone = input.toPhone ?? "";
    let resolvedName = input.contactName ?? "Unknown";

    if (!resolvedPhone && input.contactName) {
      const contact = await prisma.contact.findFirst({
        where: {
          userId: input.userId,
          name: {
            contains: input.contactName,
            mode: "insensitive",
          },
          deletedAt: null,
        },
      });

      if (!contact?.phone) {
        return {
          success: false,
          message:
            `Could not find a phone number for "${input.contactName}". ` +
            `Please provide the number directly.`,
        };
      }

      resolvedPhone = contact.phone;
      resolvedName = contact.name;
    }

    if (!resolvedPhone) {
      return {
        success: false,
        message: "Please provide a phone number or contact name to send the message.",
      };
    }

    if (!input.confirmed) {
      const preview =
        input.message.slice(0, 100) + (input.message.length > 100 ? "..." : "");
      return {
        success: true,
        requiresConfirmation: true,
        message:
          `Send this WhatsApp to ${resolvedName} (${resolvedPhone})?\n\n` + `"${preview}"`,
        confirmationData: {
          toPhone: resolvedPhone,
          contactName: resolvedName,
          messagePreview: preview,
        },
      };
    }

    if (!config.MSG91_AUTH_KEY) {
      return {
        success: false,
        message: "WhatsApp is not configured. MSG91 auth key missing.",
      };
    }

    try {
      const normalisedPhone = normalisePhone(resolvedPhone);

      const payload = {
        integrated_number: config.MSG91_INTEGRATED_NUMBER,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: config.MSG91_TEMPLATE_NAME,
            language: {
              code: "en",
              policy: "deterministic",
            },
            namespace: null as string | null,
            to_and_components: [
              {
                to: [normalisedPhone],
                components: {
                  body_1: {
                    type: "text",
                    value: input.message
                      .replace(/\n+/g, " ")
                      .replace(/\s{2,}/g, " ")
                      .trim(),
                  },
                },
              },
            ],
          },
        },
      };

      const res = await fetch(
        "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authkey: config.MSG91_AUTH_KEY,
          },
          body: JSON.stringify(payload),
        },
      );

      const responseData = (await res.json()) as {
        type?: string;
        message?: string;
      };

      if (!res.ok || responseData.type === "error") {
        logger.error({ responseData }, "MSG91 error");
        return {
          success: false,
          message: "Failed to send WhatsApp message. Please try again.",
        };
      }

      logger.info({ to: normalisedPhone, name: resolvedName }, "WhatsApp message sent");

      return {
        success: true,
        sent: true,
        message: `WhatsApp message sent to ${resolvedName} successfully! ✓`,
      };
    } catch (err) {
      logger.error({ err }, "WhatsApp send failed");
      return {
        success: false,
        message: "Failed to send WhatsApp. Please try again.",
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
          toPhone: {
            type: "string",
            description:
              "Phone number in E.164 format e.g. +919876543210. Optional if contactName is provided.",
          },
          contactName: {
            type: "string",
            description: "Contact name to look up. Used when phone not provided.",
          },
          message: {
            type: "string",
            description:
              "Full message content to send. MUST be a single paragraph with no line breaks (\\n). " +
              "Do not use \\n anywhere in the message — write everything as one continuous sentence or paragraph.",
          },
          confirmed: {
            type: "boolean",
            description:
              "Set true only after user confirms. Default false — always confirm first.",
          },
        },
        required: ["message"],
      },
    };
  },
};
