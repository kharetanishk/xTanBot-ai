import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSentenceChunker } from "../sentence-chunker";

function chunk(tokens: string[]): string[] {
  const out: string[] = [];
  const c = createSentenceChunker((s) => out.push(s));
  for (const t of tokens) c.push(t);
  c.flush();
  return out;
}

describe("createSentenceChunker", () => {
  it("splits on . ? ! followed by whitespace", () => {
    assert.deepEqual(chunk(["Sure, let", " me check. Is", " it today? Yes it", " is! Done here."]), [
      "Sure, let me check.",
      "Is it today?",
      "Yes it is!",
      "Done here.",
    ]);
  });

  it("does not split abbreviations or initials", () => {
    assert.deepEqual(chunk(["Call Dr. Smith and Mr. J. Doe, e.g. today. Then rest."]), [
      "Call Dr. Smith and Mr. J. Doe, e.g. today.",
      "Then rest.",
    ]);
  });

  it("does not split numbers, even across tokens", () => {
    assert.deepEqual(chunk(["It costs 3.", "5 dollars now. Ok", " then."]), [
      "It costs 3.5 dollars now.",
      "Ok then.",
    ]);
  });

  it("merges fragments shorter than two words, except the final one", () => {
    assert.deepEqual(chunk(["Sure. Let me check. ", "Okay."]), ["Sure. Let me check.", "Okay."]);
    assert.deepEqual(chunk(["No trailing punctuation"]), ["No trailing punctuation"]);
    assert.deepEqual(chunk(["  "]), []);
  });
});
