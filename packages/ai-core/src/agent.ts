import type { AgentContext, AgentResult } from "./types.js";

export async function runAgent(_context: AgentContext): Promise<AgentResult> {
  return {
    response: "",
    toolsUsed: [],
    finishReason: "stop",
  };
}
