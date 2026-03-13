import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("LookupContactTool");

const inputSchema = z.object({
  query: z.string().min(1),
  userId: z.string().uuid(),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  found: boolean;
  contacts: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
  }>;
  message: string;
};

export const lookupContactTool: ToolDefinition<Input, Output> = {
  name: "lookup_contact",
  description:
    "Search for a contact by name, email, or phone number. Use this when the user refers to a person by name or asks to find someone's contact information.",
  requiresConfirmation: false,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    logger.info({ query: input.query }, "Looking up contact");

    // TODO Day 3: wire to contactRepository
    return {
      found: false,
      contacts: [],
      message: `No contacts found matching "${input.query}"`,
    };
  },

  toClaudeToolDefinition(): ClaudeToolDef {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Name, email, or phone number to search for",
          },
          userId: {
            type: "string",
            description: "The ID of the user whose contacts to search",
          },
        },
        required: ["query", "userId"],
      },
    };
  },
};
