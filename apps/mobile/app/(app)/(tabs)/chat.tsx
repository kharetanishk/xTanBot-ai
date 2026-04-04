import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../../src/stores/auth.store";
import { sendMessage } from "../../../src/api/conversations.api";
import type { Message } from "../../../src/types/api.types";

const SUGGESTED = [
  "Who are my contacts?",
  "Schedule a meeting",
  "What time is it?",
];

function TypingDots() {
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.3)).current;
  const a3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    const l1 = mk(a1, 0);
    const l2 = mk(a2, 150);
    const l3 = mk(a3, 300);
    l1.start();
    l2.start();
    l3.start();
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [a1, a2, a3]);

  return (
    <View style={styles.typingBubble}>
      <View style={styles.typingRow}>
        <Animated.Text style={[styles.typingDot, { opacity: a1 }]}>●</Animated.Text>
        <Animated.Text style={[styles.typingDot, { opacity: a2 }]}>●</Animated.Text>
        <Animated.Text style={[styles.typingDot, { opacity: a3 }]}>●</Animated.Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

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

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.role === "user";
      const isStreamingRow = item.id === "streaming";
      const showTyping =
        isStreamingRow && isStreaming && (!item.content || item.content === "");

      return (
        <View
          style={[
            styles.msgRow,
            isUser ? styles.msgRowRight : styles.msgRowLeft,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isUser ? styles.bubbleUser : styles.bubbleAi,
            ]}
          >
            {showTyping ? (
              <TypingDots />
            ) : (
              <Text style={isUser ? styles.textUser : styles.textAi}>
                {item.content}
                {isStreamingRow && isStreaming && item.content ? "▊" : ""}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.ts,
              isUser ? styles.tsRight : styles.tsLeft,
            ]}
          >
            {new Date(item.createdAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      );
    },
    [isStreaming],
  );

  const canSend = Boolean(inputText.trim()) && !isStreaming;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.headerBrand}>xTanBot AI</Text>
          <View style={styles.headerOnline}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineLabel}>Online</Text>
          </View>
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyBolt}>⚡</Text>
            <Text style={styles.emptyTitle}>xTanBot AI</Text>
            <Text style={styles.emptySub}>Ask me anything</Text>
            {SUGGESTED.map((text) => (
              <Pressable
                key={text}
                style={styles.chip}
                onPress={() => setInputText(text)}
              >
                <Text style={styles.chipText}>{text}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            inverted={false}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message xTanBot..."
            placeholderTextColor="#555"
            multiline
            maxLength={2000}
            editable={!isStreaming}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              !canSend && styles.sendBtnDisabled,
            ]}
          >
            <Text style={styles.sendArrow}>→</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 60,
    backgroundColor: "#111111",
    borderBottomWidth: 2,
    borderBottomColor: "#FBBF24",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBrand: {
    color: "#FBBF24",
    fontWeight: "900",
    fontSize: 18,
  },
  headerOnline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  onlineLabel: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 8,
  },
  msgRow: {
    marginBottom: 4,
    maxWidth: "100%",
  },
  msgRowRight: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  msgRowLeft: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "75%",
    padding: 12,
    marginBottom: 8,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  bubbleUser: {
    backgroundColor: "#FBBF24",
    alignSelf: "flex-end",
  },
  bubbleAi: {
    backgroundColor: "#ffffff",
    alignSelf: "flex-start",
  },
  textUser: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  textAi: {
    color: "#000",
    fontWeight: "500",
    fontSize: 15,
  },
  ts: {
    fontSize: 11,
    color: "#666",
    marginBottom: 4,
  },
  tsRight: {
    alignSelf: "flex-end",
  },
  tsLeft: {
    alignSelf: "flex-start",
  },
  typingBubble: {
    minHeight: 20,
    justifyContent: "center",
  },
  typingRow: {
    flexDirection: "row",
    gap: 6,
  },
  typingDot: {
    fontSize: 14,
    color: "#000",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyBolt: {
    fontSize: 48,
  },
  emptyTitle: {
    color: "#FBBF24",
    fontWeight: "900",
    fontSize: 24,
    marginTop: 12,
  },
  emptySub: {
    color: "#666",
    fontSize: 15,
    marginTop: 8,
  },
  chip: {
    marginTop: 8,
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "#333",
    padding: 10,
    alignSelf: "stretch",
    maxWidth: 320,
  },
  chipText: {
    color: "#FBBF24",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#111111",
    borderTopWidth: 2,
    borderTopColor: "#222222",
    padding: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "#333",
    borderRadius: 0,
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: "#FBBF24",
    borderWidth: 2,
    borderColor: "#000",
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowColor: "#000",
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: "#333",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendArrow: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000",
  },
});
