import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export type AgentMessage = Anthropic.MessageParam;

export type AgentContext = {
  readonly sessionId: string;
  readonly userId: string;
  readonly callSid?: string;
  readonly messages: AgentMessage[];
  readonly userProfile?: {
    name: string;
    timezone: string;
    phone?: string;
  };
  readonly callMetadata?: {
    toNumber: string;
    fromNumber: string;
    startedAt: string;
  };
};

export type AgentResponse = {
  readonly text: string;
  readonly toolsUsed: string[];
  readonly stopReason: "end_turn" | "max_tokens" | "tool_use";
  readonly usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

export type ConfirmationRequired = {
  requiresConfirmation: true;
  toolName: string;
  message: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  requiresConfirmation: boolean;
  inputSchema: z.ZodTypeAny;
  execute: (input: TInput) => Promise<TOutput>;
  toClaudeToolDefinition(): ClaudeToolDef;
}

export type ClaudeToolDef = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
};
