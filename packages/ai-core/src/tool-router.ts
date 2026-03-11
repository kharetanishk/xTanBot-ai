import { createLogger } from "@xtanbot/logger";
import { ToolError } from "./errors";
import { allTools } from "./tools";
import type { ToolDefinition, ClaudeToolDef } from "./types";

const logger = createLogger("ToolRouter");

class ToolRouter {
  private readonly registry = new Map<string, ToolDefinition>();

  constructor(tools: ToolDefinition[]) {
    for (const tool of tools) {
      this.registry.set(tool.name, tool);
    }
    logger.info({ toolCount: this.registry.size }, "Tool router initialized");
  }

  async dispatch(name: string, args: unknown): Promise<unknown> {
    const tool = this.registry.get(name);
    if (!tool) {
      throw new ToolError(`Unknown tool: ${name}`, name);
    }

    const validated = tool.inputSchema.parse(args);
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
