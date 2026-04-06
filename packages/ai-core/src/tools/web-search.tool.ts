import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("WebSearchTool");

const inputSchema = z.object({
  query: z.string().min(1).max(500),
  location: z.string().optional(),
  numResults: z.number().optional().default(5),
});

type Input = z.infer<typeof inputSchema>;

export type SearchResult = {
  title: string;
  snippet: string;
  url: string;
  phone?: string;
  address?: string;
  rating?: string;
};

type Output = {
  success: boolean;
  results: SearchResult[];
  message: string;
  query: string;
};

function extractPhone(text: string): string | undefined {
  const match = text.match(
    /(\+91[\s-]?\d{10}|0\d{10}|\b\d{10}\b|\+91-\d{5}-\d{5})/,
  );
  return match?.[0]?.replace(/[\s-]/g, "") ?? undefined;
}

export const webSearchTool: ToolDefinition<Input, Output> = {
  name: "web_search",
  description:
    "Search the web for any information. Use for finding doctors, businesses, services, news, " +
    "movie lists, restaurants, or any factual query. Always use this when user asks to find " +
    "something or search for something online.",
  requiresConfirmation: false,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    logger.info({ query: input.query }, "Web search executing");

    if (!config.SERPER_API_KEY) {
      return {
        success: false,
        results: [],
        message: "Web search is not configured.",
        query: input.query,
      };
    }

    try {
      const body: Record<string, unknown> = {
        q: input.query,
        num: Math.min(10, Math.max(1, input.numResults)),
        hl: "en",
        gl: "in",
      };

      if (input.location) {
        body.location = input.location;
      }

      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": config.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Serper API error: ${res.status}`);
      }

      const data = (await res.json()) as {
        organic?: Array<{
          title?: string;
          snippet?: string;
          link?: string;
        }>;
        knowledgeGraph?: {
          title?: string;
          description?: string;
          phone?: string;
          address?: string;
          rating?: string;
        };
        localResults?: Array<{
          title?: string;
          address?: string;
          phone?: string;
          rating?: number;
          snippet?: string;
        }>;
      };

      const cap = Math.min(10, Math.max(1, input.numResults));
      const results: SearchResult[] = [];

      if (data.localResults?.length) {
        for (const r of data.localResults.slice(0, cap)) {
          results.push({
            title: r.title ?? "",
            snippet: r.snippet ?? r.address ?? "",
            url: "",
            phone: r.phone ?? undefined,
            address: r.address ?? undefined,
            rating: r.rating != null ? String(r.rating) : undefined,
          });
        }
      }

      if (data.organic?.length && results.length < cap) {
        const needed = cap - results.length;
        for (const r of data.organic.slice(0, needed)) {
          const snippet = r.snippet ?? "";
          results.push({
            title: r.title ?? "",
            snippet,
            url: r.link ?? "",
            phone: extractPhone(snippet),
          });
        }
      }

      if (results.length === 0) {
        return {
          success: false,
          results: [],
          message: `No results found for: ${input.query}`,
          query: input.query,
        };
      }

      return {
        success: true,
        results,
        message: `Found ${results.length} results for: ${input.query}`,
        query: input.query,
      };
    } catch (err) {
      logger.error({ err }, "Web search failed");
      return {
        success: false,
        results: [],
        message: "Web search failed. Please retry.",
        query: input.query,
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
          query: {
            type: "string",
            description:
              "Search query. Be specific. Include location for local searches e.g. " +
              "'gastroenterologist Durg Chhattisgarh 8+ years experience'",
          },
          location: {
            type: "string",
            description: "Location context e.g. 'Durg, Chhattisgarh, India'",
          },
          numResults: {
            type: "number",
            description: "Number of results (default 5, max 10)",
          },
        },
        required: ["query"],
      },
    };
  },
};
