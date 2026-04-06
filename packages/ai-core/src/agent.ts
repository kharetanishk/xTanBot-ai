import { anthropicClient } from "./client";
import { toolRouter } from "./tool-router";
import { buildChatSystemPrompt } from "./prompt-builder";
import { AgentError, type AgentErrorCategory } from "./errors";
import { createLogger } from "@xtanbot/logger";
import { config } from "@xtanbot/config";
import { counter } from "@xtanbot/observability";
import type Anthropic from "@anthropic-ai/sdk";
import type {
  AgentContext,
  AgentResponse,
  AgentMessage,
  StructuredPayload,
  ActionButton,
  SearchResultCard,
} from "./types";
import type { SearchResult } from "./tools/web-search.tool";

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

  // Appointment booking context (injected by make_call tool via Redis)
  const calleeName = strFromCtx(v, "calleeName", contactName);
  const appointmentDate = strFromCtx(v, "appointmentDate", "as soon as possible");
  const appointmentTime = strFromCtx(v, "appointmentTime", "a convenient time");
  const callPurpose = strFromCtx(v, "purpose", "");
  const agenda = strFromCtx(v, "agenda", "");
  const callType = strFromCtx(v, "callType", "");
  const isAppointmentCall =
    callPurpose.toLowerCase().includes("appointment") ||
    callPurpose.toLowerCase().includes("booking");
  const isStoryCall = callType === "story-call";
  const story = strFromCtx(v, "story", "");
  const mood = strFromCtx(v, "mood", "friendly");
  const objective = strFromCtx(v, "objective", "");
  const customMoodDescription = strFromCtx(v, "customMoodDescription", "");

  if (isAppointmentCall) {
    return `You are xTanBot, an AI assistant calling on behalf of ${userName}.

THIS IS AN APPOINTMENT BOOKING CALL.
You are calling: ${calleeName}
Requested date: ${appointmentDate}
Requested time: ${appointmentTime}
Purpose: ${callPurpose}

CALL SCRIPT — follow this exactly:
1. "Hello, I am xTanBot calling on behalf of ${userName} to book an appointment."
2. "I would like to book an appointment for ${appointmentDate} at ${appointmentTime}. Is that slot available?"
3. IF available:
   "Wonderful! I would like to confirm an appointment for ${userName}. Can you please give me a confirmation number or any details?"
   → Thank them and end the call.
4. IF NOT available:
   "I understand. Could you please tell me what slots are available on ${appointmentDate} or the nearest available date?"
   → Collect ALL available slots.
   → "Thank you, I will pass this information to ${userName}. Goodbye."

RULES:
- Maximum 2 sentences per response
- Be polite and professional
- If they ask who you are: "I am an AI assistant calling on behalf of ${userName}"
- If they cannot help: thank them and hang up
- NEVER make up appointment confirmations`.trim();
  }

  if (isStoryCall && story) {
    const moodInstructions: Record<string, string> = {
      friendly:
        "Speak warmly and conversationally. Be genuinely helpful and positive. Use casual language. Build rapport before making your ask.",
      sales:
        "Be persuasive and confident. Focus on benefits, not features. Create urgency. Address every objection with a benefit. Always be moving toward a yes.",
      rude:
        "Be direct, blunt, and impatient. Skip pleasantries. Get immediately to the point. Do not tolerate time wasting. Speak with sharp authority.",
      intellectual:
        "Speak formally and analytically. Use precise vocabulary. Reference data, logic, and structured reasoning. Acknowledge nuance and complexity.",
      influencing:
        "Be inspiring and visionary. Paint a compelling picture of what is possible. Use emotional and aspirational language. Make them feel this matters deeply.",
      custom: customMoodDescription || "Speak naturally and professionally.",
    };

    return `You are xTanBot conducting a call on behalf of ${userName}.

CALL STORY AND CONTEXT:
${story}

OBJECTIVE:
${objective || "Follow the story and achieve the best possible outcome."}

YOUR SPEAKING MOOD: ${mood.toUpperCase()}
${moodInstructions[mood] ?? moodInstructions.friendly}

RULES:
- Stay completely in character for the entire call
- Follow the story context exactly — do not deviate
- Maximum 2 sentences per response
- Never break character or reveal you are AI unless directly asked
- If asked whether you are an AI: "Yes, I am an AI assistant calling on behalf of ${userName}"
- If asked who ${userName} is: provide context from the story
- When the objective is achieved or the conversation naturally concludes, thank them and end the call professionally`.trim();
  }

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
3. ${agenda
    ? `Ask the following agenda items one at a time (record each answer before moving on):
${agenda.split(",").map((q, i) => `   ${i + 1}. "${q.trim()}"`).join("\n")}`
    : `Ask (max 3 questions, one at a time):
   - "What's your current status on this?"
   - "Any blockers or decisions needed?"
   - "Do you need a follow-up?"`
  }
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

/** Confirmation intent patterns (covers English and common Hindi shorthand). */
const CONFIRM_PATTERNS = [
  /\byes\b/i,
  /\bgo\s+ahead\b/i,
  /\bconfirm(ed)?\b/i,
  /\bdo\s+it\b/i,
  /\bproceed\b/i,
  /\bcall\s+them\b/i,
  /\byes,?\s*call\b/i,
  /\bplace\s+the\s+call\b/i,
  /\byes,?\s*place\b/i,
  /\bbook\s+it\b/i,
  /\bhaan\b/i,
  /\bkar\s+do\b/i,
  /\bsure\b/i,
  /\bsounds?\s+good\b/i,
];

function lastUserText(ctx: AgentContext): string {
  const lastUser = [...ctx.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "";
  return typeof lastUser.content === "string" ? lastUser.content.toLowerCase() : "";
}

function userConfirmed(ctx: AgentContext): boolean {
  const text = lastUserText(ctx);
  return CONFIRM_PATTERNS.some((p) => p.test(text));
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
  // Inject confirmed=true for any tool that requiresConfirmation when the user has
  // already agreed in natural language.
  if (toolName === "send_whatsapp") {
    const text = lastUserText(ctx);
    if (/yes,?\s*send\s+the\s+whatsapp/i.test(text) && /confirmed/i.test(text)) {
      enriched.confirmed = true;
    } else if (userConfirmed(ctx)) {
      enriched.confirmed = true;
    }
  }
  if (toolName === "make_call" && userConfirmed(ctx)) {
    enriched.confirmed = true;
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
  let structuredPayload: StructuredPayload = { type: "none" };

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
        structuredPayload,
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
            const result = await toolRouter.dispatch(
              block.name,
              enrichedInput,
              !!(enrichedInput as Record<string, unknown>).confirmed,
            );

            try {
              const toolResult = result as Record<string, unknown>;

              if (
                block.name === "web_search" &&
                toolResult.success === true &&
                Array.isArray(toolResult.results)
              ) {
                const searchResults = toolResult.results as SearchResult[];
                const cards: SearchResultCard[] = searchResults.map((r) => ({
                  title: r.title,
                  snippet: r.snippet,
                  phone: r.phone,
                  address: r.address,
                  rating: r.rating,
                  url: r.url,
                }));

                const actions: ActionButton[] = [];
                searchResults.slice(0, 3).forEach((r, i) => {
                  if (r.phone) {
                    actions.push({
                      id: `call-${i}`,
                      label: `📞 Call ${r.title.slice(0, 25)}`,
                      style: "primary",
                      autoMessage:
                        `Yes, call ${r.phone} to book an appointment with ${r.title}`,
                    });
                  }
                  // Always show an "info" button for each result
                  actions.push({
                    id: `info-${i}`,
                    label: `ℹ️ ${r.title.slice(0, 20)}`,
                    style: "secondary",
                    autoMessage:
                      `Tell me more about ${r.title} and how to book an appointment`,
                  });
                });

                structuredPayload = {
                  type: "search_results",
                  results: cards,
                  actions: actions.slice(0, 6),
                };
              }

              if (block.name === "send_whatsapp") {
                if (toolResult.requiresConfirmation === true && toolResult.confirmationData) {
                  const cd = toolResult.confirmationData as {
                    toPhone: string;
                    contactName: string;
                    messagePreview: string;
                  };
                  structuredPayload = {
                    type: "confirmation",
                    actions: [
                      {
                        id: "confirm-send",
                        label: "✓ Yes, Send",
                        style: "primary",
                        autoMessage:
                          `Yes, send the WhatsApp to ${cd.contactName} at ${cd.toPhone} confirmed`,
                      },
                      {
                        id: "cancel-send",
                        label: "✗ Cancel",
                        style: "danger",
                        autoMessage: "No, cancel the WhatsApp",
                      },
                    ],
                    confirmationData: {
                      toPhone: cd.toPhone,
                      contactName: cd.contactName,
                      messagePreview: cd.messagePreview,
                      confirmMessage:
                        `Yes, send the WhatsApp to ${cd.contactName} at ${cd.toPhone} confirmed`,
                      cancelMessage: "No, cancel the WhatsApp",
                    },
                  };
                } else if (toolResult.sent === true) {
                  structuredPayload = {
                    type: "whatsapp_sent",
                  };
                }
              }

              if (block.name === "make_call") {
                if (toolResult.requiresConfirmation === true) {
                  const inp = block.input as {
                    toNumber?: string;
                    reason?: string;
                    callContext?: { calleeName?: string; appointmentDate?: string; appointmentTime?: string };
                  };
                  const callee = inp.callContext?.calleeName ?? inp.toNumber ?? "them";
                  const dateStr = inp.callContext?.appointmentDate ? ` on ${inp.callContext.appointmentDate}` : "";
                  const timeStr = inp.callContext?.appointmentTime ? ` at ${inp.callContext.appointmentTime}` : "";
                  structuredPayload = {
                    type: "confirmation",
                    actions: [
                      {
                        id: "confirm-call",
                        label: "📞 Yes, Call",
                        style: "primary",
                        autoMessage: `Yes, go ahead and call ${callee}${dateStr}${timeStr}`,
                      },
                      {
                        id: "cancel-call",
                        label: "✗ Cancel",
                        style: "danger",
                        autoMessage: "No, cancel the call",
                      },
                    ],
                    confirmationData: {
                      toPhone: inp.toNumber ?? "",
                      contactName: callee,
                      messagePreview: `${inp.reason ?? "Call"}${dateStr}${timeStr}`,
                      confirmMessage: `Yes, go ahead and call ${callee}${dateStr}${timeStr}`,
                      cancelMessage: "No, cancel the call",
                    },
                  };
                } else if (
                  (toolResult as { success?: boolean }).success === true
                ) {
                  structuredPayload = { type: "none" };
                }
              }

              if (block.name === "get_location") {
                const loc = toolResult as {
                  city: string;
                  state: string;
                  googleMapsUrl: string;
                  formatted: string;
                };
                if (loc.city && loc.state && loc.googleMapsUrl && loc.formatted) {
                  structuredPayload = {
                    type: "location",
                    locationData: {
                      city: loc.city,
                      state: loc.state,
                      googleMapsUrl: loc.googleMapsUrl,
                      formatted: loc.formatted,
                    },
                    actions: [
                      {
                        id: "send-location",
                        label: "📍 Send My Location",
                        style: "primary",
                        autoMessage: `Send my location (${loc.formatted}) via WhatsApp`,
                      },
                    ],
                  };
                }
              }
            } catch (payloadErr) {
              logger.warn({ payloadErr }, "Failed to capture structured payload");
            }

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
        structuredPayload,
      };
    }

    throw new AgentError(`Unexpected stop_reason: ${response.stop_reason}`);
  }
}
