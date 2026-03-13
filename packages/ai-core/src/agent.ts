import { anthropicClient } from "./client";
import { toolRouter } from "./tool-router";
import { buildSystemPrompt } from "./prompt-builder";
import { AgentError, type AgentErrorCategory } from "./errors";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import type Anthropic from "@anthropic-ai/sdk";
import type { AgentContext, AgentResponse, AgentMessage } from "./types";

const logger = createLogger("AgentKernel");

const MAX_TOOL_ITERATIONS = 10;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new AgentError(`${label} timed out after ${ms}ms`, "timeout")),
        ms,
      ),
    ),
  ]);
}

function categoriseApiError(err: unknown): AgentErrorCategory {
  if (!(err instanceof Error)) return "unknown";
  const msg = err.message.toLowerCase();
  if (msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (msg.includes("rate limit") || msg.includes("429")) return "rate_limit";
  if (msg.includes("content") && msg.includes("policy")) return "content_policy";
  if (
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed")
  ) return "network";
  return "unknown";
}

function extractTextFromResponse(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join(" ")
    .trim();
}

export async function runAgent(ctx: AgentContext): Promise<AgentResponse> {
  logger.info(
    { sessionId: ctx.sessionId, userId: ctx.userId },
    "Agent loop started",
  );

  const messages: AgentMessage[] = [...ctx.messages];
  const toolsUsed: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iterations = 0;

  while (true) {
    if (iterations >= MAX_TOOL_ITERATIONS) {
      throw new AgentError(
        `Agent exceeded maximum tool iterations (${MAX_TOOL_ITERATIONS}). Possible reasoning loop.`,
        "iteration_limit",
      );
    }
    iterations++;
    let response: Anthropic.Message;
    try {
      response = (await withTimeout(
        anthropicClient.messages.create({
          model: config.ANTHROPIC_MODEL,
          system: buildSystemPrompt(ctx),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: toolRouter.getDefinitions() as any,
          tool_choice: { type: "auto" },
          messages,
          max_tokens: config.ANTHROPIC_MAX_TOKENS,
        }),
        config.ANTHROPIC_TIMEOUT_MS,
        "LLM call",
      )) as Anthropic.Message;
    } catch (err) {
      if (err instanceof AgentError) throw err;
      throw new AgentError(
        err instanceof Error ? err.message : "Unknown API error",
        categoriseApiError(err),
        err,
      );
    }

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    if (response.stop_reason === "end_turn") {
      const text = extractTextFromResponse(
        response.content as Array<{ type: string; text?: string }>,
      );

      logger.info(
        {
          sessionId: ctx.sessionId,
          toolsUsed,
          iterations,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
        "Agent loop completed",
      );

      return {
        text,
        toolsUsed,
        stopReason: "end_turn",
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use",
      );

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.type !== "tool_use") return null;

          toolsUsed.push(block.name);
          logger.info({ toolName: block.name }, "Executing tool");

          try {
            const result = await toolRouter.dispatch(block.name, block.input);
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify(result),
            };
          } catch (err) {
            logger.error(
              { toolName: block.name, err },
              "Tool execution failed",
            );
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: JSON.stringify({
                error: err instanceof Error ? err.message : "Tool failed",
              }),
              is_error: true,
            };
          }
        }),
      );

      const validResults = toolResults.filter(Boolean);

      messages.push({
        role: "assistant",
        content: response.content,
      });

      messages.push({
        role: "user",
        content: validResults as AgentMessage["content"],
      });

      continue;
    }

    if (response.stop_reason === "max_tokens") {
      const text = extractTextFromResponse(
        response.content as Array<{ type: string; text?: string }>,
      );
      return {
        text,
        toolsUsed,
        stopReason: "max_tokens",
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };
    }

    throw new AgentError(`Unexpected stop_reason: ${response.stop_reason}`);
  }
}
