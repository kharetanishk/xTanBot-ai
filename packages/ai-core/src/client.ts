import Anthropic from "@anthropic-ai/sdk";
import { config } from "@xtanbot/config";

// Private — never export this. Use runAgent() instead.
export const anthropicClient = new Anthropic({
  apiKey: config.ANTHROPIC_API_KEY,
});
