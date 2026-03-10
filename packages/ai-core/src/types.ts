export interface AgentContext {
  callId: string;
  sessionId: string;
  transcript: string[];
  metadata: Record<string, unknown>;
}

export interface AgentResult {
  response: string;
  toolsUsed: string[];
  finishReason: "stop" | "tool_use" | "max_tokens";
}

export interface LLMProvider {
  complete(params: LLMCompletionParams): Promise<LLMCompletionResult>;
  streamComplete(params: LLMCompletionParams): AsyncIterable<LLMStreamChunk>;
}

export interface LLMCompletionParams {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

export interface LLMCompletionResult {
  content: string;
  finishReason: string;
}

export interface LLMStreamChunk {
  delta: string;
  finishReason?: string;
}
