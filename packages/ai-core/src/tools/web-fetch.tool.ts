import { z } from "zod";
import { createLogger } from "@xtanbot/logger";
import * as cheerio from "cheerio";
import type { ToolDefinition, ClaudeToolDef } from "../types";

const logger = createLogger("WebFetchTool");

const inputSchema = z.object({
  url: z.string().url(),
  selector: z.string().optional(),
});

type Input = z.infer<typeof inputSchema>;
type Output = {
  success: boolean;
  text: string;
  title: string;
  message: string;
};

export const webFetchTool: ToolDefinition<Input, Output> = {
  name: "web_fetch",
  description:
    "Fetch and extract text content from a URL. Use after web_search when you need to read " +
    "full details from a specific page like a doctor profile, article, or listing.",
  requiresConfirmation: false,

  inputSchema,

  async execute(input: Input): Promise<Output> {
    logger.info({ url: input.url }, "Web fetch executing");

    try {
      const res = await fetch(input.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; xTanBot/1.0)",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return {
          success: false,
          text: "",
          title: "",
          message: `Failed to fetch: ${res.status}`,
        };
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      $("script,style,nav,footer,header,iframe,noscript").remove();

      const title = $("title").text().trim();

      let text: string;
      if (input.selector) {
        text = $(input.selector).text();
      } else {
        // Try content-dense selectors before falling back to full body
        const contentSelectors = [
          "main",
          "article",
          ".content",
          ".doctor-info",
          ".profile",
          "[class*='doctor']",
          "[class*='profile']",
          "[class*='listing']",
          "section",
        ];

        let found = "";
        for (const sel of contentSelectors) {
          const el = $(sel).first().text().trim();
          if (el.length > 200) {
            found = el;
            break;
          }
        }
        text = found || $("body").text();
      }

      text = text.replace(/\s+/g, " ").trim().slice(0, 1500);

      return {
        success: true,
        text,
        title,
        message: `Fetched ${text.length} chars from ${input.url}`,
      };
    } catch (err) {
      logger.error({ err, url: input.url }, "Web fetch failed");
      return {
        success: false,
        text: "",
        title: "",
        message: "Failed to fetch the page.",
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
          url: {
            type: "string",
            description: "Full URL to fetch",
          },
          selector: {
            type: "string",
            description: "Optional CSS selector to extract specific content",
          },
        },
        required: ["url"],
      },
    };
  },
};
