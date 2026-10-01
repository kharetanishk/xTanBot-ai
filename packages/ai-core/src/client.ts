import OpenAI from "openai";
import { config } from "@xtanbot/config";

// OpenRouter speaks the OpenAI chat-completions API, so any model it routes to
// (anthropic/*, openai/*, google/* …) works by changing OPENROUTER_MODEL.
export const llmClient = new OpenAI({
  apiKey: config.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: { "X-Title": "xTanBot" },
});
