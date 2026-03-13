import { ZodError } from "zod";
import { createLogger } from "@xtanbot/logger";
import { ToolError } from "./errors";
import { allTools } from "./tools";
import type { ToolDefinition, ClaudeToolDef, ConfirmationRequired } from "./types";

const logger = createLogger("ToolRouter");

class ToolRouter {
  private readonly registry = new Map<string, ToolDefinition>();

  constructor(tools: ToolDefinition[]) {
    for (const tool of tools) {
      this.registry.set(tool.name, tool);
    }
    logger.info({ toolCount: this.registry.size }, "Tool router initialized");
  }

  async dispatch(name: string, args: unknown, confirmed = false): Promise<unknown> {
    const tool = this.registry.get(name);
    if (!tool) {
      throw new ToolError(`Unknown tool: ${name}`, name);
    }

    if (tool.requiresConfirmation && !confirmed) {
      logger.info(
        { toolName: name },
        "Tool requires confirmation — returning confirmation request",
      );
      return {
        requiresConfirmation: true,
        toolName: name,
        message: `This will ${tool.description}. Please confirm before I proceed.`,
      } satisfies ConfirmationRequired;
    }

    let validated: unknown;
    try {
      validated = tool.inputSchema.parse(args);
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => e.message).join("; ");
        logger.warn(
          { toolName: name, zodErrors: err.errors },
          "Tool input validation failed",
        );
        return {
          error: true,
          message: `Invalid input for ${name}: ${messages}`,
        };
      }
      throw err;
    }
    logger.debug({ toolName: name }, "Tool dispatched");

    const result = await tool.execute(validated);
    logger.debug({ toolName: name }, "Tool execution completed");

    return result;
  }

  getDefinitions(): ClaudeToolDef[] {
    return [...this.registry.values()].map((t) => t.toClaudeToolDefinition());
  }

  hasTools(): boolean {
    return this.registry.size > 0;
  }
}

export const toolRouter = new ToolRouter(allTools);
