export class AgentError extends Error {
  override cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AgentError";
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
