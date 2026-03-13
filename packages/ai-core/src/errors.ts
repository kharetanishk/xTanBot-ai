export type AgentErrorCategory =
  | "timeout"
  | "rate_limit"
  | "content_policy"
  | "network"
  | "iteration_limit"
  | "unknown";

export class AgentError extends Error {
  override cause?: unknown;
  category: AgentErrorCategory;

  constructor(
    message: string,
    category: AgentErrorCategory = "unknown",
    cause?: unknown,
  ) {
    super(message);
    this.name = "AgentError";
    this.category = category;
    this.cause = cause;
  }
}

export class ToolError extends Error {
  override cause?: unknown;

  constructor(
    message: string,
    public readonly toolName?: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ToolError";
    this.cause = cause;
  }
}

export class ContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextError";
  }
}
