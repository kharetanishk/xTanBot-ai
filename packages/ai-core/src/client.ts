import OpenAI, { type ClientOptions } from "openai";
import { config } from "@xtanbot/config";
import { vertexToken } from "./vertex-token";

// Vertex AI and OpenRouter both speak the OpenAI chat-completions API, so the rest of the code
// doesn't know which one it talks to. Vertex (Gemini, billed to the Google Cloud project) wins when set.
// Exported as options too, so ESM apps (the voice agent) can build their own OpenAI instance from them.
export const llmClientOptions: ClientOptions = config.VERTEX_PROJECT
  ? {
      apiKey: vertexToken,
      baseURL: `https://aiplatform.googleapis.com/v1/projects/${config.VERTEX_PROJECT}/locations/global/endpoints/openapi`,
    }
  : {
      apiKey: config.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "X-Title": "xTanBot" },
      // Ask OpenRouter for the lowest-latency provider of the chosen model.
      fetch: (url, init) => {
        if (typeof init?.body === "string") {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          body.provider = { sort: "latency" };
          init = { ...init, body: JSON.stringify(body) };
        }
        return fetch(url, init);
      },
    };

export const llmClient = new OpenAI(llmClientOptions);
