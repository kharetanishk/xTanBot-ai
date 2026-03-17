import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import { prisma } from "@xtanbot/db";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("LookupContactTool");

const inputSchema = z.object({
  query: z.string().min(0).optional(),
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
    "Search for a contact by name, email, or phone number, or list contacts when the user asks about their contacts.",
  requiresConfirmation: false,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    const query = (input.query ?? "").trim();
    logger.info({ query, userId: input.userId }, "Looking up contact");

    // If no query, list recent contacts for this user
    if (!query) {
      const contacts = await prisma.contact.findMany({
        where: {
          userId: input.userId,
          deletedAt: null,
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      });

      if (contacts.length === 0) {
        return {
          found: false,
          contacts: [],
          message: "You have no contacts yet.",
        };
      }

      return {
        found: true,
        contacts: contacts.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email ?? undefined,
          phone: c.phone ?? undefined,
          company: c.company ?? undefined,
        })),
        message: `You have ${contacts.length} contact(s): ${contacts
          .map((c) => c.name)
          .join(", ")}`,
      };
    }

    // Search by name, email, phone, or company
    const contacts = await prisma.contact.findMany({
      where: {
        userId: input.userId,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query } },
          { company: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    if (contacts.length === 0) {
      return {
        found: false,
        contacts: [],
        message: `No contacts found matching "${query}"`,
      };
    }

    return {
      found: true,
      contacts: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email ?? undefined,
        phone: c.phone ?? undefined,
        company: c.company ?? undefined,
      })),
      message: `Found ${contacts.length} contact(s): ${contacts
        .map((c) => c.name)
        .join(", ")}`,
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
            description:
              "Name, email, company, or phone number to search for. If omitted or empty, list recent contacts.",
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

