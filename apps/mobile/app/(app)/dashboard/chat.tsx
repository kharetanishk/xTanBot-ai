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
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../../src/stores/auth.store";
import { sendMessage } from "../../../src/api/conversations.api";
import type { Message, StructuredPayload } from "../../../src/types/api.types";

const SUGGESTED = [
  "Find a gastroenterologist near me",
  "Send birthday wish to a contact",
  "Schedule a meeting with agenda",
  "Set an alarm for 7 AM tomorrow",
  "Search top 10 movies of 2025",
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
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState(prefill ?? "");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  // When navigated here with a prefill (e.g. from Story Call), populate the input once
  useEffect(() => {
    if (prefill) setInputText(prefill);
  }, [prefill]);

  const submitMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming || !token) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        conversationId: conversationId ?? "",
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
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

      const onDone = (newId: string, payload?: StructuredPayload | null) => {
        setIsStreaming(false);
        setMessages((prev) => {
          const streaming = prev.find((m) => m.id === "streaming");
          if (!streaming) return prev;
          const finalMessage: Message = {
            ...streaming,
            id: `assistant-${Date.now()}`,
            structuredPayload: payload ?? null,
          };
          return prev.map((m) => (m.id === "streaming" ? finalMessage : m));
        });
        if (newId) setConversationId(newId);
      };

      await sendMessage(token, conversationId, trimmed, onChunk, onDone);
    },
    [isStreaming, token, conversationId],
  );

  const handleSend = useCallback(() => {
    const c = inputText.trim();
    if (!c) return;
    setInputText("");
    void submitMessage(c);
  }, [inputText, submitMessage]);

  const handleActionPress = useCallback(
    (autoMessage: string) => {
      void submitMessage(autoMessage);
    },
    [submitMessage],
  );

  function renderStructuredPayload(payload: StructuredPayload) {
    if (payload.type === "none") return null;

    return (
      <View style={styles.payloadContainer}>
        {payload.type === "search_results" && payload.results && (
          <View>
            {payload.results.map((r, i) => (
              <View key={`r-${i}`} style={styles.resultCard}>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {r.title}
                </Text>
                {r.rating ? (
                  <Text style={styles.resultRating}>⭐ {r.rating}</Text>
                ) : null}
                {r.address ? (
                  <Text style={styles.resultMeta}>📍 {r.address}</Text>
                ) : null}
                {r.phone ? (
                  <Text style={styles.resultPhone}>📞 {r.phone}</Text>
                ) : null}
                {r.snippet ? (
                  <Text style={styles.resultSnippet} numberOfLines={2}>
                    {r.snippet}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {payload.type === "confirmation" && payload.confirmationData && (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>CONFIRM ACTION</Text>
            <Text style={styles.confirmTo}>
              To: {payload.confirmationData.contactName} (
              {payload.confirmationData.toPhone})
            </Text>
            <Text style={styles.confirmPreview}>
              {`"${payload.confirmationData.messagePreview}"`}
            </Text>
          </View>
        )}

        {payload.type === "location" && payload.locationData && (
          <View style={styles.locationCard}>
            <Text style={styles.locationText}>
              📍 {payload.locationData.formatted}
            </Text>
          </View>
        )}

        {payload.type === "whatsapp_sent" && (
          <View style={styles.sentCard}>
            <Text style={styles.sentText}>✓ WhatsApp Sent Successfully</Text>
          </View>
        )}

        {payload.actions && payload.actions.length > 0 && (
          <View style={styles.actionsRow}>
            {payload.actions.map((action) => (
              <Pressable
                key={action.id}
                style={[
                  styles.actionBtn,
                  action.style === "primary" && styles.actionBtnPrimary,
                  action.style === "danger" && styles.actionBtnDanger,
                  action.style === "secondary" && styles.actionBtnSecondary,
                ]}
                onPress={() => handleActionPress(action.autoMessage)}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    action.style === "primary" && styles.actionBtnTextPrimary,
                    action.style === "danger" && styles.actionBtnTextDanger,
                    action.style === "secondary" && styles.actionBtnTextSecondary,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  }

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
              <>
                <Text style={isUser ? styles.textUser : styles.textAi}>
                  {item.content}
                  {isStreamingRow && isStreaming && item.content ? "▊" : ""}
                </Text>
                {!isUser &&
                  item.structuredPayload &&
                  item.structuredPayload.type !== "none" &&
                  renderStructuredPayload(item.structuredPayload)}
              </>
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
    [isStreaming, handleActionPress],
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
  payloadContainer: {
    marginTop: 8,
    maxWidth: 300,
  },
  resultCard: {
    backgroundColor: "#f9f9f9",
    borderWidth: 2,
    borderColor: "#000",
    padding: 10,
    marginBottom: 8,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowColor: "#000",
    elevation: 2,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#000",
    marginBottom: 4,
  },
  resultRating: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  resultMeta: {
    fontSize: 11,
    color: "#666",
    marginBottom: 2,
  },
  resultPhone: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6366f1",
    marginBottom: 2,
  },
  resultSnippet: {
    fontSize: 11,
    color: "#888",
    lineHeight: 15,
  },
  confirmCard: {
    backgroundColor: "#fff9e6",
    borderWidth: 2,
    borderColor: "#FBBF24",
    padding: 10,
    marginBottom: 8,
  },
  confirmTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
    marginBottom: 6,
  },
  confirmTo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  confirmPreview: {
    fontSize: 12,
    color: "#444",
    fontStyle: "italic",
  },
  locationCard: {
    backgroundColor: "#f0f9ff",
    borderWidth: 2,
    borderColor: "#6366f1",
    padding: 10,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  sentCard: {
    backgroundColor: "#f0fdf4",
    borderWidth: 2,
    borderColor: "#10B981",
    padding: 10,
    marginBottom: 8,
  },
  sentText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#10B981",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  actionBtn: {
    borderWidth: 2,
    borderColor: "#000",
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowColor: "#000",
    elevation: 2,
  },
  actionBtnPrimary: {
    backgroundColor: "#FBBF24",
  },
  actionBtnDanger: {
    backgroundColor: "#EF4444",
  },
  actionBtnSecondary: {
    backgroundColor: "#6366f1",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#000",
  },
  actionBtnTextPrimary: {
    color: "#000",
  },
  actionBtnTextDanger: {
    color: "#fff",
  },
  actionBtnTextSecondary: {
    color: "#fff",
  },
});
