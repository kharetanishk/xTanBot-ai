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
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../../src/stores/auth.store";
import { sendMessage } from "../../../src/api/conversations.api";
import type { Message, StructuredPayload } from "../../../src/types/api.types";

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
  const scale     = useRef(new Animated.Value(0.94)).current;
  const glow      = useRef(new Animated.Value(0)).current;

  // Sequence: blink-in (80ms) → hold (1800ms) → blink-out (120ms) → next
  useEffect(() => {
    let cancelled = false;

    function cycle() {
      if (cancelled) return;

      // Reset
      opacity.setValue(0);
      scale.setValue(0.94);
      glow.setValue(0);

      Animated.sequence([
        // Blink in
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 80,  useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 1, duration: 120, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
          Animated.timing(glow,    { toValue: 1, duration: 80,  useNativeDriver: false }),
        ]),
        // Hold
        Animated.delay(1800),
        // Blink out
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
          Animated.timing(glow,    { toValue: 0, duration: 120, useNativeDriver: false }),
        ]),
        // Gap before next
        Animated.delay(120),
      ]).start(({ finished }) => {
        if (finished && !cancelled) {
          setIndex((i) => (i + 1) % SUGGESTED.length);
        }
      });
    }

    cycle();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const item = SUGGESTED[index]!;

  const borderColor = glow.interpolate({
    inputRange:  [0, 1],
    outputRange: ["#1f2937", "#FBBF24"],
  });

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
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
function EmptyState({ onSelect }: { onSelect(text: string): void }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, useNativeDriver: true, tension: 55, friction: 9 }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoSize = Math.min(SCREEN_W * 0.80, 340);

  return (
    <View style={es.root}>
      {/* Big logo */}
      <Animated.View style={[es.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Image
          source={require("../../../assets/images/xt.png")}
          style={{ width: logoSize, height: logoSize }}
          resizeMode="contain"
        />
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
    marginBottom: 28,
  },
  promptWrap: {
    width: "100%",
    maxWidth: 420,
  },
});

// ── Main chat screen ──────────────────────────────────────────────────
export default function ChatScreen() {
  const token = useAuthStore((s) => s.token);
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [inputText,      setInputText]      = useState(prefill ?? "");
  const [isStreaming,    setIsStreaming]     = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
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

      const onChunk = (chunk: string) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === "streaming"
              ? { ...m, content: (m.content ?? "") + chunk }
              : m,
          ),
        );

      const onDone = (newId: string, payload?: StructuredPayload | null) => {
        setIsStreaming(false);
        setMessages((prev) => {
          const streaming = prev.find((m) => m.id === "streaming");
          if (!streaming) return prev;
          const final: Message = {
            ...streaming,
            id: `assistant-${Date.now()}`,
            structuredPayload: payload ?? null,
          };
          return prev.map((m) => (m.id === "streaming" ? final : m));
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
      const isUser   = item.role === "user";
      const isStream = item.id === "streaming";
      const showDots = isStream && isStreaming && (!item.content || item.content === "");

      return (
        <View style={[m.row, isUser ? m.rowRight : m.rowLeft]}>
          {!isUser ? (
            <View style={m.avatar}>
              <Image
                source={require("../../../assets/images/xt.png")}
                style={m.avatarImg}
                resizeMode="contain"
              />
            </View>
          ) : null}

          <View style={{ maxWidth: "78%", alignItems: isUser ? "flex-end" : "flex-start" }}>
            <View style={[m.bubble, isUser ? m.bubbleUser : m.bubbleAi]}>
              {showDots ? (
                <TypingDots />
              ) : (
                <>
                  <Text style={isUser ? m.textUser : m.textAi}>
                    {item.content}
                    {isStream && isStreaming && item.content ? "▊" : ""}
                  </Text>
                  {!isUser && item.structuredPayload && item.structuredPayload.type !== "none"
                    ? renderPayload(item.structuredPayload)
                    : null}
                </>
              )}
            </View>
            <Text style={[m.ts, isUser ? m.tsRight : m.tsLeft]}>
              {new Date(item.createdAt).toLocaleTimeString("en-IN", {
                hour: "2-digit", minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStreaming, handleActionPress],
  );

  const canSend = Boolean(inputText.trim()) && !isStreaming;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {/* Header */}
        <View style={s.header}>
          <Image
            source={require("../../../assets/images/xt.png")}
            style={s.headerLogo}
            resizeMode="contain"
          />
          <Text style={s.headerBrand}>xTanBot</Text>
          <View style={s.headerRight}>
            <View style={s.onlineDot} />
            <Text style={s.onlineLabel}>Online</Text>
          </View>
        </View>

        {/* Body */}
        {messages.length === 0 ? (
          <EmptyState onSelect={(text) => setInputText(text)} />
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

        {/* Input bar */}
        <View style={s.bar}>
          <TextInput
            style={[s.input, isStreaming ? s.inputDisabled : null]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask xTanBot anything…"
            placeholderTextColor="#4b5563"
            multiline
            maxLength={2000}
            editable={!isStreaming}
            onSubmitEditing={handleSend}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={[s.sendBtn, !canSend ? s.sendBtnOff : null]}
          >
            {isStreaming ? (
              <Ionicons name="ellipsis-horizontal" size={18} color="#4b5563" />
            ) : (
              <Ionicons name="arrow-up" size={20} color={canSend ? "#000" : "#4b5563"} />
            )}
          </Pressable>
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

// ── Message styles ────────────────────────────────────────────────────
const m = StyleSheet.create({
  row:       { flexDirection: "row", marginBottom: 12, alignItems: "flex-end", gap: 8 },
  rowRight:  { justifyContent: "flex-end" },
  rowLeft:   { justifyContent: "flex-start" },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#111827",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  avatarImg: { width: 22, height: 22 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: "#FBBF24",
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderBottomLeftRadius: 4,
  },
  textUser: { color: "#000", fontWeight: "700", fontSize: 15, lineHeight: 21 },
  textAi:   { color: "#e5e7eb", fontWeight: "400", fontSize: 15, lineHeight: 22 },
  ts:       { fontSize: 10, color: "#4b5563", marginTop: 2, marginHorizontal: 4 },
  tsRight:  { alignSelf: "flex-end" },
  tsLeft:   { alignSelf: "flex-start" },
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
  headerLogo:  { width: 28, height: 28 },
  headerBrand: { color: "#fff", fontWeight: "900", fontSize: 17, flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  onlineDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  onlineLabel: { color: "#10B981", fontSize: 12, fontWeight: "600" },

  list:        { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 8 },

  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#09090b",
    borderTopWidth: 1,
    borderTopColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#111827",
    borderWidth: 1.5,
    borderColor: "#1f2937",
    borderRadius: 22,
    color: "#fff",
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    maxHeight: 110,
    lineHeight: 21,
  },
  inputDisabled: { opacity: 0.5 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FBBF24",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FBBF24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnOff: {
    backgroundColor: "#111827",
    shadowOpacity: 0,
    elevation: 0,
  },
});
