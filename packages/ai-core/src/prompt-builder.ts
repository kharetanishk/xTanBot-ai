import { renderVoiceAgentSystemPrompt } from "./prompts/system/voice-agent.v1";
import type { AgentContext } from "./types";

/** Non-voice (e.g. text chat) system prompt — unchanged legacy behavior */
export function buildChatSystemPrompt(ctx: AgentContext): string {
  return renderVoiceAgentSystemPrompt(ctx);
}

export function buildSystemPrompt(ctx: AgentContext): string {
  return buildChatSystemPrompt(ctx);
}
