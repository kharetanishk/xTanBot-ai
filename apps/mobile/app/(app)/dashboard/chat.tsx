import {
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
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
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../../src/stores/auth.store";
import { sendMessage, listChats, getChatMessages, type ChatSummary } from "../../../src/api/conversations.api";
import type { Message, StructuredPayload } from "../../../src/types/api.types";
import XtanCharacter from "../../../src/components/character/XtanCharacter";
import { SpeechBubble, useTypewriter } from "../../../src/components/character/SpeechBubble";

const { width: SCREEN_W } = Dimensions.get("window");

const SUGGESTED = [
  { icon: "medical-outline" as const,  text: "Find a gastroenterologist near me" },
  { icon: "gift-outline" as const,     text: "Send birthday wish to a contact" },
  { icon: "calendar-outline" as const, text: "Schedule a meeting with agenda" },
  { icon: "alarm-outline" as const,    text: "Set an alarm for 7 AM tomorrow" },
  { icon: "film-outline" as const,     text: "Search top 10 movies of 2025" },
  { icon: "call-outline" as const,     text: "Make a sales call in sales mode" },
  { icon: "location-outline" as const, text: "Find the best restaurant near me" },
];

/** Friendly status shown while a tool runs (streamed as SSE "tool" events). */
const TOOL_LABELS: Record<string, string> = {
  web_search: "Searching the web",
  web_fetch: "Reading the page",
  get_location: "Finding your location",
  get_current_time: "Checking the time",
  lookup_contact: "Looking up the contact",
  schedule_meeting: "Scheduling the meeting",
  set_alarm: "Setting the alarm",
  make_call: "Setting up the call",
  story_call: "Setting up the call",
  send_whatsapp: "Preparing the WhatsApp message",
};

// ── Typing dots ────────────────────────────────────────────────────────
function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={t.row}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[
            t.dot,
            {
              opacity: d,
              transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const t = StyleSheet.create({
  row: { flexDirection: "row", gap: 5, paddingVertical: 4, paddingHorizontal: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FBBF24" },
});

// ── Cycling blink prompt ──────────────────────────────────────────────
function CyclingPrompt({ onSelect }: { onSelect(text: string): void }) {
  const [index,   setIndex]   = useState(0);
  const opacity   = useRef(new Animated.Value(0)).current;
  const shift     = useRef(new Animated.Value(10)).current; // px: rises in from below, drifts out above
  const glow      = useRef(new Animated.Value(0)).current;

  // Sequence: ease in (700ms) → hold (2600ms) → ease out (650ms) → next. Slow fades + a small
  // drift so prompts glide in and out instead of flashing.
  useEffect(() => {
    let cancelled = false;
    const ease = Easing.bezier(0.4, 0, 0.2, 1);

    opacity.setValue(0);
    shift.setValue(10);
    glow.setValue(0);

    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: ease, useNativeDriver: true }),
        Animated.timing(shift,   { toValue: 0, duration: 700, easing: ease, useNativeDriver: true }),
        Animated.timing(glow,    { toValue: 1, duration: 900, easing: ease, useNativeDriver: false }),
      ]),
      Animated.delay(2600),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0,   duration: 650, easing: ease, useNativeDriver: true }),
        Animated.timing(shift,   { toValue: -10, duration: 650, easing: ease, useNativeDriver: true }),
        Animated.timing(glow,    { toValue: 0,   duration: 650, easing: ease, useNativeDriver: false }),
      ]),
      Animated.delay(150),
    ]);
    anim.start(({ finished }) => {
      if (finished && !cancelled) setIndex((i) => (i + 1) % SUGGESTED.length);
    });
    return () => { cancelled = true; anim.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const item = SUGGESTED[index]!;

  const borderColor = glow.interpolate({
    inputRange:  [0, 1],
    outputRange: ["#1f2937", "#FBBF24"],
  });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: shift }] }}>
      <Pressable onPress={() => onSelect(item.text)}>
        <Animated.View style={[cy.card, { borderColor }]}>
          <View style={cy.iconRing}>
            <Ionicons name={item.icon} size={20} color="#FBBF24" />
          </View>
          <Text style={cy.text}>{item.text}</Text>
          <Ionicons name="flash" size={14} color="#FBBF24" />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const cy = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#0d1117",
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: "#FBBF24",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  iconRing: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(251,191,36,0.08)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    color: "#e5e7eb",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
});

// ── Empty / welcome state ─────────────────────────────────────────────
function EmptyState({ onSelect, name }: { onSelect(text: string): void; name?: string }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.82)).current;
  const [waving, setWaving] = useState(true);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, useNativeDriver: true, tension: 55, friction: 9 }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setWaving(false), 2600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const first = name?.split(/[\s_]+/)[0];
  const greeting = `Hey${first ? ` ${first}` : ""}! I'm xTan 💛 What can I do for you today?`;
  const { shown, done } = useTypewriter(greeting, 34, 400);
  const charSize = Math.min(SCREEN_W * 0.46, 200);

  return (
    <View style={es.root}>
      <SpeechBubble text={shown || " "} typing={!done} tail="bottom" style={es.bubble} />
      <Animated.View style={[es.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <XtanCharacter size={charSize} variant="full" talking={!done} wave={waving} />
      </Animated.View>

      {/* Cycling prompt */}
      <View style={es.promptWrap}>
        <CyclingPrompt onSelect={onSelect} />
      </View>
    </View>
  );
}

const es = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 20,
  },
  bubble: { width: "100%", maxWidth: 420, marginBottom: 14 },
  promptWrap: {
    width: "100%",
    maxWidth: 420,
  },
});

// ── Main chat screen ──────────────────────────────────────────────────
export default function ChatScreen() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [inputText,      setInputText]      = useState(prefill ?? "");
  const [isStreaming,    setIsStreaming]     = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [toolStatus,     setToolStatus]     = useState<string | null>(null);
  const [chats,          setChats]          = useState<ChatSummary[] | null>(null); // non-null = history open
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (prefill) setInputText(prefill);
  }, [prefill]);

  const submitMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming || !token) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        conversationId: conversationId ?? "",
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      const streamingMsg: Message = {
        id: "streaming",
        conversationId: conversationId ?? "",
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, streamingMsg]);

      // Smooth streaming: the model often delivers text in sentence-sized bursts, so we
      // buffer what arrives and reveal it word by word at a steady pace (faster when the
      // buffer grows, so it never lags far behind) — the ChatGPT/Claude feel.
      let pending = "";
      let finalMsg: { content?: string; payload?: StructuredPayload | null } | null = null;
      const appendToBubble = (text: string) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === "streaming" ? { ...m, content: (m.content ?? "") + text } : m)),
        );
      const finalize = () => {
        clearInterval(pump);
        setIsStreaming(false);
        setToolStatus(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "streaming"
              ? {
                  ...m,
                  id: `assistant-${Date.now()}`,
                  content: finalMsg?.content ?? m.content,
                  structuredPayload: finalMsg?.payload ?? null,
                }
              : m,
          ),
        );
      };
      const pump = setInterval(() => {
        if (pending) {
          const words = pending.match(/\S+\s*|\s+/g) ?? [pending];
          const take = Math.max(1, Math.ceil(words.length / 12)); // catch up within ~0.4s
          const piece = words.slice(0, take).join("");
          pending = pending.slice(piece.length);
          appendToBubble(piece);
        } else if (finalMsg) {
          finalize();
        }
      }, 35);

      const onChunk = (chunk: string) => {
        setToolStatus(null);
        pending += chunk;
      };

      const finish = (content?: string, payload?: StructuredPayload | null) => {
        // Let the buffer finish revealing, then swap in the saved final text + cards.
        finalMsg = { content, payload };
      };

      try {
        await sendMessage(token, conversationId, trimmed, {
          onChunk,
          onTool: (name) => setToolStatus(TOOL_LABELS[name] ?? "Working on it"),
          onDone: (newId, payload, message) => {
            finish(message, payload);
            if (newId) setConversationId(newId);
          },
        });
      } catch {
        pending = "";
        finish("Sorry — I couldn't reach xTanBot. Check your connection and try again.");
      }
    },
    [isStreaming, token, conversationId],
  );

  // Each chat is its own server conversation; switching just swaps id + messages.
  const startNewChat = useCallback(() => {
    if (isStreaming) return;
    setChats(null);
    setConversationId(null);
    setMessages([]);
    setInputText("");
  }, [isStreaming]);

  const toggleHistory = useCallback(() => {
    if (chats) return setChats(null);
    setChats([]);
    listChats().then(setChats).catch(() => setChats(null));
  }, [chats]);

  const openChat = useCallback(
    async (id: string) => {
      if (isStreaming) return;
      setChats(null);
      try {
        setMessages(await getChatMessages(id));
        setConversationId(id);
      } catch {
        // stay on the current chat
      }
    },
    [isStreaming],
  );

  const handleSend = useCallback(() => {
    const c = inputText.trim();
    if (!c) return;
    setInputText("");
    void submitMessage(c);
  }, [inputText, submitMessage]);

  const handleActionPress = useCallback(
    (autoMessage: string) => void submitMessage(autoMessage),
    [submitMessage],
  );

  function renderPayload(payload: StructuredPayload) {
    if (payload.type === "none") return null;

    return (
      <View style={p.wrap}>
        {payload.type === "search_results" && payload.results && (
          <View>
            {payload.results.map((r, i) => (
              <View key={`r-${i}`} style={p.result}>
                <Text style={p.resultTitle} numberOfLines={2}>{r.title}</Text>
                {r.rating  ? <Text style={p.meta}>⭐ {r.rating}</Text>  : null}
                {r.address ? <Text style={p.meta}>📍 {r.address}</Text> : null}
                {r.phone   ? <Text style={p.phone}>📞 {r.phone}</Text>  : null}
                {r.snippet ? <Text style={p.snippet} numberOfLines={2}>{r.snippet}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {payload.type === "confirmation" && payload.confirmationData ? (
          <View style={p.confirm}>
            <Text style={p.confirmTitle}>CONFIRM ACTION</Text>
            <Text style={p.confirmTo}>
              To: {payload.confirmationData.contactName} ({payload.confirmationData.toPhone})
            </Text>
            <Text style={p.confirmPreview}>"{payload.confirmationData.messagePreview}"</Text>
          </View>
        ) : null}

        {payload.type === "location" && payload.locationData ? (
          <View style={p.location}>
            <Ionicons name="location" size={14} color="#6366f1" />
            <Text style={p.locationText}>{payload.locationData.formatted}</Text>
          </View>
        ) : null}

        {payload.type === "whatsapp_sent" ? (
          <View style={p.sent}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={p.sentText}>WhatsApp sent successfully</Text>
          </View>
        ) : null}

        {payload.actions && payload.actions.length > 0 ? (
          <View style={p.actions}>
            {payload.actions.map((action) => (
              <Pressable
                key={action.id}
                style={[
                  p.actionBtn,
                  action.style === "primary"   ? p.actionPrimary   : null,
                  action.style === "danger"    ? p.actionDanger    : null,
                  action.style === "secondary" ? p.actionSecondary : null,
                ]}
                onPress={() => handleActionPress(action.autoMessage)}
              >
                <Text
                  style={[
                    p.actionText,
                    action.style === "danger"    ? p.actionTextLight : null,
                    action.style === "secondary" ? p.actionTextLight : null,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      if (item.role === "user") {
        return (
          <View style={m.userRow}>
            <View style={m.userBubble}>
              <Text style={m.textUser}>{item.content}</Text>
            </View>
          </View>
        );
      }

      const isStream = item.id === "streaming";
      const hasText = Boolean(item.content);

      return (
        <View style={m.aiRow}>
          <View style={m.avatar}>
            <XtanCharacter size={30} variant="face" still talking={isStream && hasText} />
          </View>
          <View style={m.aiBody}>
            {isStream && toolStatus ? (
              <View style={m.toolChip}>
                <ActivityIndicator size="small" color="#FBBF24" />
                <Text style={m.toolText}>{toolStatus}…</Text>
              </View>
            ) : null}
            {isStream && !hasText && !toolStatus ? <TypingDots /> : null}
            {hasText ? (
              <Text style={m.textAi}>
                {item.content}
                {isStream ? <Text style={m.cursor}> ●</Text> : null}
              </Text>
            ) : null}
            {!isStream && item.structuredPayload && item.structuredPayload.type !== "none"
              ? renderPayload(item.structuredPayload)
              : null}
          </View>
        </View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toolStatus, handleActionPress],
  );

  // Web: Enter sends, Shift+Enter adds a new line (like ChatGPT/Claude).
  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string; shiftKey?: boolean }; preventDefault?: () => void }) => {
      if (Platform.OS === "web" && e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
        e.preventDefault?.();
        handleSend();
      }
    },
    [handleSend],
  );

  const hasInput = Boolean(inputText.trim());

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerAvatar}>
            <XtanCharacter size={38} variant="face" still talking={isStreaming && !toolStatus} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerBrand}>xTan</Text>
            <Text style={s.headerSub}>
              {isStreaming ? (toolStatus ? `${toolStatus}…` : "typing…") : "Your personal assistant"}
            </Text>
          </View>
          <Pressable onPress={toggleHistory} style={s.headerBtn} accessibilityLabel="Chat history">
            <Ionicons name="time-outline" size={20} color={chats ? "#fbbf24" : "#9ca3af"} />
          </Pressable>
          <Pressable
            onPress={startNewChat}
            disabled={isStreaming}
            style={[s.headerBtn, isStreaming && { opacity: 0.4 }]}
            accessibilityLabel="New chat"
          >
            <Ionicons name="create-outline" size={20} color="#9ca3af" />
          </Pressable>
        </View>

        {chats && (
          <View style={s.history}>
            {chats.length === 0 ? (
              <Text style={s.historyEmpty}>No previous chats yet</Text>
            ) : (
              <FlatList
                data={chats}
                keyExtractor={(c) => c.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => void openChat(item.id)}
                    style={[s.historyItem, item.id === conversationId && s.historyItemActive]}
                  >
                    <Text style={s.historyTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.historyDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </Pressable>
                )}
              />
            )}
          </View>
        )}

        {/* Body */}
        {messages.length === 0 ? (
          <EmptyState onSelect={(text) => setInputText(text)} name={user?.name} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={s.list}
            contentContainerStyle={s.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Composer: one pill, one trailing action — mic when empty, send when typed, spinner while replying */}
        <View style={s.bar}>
          <View style={s.composer}>
            <TextInput
              style={s.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask xTanBot anything…"
              placeholderTextColor="#6b7280"
              multiline
              maxLength={2000}
              editable={!isStreaming}
              onKeyPress={handleKeyPress}
              {...(Platform.OS === "web" ? ({ rows: 1 } as object) : {})}
            />
            {isStreaming ? (
              <View style={[s.actionBtn, s.actionBtnBusy]}>
                <ActivityIndicator size="small" color="#9ca3af" />
              </View>
            ) : hasInput ? (
              <Pressable
                onPress={handleSend}
                style={[s.actionBtn, s.actionBtnPrimary]}
                accessibilityLabel="Send message"
              >
                <Ionicons name="arrow-up" size={20} color="#000" />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push("/voice")}
                style={[s.actionBtn, s.actionBtnPrimary]}
                accessibilityLabel="Start voice chat"
              >
                <Ionicons name="mic" size={19} color="#000" />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Payload styles ────────────────────────────────────────────────────
const p = StyleSheet.create({
  wrap: { marginTop: 10, gap: 8 },
  result: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#FBBF24",
  },
  resultTitle:  { fontSize: 13, fontWeight: "800", color: "#fff", marginBottom: 4 },
  meta:         { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  phone:        { fontSize: 12, fontWeight: "700", color: "#FBBF24", marginTop: 2 },
  snippet:      { fontSize: 11, color: "#6b7280", lineHeight: 15, marginTop: 4 },
  confirm: {
    backgroundColor: "#1a1500",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FBBF24",
    padding: 12,
  },
  confirmTitle:   { fontSize: 10, fontWeight: "900", color: "#FBBF24", letterSpacing: 1.5, marginBottom: 6 },
  confirmTo:      { fontSize: 12, fontWeight: "700", color: "#fff", marginBottom: 4 },
  confirmPreview: { fontSize: 12, color: "#9ca3af", fontStyle: "italic" },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1e1b4b",
    borderRadius: 10,
    padding: 10,
  },
  locationText: { fontSize: 13, fontWeight: "600", color: "#a5b4fc", flex: 1 },
  sent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#052e16",
    borderRadius: 10,
    padding: 10,
  },
  sentText: { fontSize: 13, fontWeight: "700", color: "#10B981" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  actionBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionPrimary:   { backgroundColor: "#FBBF24" },
  actionDanger:    { backgroundColor: "#7f1d1d" },
  actionSecondary: { backgroundColor: "#1e1b4b" },
  actionText:      { fontSize: 12, fontWeight: "800", color: "#000" },
  actionTextLight: { color: "#fff" },
});

// ── Message styles (ChatGPT/Claude-like: user bubbles, assistant as plain text) ──
const m = StyleSheet.create({
  userRow: { alignItems: "flex-end", marginBottom: 18 },
  userBubble: {
    maxWidth: "82%",
    backgroundColor: "#1f2937",
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textUser: { color: "#f9fafb", fontSize: 15, lineHeight: 22 },

  aiRow:  { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 22 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  aiBody:   { flex: 1, paddingTop: 4, gap: 8 },
  textAi:   { color: "#e5e7eb", fontSize: 15, lineHeight: 24 },
  cursor:   { color: "#FBBF24", fontSize: 11 },
  toolChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toolText: { color: "#d1d5db", fontSize: 13, fontWeight: "600" },
});

// ── Screen / chrome styles ────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#09090b" },
  flex: { flex: 1 },

  header: {
    height: 58,
    backgroundColor: "#09090b",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrand: { color: "#fff", fontWeight: "800", fontSize: 16 },
  headerSub:   { color: "#9ca3af", fontSize: 12, marginTop: 1 },
  headerBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#111827" },
  history: {
    position: "absolute", top: 58, right: 12, zIndex: 20, width: 300, maxWidth: "92%", maxHeight: 360,
    backgroundColor: "#0f172a", borderRadius: 14, borderWidth: 1, borderColor: "#1f2937", paddingVertical: 6,
  },
  historyEmpty:      { color: "#9ca3af", fontSize: 13, padding: 14 },
  historyItem:       { paddingHorizontal: 14, paddingVertical: 10 },
  historyItemActive: { backgroundColor: "rgba(251,191,36,0.12)" },
  historyTitle:      { color: "#e5e7eb", fontSize: 14 },
  historyDate:       { color: "#6b7280", fontSize: 11, marginTop: 2 },

  list:        { flex: 1 },
  listContent: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 8,
  },

  bar: {
    backgroundColor: "#09090b",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  composer: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 26,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    lineHeight: 20,
    minHeight: 40,
    maxHeight: 120,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 0,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnPrimary: { backgroundColor: "#FBBF24" },
  actionBtnBusy:    { backgroundColor: "#1f2937" },
});
