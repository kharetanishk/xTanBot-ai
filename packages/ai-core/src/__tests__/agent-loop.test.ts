import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type OpenAI from "openai";
import { llmClient } from "../client";
import { runAgent } from "../agent";

type Params = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

function completion(message: Partial<OpenAI.Chat.Completions.ChatCompletionMessage>, finish: string) {
  return {
    choices: [{ index: 0, finish_reason: finish, message: { role: "assistant", content: null, ...message } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  };
}

describe("runAgent (OpenRouter tool loop)", () => {
  it("executes a tool call, feeds the result back, returns the final text", async () => {
    const requests: Params[] = [];
    // Stub the network call; everything else (tool router, enrichment, payloads) runs for real.
    (llmClient.chat.completions as unknown as { create: (p: Params) => unknown }).create = async (p) => {
      requests.push(structuredClone(p));
      return requests.length === 1
        ? completion(
            {
              tool_calls: [
                { id: "call_1", type: "function", function: { name: "get_current_time", arguments: "{}" } },
              ],
            },
            "tool_calls",
          )
        : completion({ content: "It is 10 AM." }, "stop");
    };

    const res = await runAgent({
      sessionId: "s1",
      userId: "00000000-0000-4000-8000-000000000000",
      messages: [{ role: "user", content: "what time is it" }],
      userProfile: { name: "Test", timezone: "Asia/Kolkata" },
    });

    assert.equal(res.text, "It is 10 AM.");
    assert.deepEqual(res.toolsUsed, ["get_current_time"]);
    assert.equal(res.usage.inputTokens, 20);
    assert.equal(requests[0]?.messages[0]?.role, "system");
    assert.ok(requests[0]?.tools?.some((t) => t.type === "function" && t.function.name === "get_current_time"));

    const second = requests[1]!.messages;
    const assistant = second.at(-2) as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
    const toolMsg = second.at(-1) as OpenAI.Chat.Completions.ChatCompletionToolMessageParam;
    assert.equal(assistant.tool_calls?.[0]?.id, "call_1");
    assert.equal(toolMsg.role, "tool");
    assert.equal(toolMsg.tool_call_id, "call_1");
    assert.match(String(toolMsg.content), /time|Asia\/Kolkata/i);
  });

  it("streams tokens across a tool call and returns exactly what was streamed", async () => {
    let call = 0;
    const turns = [
      { deltas: ["Let me ", "check."], message: { content: "Let me check.", tool_calls: [
          { id: "call_1", type: "function", function: { name: "get_current_time", arguments: "{}" } },
        ] }, finish: "tool_calls" },
      { deltas: ["It is ", "10 AM."], message: { content: "It is 10 AM." }, finish: "stop" },
    ];
    // Stub the SDK stream helper: emits content.delta events, then resolves the final completion.
    (llmClient.chat.completions as unknown as { stream: unknown }).stream = () => {
      const turn = turns[call++]!;
      let onDelta: (e: { delta: string }) => void = () => {};
      return {
        on(_event: string, cb: (e: { delta: string }) => void) {
          onDelta = cb;
          return this;
        },
        async finalChatCompletion() {
          for (const d of turn.deltas) onDelta({ delta: d });
          return completion(turn.message as never, turn.finish);
        },
      };
    };

    const chunks: string[] = [];
    const tools: string[] = [];
    const res = await runAgent(
      {
        sessionId: "s2",
        userId: "00000000-0000-4000-8000-000000000000",
        messages: [{ role: "user", content: "what time is it" }],
        userProfile: { name: "Test", timezone: "Asia/Kolkata" },
      },
      { onText: (d) => chunks.push(d), onTool: (n) => tools.push(n) },
    );

    assert.equal(chunks.join(""), "Let me check.\n\nIt is 10 AM.");
    assert.equal(res.text, "Let me check.\n\nIt is 10 AM.");
    assert.deepEqual(tools, ["get_current_time"]);
  });
});
