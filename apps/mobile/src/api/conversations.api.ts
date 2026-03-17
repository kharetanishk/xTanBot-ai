import { API_BASE_URL } from "../constants/config";
import type { Conversation } from "../types/api.types";

export async function getConversation(callId: string): Promise<Conversation> {
  const { apiClient } = await import("./client");
  const { data } = await apiClient.get<Conversation>(`/conversations/${callId}`);
  return data;
}

export async function sendMessage(
  token: string,
  conversationId: string | null,
  content: string,
  onChunk: (text: string) => void,
  onDone: (conversationId: string) => void,
): Promise<void> {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? API_BASE_URL;

  const response = await fetch(`${apiUrl}/conversations/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ conversationId, content }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = (await response.json()) as { conversationId?: string; message?: string };
  if (data.message) onChunk(data.message);
  onDone(data.conversationId ?? "");
}
