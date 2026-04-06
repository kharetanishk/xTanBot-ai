import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export type AgentMessage = Anthropic.MessageParam;

export type AgentContext = {
  readonly sessionId: string;
  readonly userId: string;
  readonly callSid?: string;
  readonly messages: AgentMessage[];
  /** Voice call: merged from Redis `session:context:${callSid}` + Twilio AnsweredBy */
  readonly voiceContext?: Record<string, unknown>;
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

export type ActionButton = {
  id: string;
  label: string;
  style: "primary" | "danger" | "secondary";
  /** When tapped, this text is sent as a message */
  autoMessage: string;
};

export type SearchResultCard = {
  title: string;
  snippet: string;
  phone?: string;
  address?: string;
  rating?: string;
  url?: string;
};

export type StructuredPayload = {
  type: "search_results" | "confirmation" | "whatsapp_sent" | "location" | "none";
  results?: SearchResultCard[];
  actions?: ActionButton[];
  confirmationData?: {
    toPhone: string;
    contactName: string;
    messagePreview: string;
    confirmMessage: string;
    cancelMessage: string;
  };
  locationData?: {
    city: string;
    state: string;
    googleMapsUrl: string;
    formatted: string;
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
  readonly structuredPayload?: StructuredPayload;
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
