import { anthropicClient } from "./client";
import { toolRouter } from "./tool-router";
import { buildChatSystemPrompt } from "./prompt-builder";
import { AgentError, type AgentErrorCategory } from "./errors";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import { counter } from "@xtanbot/observability";
import type Anthropic from "@anthropic-ai/sdk";
import type { AgentContext, AgentResponse, AgentMessage } from "./types";

const logger = createLogger("AgentKernel");

const toolCallsTotal = counter(
  "xtanbot_tool_calls_total",
  "Total number of tool invocations by Claude",
  ["tool_name"],
);

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

const SIMPLE_PATTERNS: RegExp[] = [
  /^(yes|no|yeah|nope|sure|okay|ok|correct|right|confirmed?)\.?$/i,
  /what(\s+is|\s*'s)?\s+the\s+time/i,
  /what\s+time\s+is\s+it/i,
  /cancel\s+(that|it|the\s+\w+)/i,
  /^(go\s+ahead|do\s+it|proceed|confirm(ed)?|sounds?\s+good)\.?$/i,
  /^(never\s+mind|forget\s+it|stop|don'?t)\.?$/i,
  /^(thank\s*you|thanks|cheers|great|perfect|awesome)\.?$/i,
];

function selectModel(messages: Anthropic.MessageParam[]): string {
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  if (!lastUserMessage) return config.ANTHROPIC_MODEL;

  const content =
    typeof lastUserMessage.content === "string"
      ? lastUserMessage.content
      : "";

  const isSimple = SIMPLE_PATTERNS.some((p) => p.test(content.trim()));
  return isSimple
    ? config.ANTHROPIC_HAIKU_MODEL
    : config.ANTHROPIC_MODEL;
}

const VOICE_MODEL = "claude-haiku-4-5-20251001" as const;
const VOICE_MAX_TOKENS = 150;

function truncateToSentences(text: string, maxSentences: number): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
  if (sentences.length <= maxSentences) return text;
  return sentences.slice(0, maxSentences).join(" ").trim();
}

function strFromCtx(
  v: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  if (!v) return fallback;
  const x = v[key];
  return typeof x === "string" && x.trim() !== "" ? x : fallback;
}

function buildVoiceSystemPrompt(ctx: AgentContext): string {
  const v = ctx.voiceContext ?? {};
  const userName =
    ctx.userProfile?.name ??
    strFromCtx(v, "userName", "the user");
  const meetingTitle = strFromCtx(v, "meetingTitle", "");
  const meetingTime = strFromCtx(v, "meetingTime", "");
  const contactName =
    strFromCtx(v, "contactName", strFromCtx(v, "attendeeName", "there"));
  const answeredBy = strFromCtx(v, "answeredBy", "");

  return `You are xTanBot, an AI voice assistant calling on behalf of ${userName}.
This is a PHONE CALL. Keep every response under 2 sentences. Be natural, not robotic.

Meeting context:
- Title: ${meetingTitle}
- Time: ${meetingTime}
- Contact: ${contactName}
- AnsweredBy (AMD): ${answeredBy || "unknown"}

Call script:
1. Open: "Hi, this is xTanBot calling on behalf of ${userName}. Am I speaking with ${contactName}?"
   - If not them: ask to speak with them, if unavailable say goodbye and stop.
2. Confirm: "I'm calling about ${meetingTitle}. Do you have 2 minutes?"
   - If no: "No problem, I'll let ${userName} know. Goodbye." then stop.
3. Ask (max 3 questions, one at a time):
   - "What's your current status on this?"
   - "Any blockers or decisions needed?"
   - "Do you need a follow-up?"
4. Confirm back: "So to confirm — [summarise their answers]. Is that right?"
5. Close: "Great, I'll pass this to ${userName}. Thanks, goodbye!"

If you detect voicemail (context.answeredBy contains 'machine'):
Say ONLY: "Hi, xTanBot calling for ${userName} re: ${meetingTitle}. Please call back. Thanks." then stop.

If they say do not contact: "Understood, you won't be contacted again. Goodbye." then stop.

Rules:
- Max 2 sentences per response
- Never promise anything on behalf of ${userName}
- If they ask a general question, answer briefly in one short sentence when you can, then steer back to the meeting
- Do not refuse reasonable clarifications (time, topic, who organized it)`.trim();
}

function buildSystemPromptForAgent(ctx: AgentContext): string {
  if (ctx.callSid) {
    return buildVoiceSystemPrompt(ctx);
  }
  return buildChatSystemPrompt(ctx);
}

function truncateForVoice(text: string): string {
  return truncateToSentences(text, 2);
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

/** Merge authenticated context into tool args so Claude never has to guess userId. */
function enrichToolInput(
  ctx: AgentContext,
  toolName: string,
  rawInput: unknown,
): Record<string, unknown> {
  const base =
    rawInput !== null &&
    typeof rawInput === "object" &&
    !Array.isArray(rawInput)
      ? { ...(rawInput as Record<string, unknown>) }
      : {};
  const tz = ctx.userProfile?.timezone ?? "Asia/Kolkata";
  const enriched: Record<string, unknown> = {
    ...base,
    userId: ctx.userId,
    userTimezone: tz,
  };
  if (toolName === "get_current_time") {
    if (enriched.timezone === undefined || enriched.timezone === "") {
      enriched.timezone = tz;
    }
  }
  if (toolName === "schedule_meeting") {
    if (enriched.timezone === undefined || enriched.timezone === "") {
      enriched.timezone = tz;
    }
  }
  return enriched;
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

  const isVoice = Boolean(ctx.callSid);
  const selectedModel = isVoice ? VOICE_MODEL : selectModel(ctx.messages);
  const maxTokens = isVoice ? VOICE_MAX_TOKENS : config.ANTHROPIC_MAX_TOKENS;

  logger.debug(
    {
      sessionId: ctx.sessionId,
      selectedModel,
      messageCount: ctx.messages.length,
      isVoice,
    },
    "Model selected for agent turn",
  );

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
          model: selectedModel,
          system: buildSystemPromptForAgent(ctx),
          ...(isVoice
            ? {}
            : {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                tools: toolRouter.getDefinitions() as any,
                tool_choice: { type: "auto" as const },
              }),
          messages,
          max_tokens: maxTokens,
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

      const truncatedText = isVoice
        ? truncateForVoice(text)
        : truncateToSentences(text, 3);

      if (truncatedText !== text) {
        logger.info(
          {
            sessionId: ctx.sessionId,
            originalLength: text.length,
            truncatedLength: truncatedText.length,
          },
          "Response truncated to sentence limit",
        );
      }

      logger.info(
        {
          sessionId: ctx.sessionId,
          isVoice,
          toolsUsed,
          iterations,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          replyPreview: truncatedText.slice(0, 240),
        },
        "Agent loop completed — model reply ready for TTS or chat",
      );

      return {
        text: truncatedText,
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
            const enrichedInput = enrichToolInput(ctx, block.name, block.input);
            const result = await toolRouter.dispatch(block.name, enrichedInput);
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

      try {
        for (const block of toolUseBlocks) {
          if (block.type === "tool_use") {
            toolCallsTotal.inc({ tool_name: block.name });
          }
        }
      } catch (err) {
        logger.error({ err }, "Failed to record tool_calls_total metric");
      }

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
