// Splits a streamed LLM reply into speakable sentences for TTS.
// A boundary is . ? ! (plus closing quotes/brackets) followed by whitespace, so
// "3.5" never splits and a trailing "." waits for the next token to decide.
const BOUNDARY = /[.?!]+["')\]]*(?=\s)/g;
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "no", "approx", "mt", "ft", "inc", "ltd", "co",
]);
const MIN_WORDS = 2;

function nextCut(buf: string): number {
  BOUNDARY.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOUNDARY.exec(buf))) {
    const end = m.index + m[0].length;
    const head = buf.slice(0, end).trim();
    if (m[0].startsWith(".")) {
      const word = /(\S+?)[.?!"')\]]*$/.exec(head)?.[1]?.toLowerCase() ?? "";
      // "Dr.", "e.g.", "U.S.", initials like "J."
      if (ABBREVIATIONS.has(word) || word.includes(".") || /^[a-z]$/.test(word)) continue;
    }
    if (head.split(/\s+/).length < MIN_WORDS) continue;
    return end;
  }
  return -1;
}

export function createSentenceChunker(onSentence: (sentence: string) => void) {
  let buf = "";
  return {
    push(delta: string): void {
      buf += delta;
      let cut: number;
      while ((cut = nextCut(buf)) > 0) {
        onSentence(buf.slice(0, cut).trim());
        buf = buf.slice(cut);
      }
    },
    /** End of stream: whatever is left goes out, however short. */
    flush(): void {
      const rest = buf.trim();
      buf = "";
      if (rest) onSentence(rest);
    },
  };
}
