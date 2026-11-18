import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enrichToolInput, isExplicitYes } from "../agent";
import type { AgentContext, AgentMessage } from "../types";

const userId = "00000000-0000-4000-8000-000000000000";
let n = 0;
const ctx = (sessionId: string, messages: AgentMessage[]): AgentContext => ({ sessionId, userId, messages });
const confirmed = (c: AgentContext, tool: string, args: Record<string, unknown> = {}) =>
  enrichToolInput(c, tool, args).confirmed === true;

describe("confirmation gate (make_call, send_whatsapp)", () => {
  it("a first request containing 'yes' does not confirm", () => {
    const c = ctx(`s${n++}`, [{ role: "user", content: "Yes, I'm free tomorrow, call the dentist" }]);
    assert.equal(confirmed(c, "make_call"), false);
    // Model retrying inside the same turn still can't confirm.
    assert.equal(confirmed(c, "make_call"), false);
  });

  it("a question containing 'sure' after a card does not confirm", () => {
    const s = `s${n++}`;
    const h: AgentMessage[] = [{ role: "user", content: "call the dentist" }];
    assert.equal(confirmed(ctx(s, h), "make_call"), false);
    h.push({ role: "assistant", content: "Shall I call?" }, { role: "user", content: "Are you sure that number is right?" });
    assert.equal(confirmed(ctx(s, h), "make_call"), false);
  });

  it("a yes in the next turn after the card confirms once", () => {
    const s = `s${n++}`;
    const h: AgentMessage[] = [{ role: "user", content: "message mom I'm late" }];
    assert.equal(confirmed(ctx(s, h), "send_whatsapp"), false);
    h.push({ role: "assistant", content: "Send this?" }, { role: "user", content: "Yes, send the WhatsApp to Mom at +911234567890 confirmed" });
    assert.equal(confirmed(ctx(s, h), "send_whatsapp"), true);
    h.push({ role: "assistant", content: "Sent." }, { role: "user", content: "yes" });
    assert.equal(confirmed(ctx(s, h), "send_whatsapp"), false);
  });

  it("ignores a model-supplied confirmed=true", () => {
    const c = ctx(`s${n++}`, [{ role: "user", content: "text bob hi" }]);
    assert.equal(confirmed(c, "send_whatsapp", { confirmed: true }), false);
  });

  it("a yes for one tool does not confirm another", () => {
    const s = `s${n++}`;
    const h: AgentMessage[] = [{ role: "user", content: "call bob" }];
    confirmed(ctx(s, h), "make_call");
    h.push({ role: "assistant", content: "Call?" }, { role: "user", content: "yes" });
    assert.equal(confirmed(ctx(s, h), "send_whatsapp"), false);
  });

  it("isExplicitYes accepts short yeses, rejects the rest", () => {
    for (const t of ["yes", "Yeah, go ahead.", "haan kar do", "ok please", "Yes, go ahead and call Dr Rao at 5 PM"])
      assert.equal(isExplicitYes("make_call", t), true, t);
    for (const t of ["no", "don't do it", "are you sure?", "yes I'm free tomorrow call the dentist", ""])
      assert.equal(isExplicitYes("make_call", t), false, t);
  });
});
