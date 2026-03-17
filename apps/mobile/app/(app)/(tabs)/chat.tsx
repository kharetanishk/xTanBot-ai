import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuthStore } from "../../../src/stores/auth.store";
import { sendMessage } from "../../../src/api/conversations.api";
import MessageBubble from "../../../src/components/chat/MessageBubble";
import TypingIndicator from "../../../src/components/chat/TypingIndicator";
import SuggestedPrompt from "../../../src/components/chat/SuggestedPrompt";
import type { Message } from "../../../src/types/api.types";

const SUGGESTED = [
  "Schedule a meeting tomorrow at 2pm",
  "Who are my contacts at Acme Corp?",
  "Show my upcoming meetings",
  "Call John Smith",
];

export default function ChatScreen() {
  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    const content = inputText.trim();
    if (!content || isStreaming) return;
    if (!token) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      conversationId: conversationId ?? "",
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsStreaming(true);

    const streamingMessage: Message = {
      id: "streaming",
      conversationId: conversationId ?? "",
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, streamingMessage]);

    const onChunk = (chunk: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === "streaming"
            ? { ...m, content: (m.content ?? "") + chunk }
            : m,
        ),
      );
    };
    const onDone = () => {
      setIsStreaming(false);
      setMessages((prev) => {
        const streaming = prev.find((m) => m.id === "streaming");
        if (!streaming) return prev;
        const finalMessage: Message = {
          ...streaming,
          id: `assistant-${Date.now()}`,
        };
        return prev.map((m) => (m.id === "streaming" ? finalMessage : m));
      });
    };

    await sendMessage(token, conversationId, content, onChunk, (newId) => {
      onDone();
      if (newId) setConversationId(newId);
    });
  }, [inputText, isStreaming, token, conversationId]);

  const handleSuggested = (text: string) => {
    setInputText(text);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>xTanBot AI</Text>
        <Text style={styles.headerSubtitle}>
          Ask me anything — schedule meetings, find contacts
        </Text>
        <View style={styles.onlineRow}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>

      {messages.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.promptsWrap}>
            {SUGGESTED.map((text) => (
              <SuggestedPrompt
                key={text}
                text={text}
                onPress={() => handleSuggested(text)}
              />
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={[...messages].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isStreaming={item.id === "streaming"}
            />
          )}
          ListFooterComponent={isStreaming ? <TypingIndicator /> : null}
          inverted
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#6b7280"
          multiline
          maxLength={2000}
          editable={!isStreaming}
        />
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || isStreaming}
          style={[
            styles.sendButton,
            (!inputText.trim() || isStreaming) && styles.sendDisabled,
          ]}
        >
          <Text style={styles.sendText}>→</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingTop: 56,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#222",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  onlineText: {
    fontSize: 12,
    color: "#22c55e",
    fontWeight: "700",
  },
  empty: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  promptsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: 24,
    backgroundColor: "#0a0a0a",
    borderTopWidth: 2,
    borderTopColor: "#222",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#FBBF24",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000",
  },
});
