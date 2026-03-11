import { renderVoiceAgentSystemPrompt } from "./prompts/system/voice-agent.v1";
import type { AgentContext } from "./types";

export function buildSystemPrompt(ctx: AgentContext): string {
  return renderVoiceAgentSystemPrompt(ctx);
}
