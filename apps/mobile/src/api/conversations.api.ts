import { API_BASE_URL } from "../constants/config";
import type { Conversation, Message, StructuredPayload } from "../types/api.types";

export async function getConversation(callId: string): Promise<Conversation> {
  const { apiClient } = await import("./client");
  const { data } = await apiClient.get<Conversation>(`/conversations/${callId}`);
  return data;
}

export type ChatSummary = { id: string; title: string; createdAt: string };

export async function listChats(): Promise<ChatSummary[]> {
  const { apiClient } = await import("./client");
  const { data } = await apiClient.get<ChatSummary[]>("/conversations");
  return data;
}

export async function getChatMessages(id: string): Promise<Message[]> {
  const { apiClient } = await import("./client");
  const { data } = await apiClient.get<Message[]>(`/conversations/chat/${id}`);
  return data;
}

export type StreamHandlers = {
  /** Next chunk of the assistant's reply text. */
  onChunk: (text: string) => void;
  /** The agent started a tool (web_search, make_call, …). */
  onTool?: (name: string) => void;
  /** Stream finished; `message` is the full saved reply. */
  onDone: (
    conversationId: string,
    payload?: StructuredPayload | null,
    message?: string,
  ) => void;
};

/**
 * POST a chat message and consume the Server-Sent Events reply.
 * Uses XMLHttpRequest (not fetch): React Native's fetch can't read a body incrementally,
 * but XHR progress events deliver partial responseText on iOS, Android and web alike.
 */
export function sendMessage(
  token: string,
  conversationId: string | null,
  content: string,
  { onChunk, onTool, onDone }: StreamHandlers,
): Promise<void> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? API_BASE_URL;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let seen = 0;
    let buffer = "";

    const handle = (event: string, data: string) => {
      const json = JSON.parse(data) as {
        text?: string;
        name?: string;
        conversationId?: string;
        message?: string;
        structuredPayload?: StructuredPayload | null;
      };
      if (event === "delta" && json.text) onChunk(json.text);
      else if (event === "tool" && json.name) onTool?.(json.name);
      else if (event === "done") onDone(json.conversationId ?? "", json.structuredPayload, json.message);
    };

    // Parse whatever new text arrived into complete "event:/data:" blocks.
    const consume = () => {
      buffer += xhr.responseText.slice(seen);
      seen = xhr.responseText.length;
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (data) handle(event, data);
      }
    };

    xhr.open("POST", `${apiUrl}/conversations/message`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "text/event-stream");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.onprogress = consume;
    xhr.onload = () => {
      if (xhr.status >= 400) return reject(new Error(`HTTP ${xhr.status}`));
      consume();
      resolve();
    };
    xhr.onerror = () => reject(new Error("Network error — is the API reachable?"));
    xhr.send(JSON.stringify({ conversationId, content }));
  });
}
