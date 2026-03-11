import { anthropicClient } from "./client";
import { toolRouter } from "./tool-router";
import { buildSystemPrompt } from "./prompt-builder";
import { AgentError } from "./errors";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import type { AgentContext, AgentResponse, AgentMessage } from "./types";

const logger = createLogger("AgentKernel");

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

  while (true) {
    const response = await anthropicClient.messages.create({
      model: config.ANTHROPIC_MODEL,
      system: buildSystemPrompt(ctx),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: toolRouter.getDefinitions() as any,
      messages,
      max_tokens: 1024,
    });

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
