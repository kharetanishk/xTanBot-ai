import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useStartStoryCall, useCalls, useCall } from "../../../src/hooks/useCalls";
import { useContacts } from "../../../src/hooks/useContacts";
import { parseError } from "../../../src/utils/error.utils";
import type { Call, Contact } from "../../../src/types/api.types";
import XtanCharacter from "../../../src/components/character/XtanCharacter";
import CallCard from "../../../src/components/calls/CallCard";
import ContactAvatar from "../../../src/components/contacts/ContactAvatar";
import { GradientIcon, PhoneCallsNotice, type Gradient, type IconName } from "../../../src/components/ui";
import { PHONE_CALLS_ENABLED } from "../../../src/constants/config";
import { CALL_STATUS_TONE } from "../../../src/components/calls/StatusBadge";
import { colors, radius, toneColors } from "../../../src/theme";

type Mood = "friendly" | "sales" | "rude" | "intellectual" | "influencing" | "custom";
type ScreenState = "form" | "calling" | "summary";

const DISPLAY = "BricolageGrotesque_800ExtraBold";
const BOLD = "BricolageGrotesque_700Bold";

const MOODS: { value: Mood; label: string; desc: string; icon: IconName; gradient: Gradient }[] = [
  { value: "friendly", label: "Friendly", desc: "Warm & casual", icon: "happy", gradient: "amber" },
  { value: "sales", label: "Sales", desc: "Persuasive closer", icon: "briefcase", gradient: "emerald" },
  { value: "rude", label: "Blunt", desc: "Direct, no small talk", icon: "flash", gradient: "rose" },
  { value: "intellectual", label: "Expert", desc: "Precise & analytical", icon: "school", gradient: "indigo" },
  { value: "influencing", label: "Inspiring", desc: "Visionary & moving", icon: "megaphone", gradient: "violet" },
  { value: "custom", label: "Custom", desc: "Describe your own", icon: "color-wand", gradient: "sky" },
];

const STORY_IDEAS: { label: string; story: string; objective: string }[] = [
  {
    label: "🦷 Book appointment",
    story: "Call on my behalf to book an appointment for this Friday evening. Ask which slots are available and pick the earliest one after 5 PM.",
    objective: "Get a confirmed appointment time",
  },
  {
    label: "💸 Payment follow-up",
    story: "Politely follow up about the pending invoice from last month. Ask when the payment will be processed and if anything is blocking it.",
    objective: "Get a committed payment date",
  },
  {
    label: "🎉 Party invite",
    story: "Invite them to my birthday party this Saturday at 8 PM at my place. Mention there will be food and music, and ask if they can make it.",
    objective: "Get a yes or no RSVP",
  },
];

const fmt = (secs: number) => `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

export default function NewCallScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const startStoryCall = useStartStoryCall();

  const [screenState, setScreenState] = useState<ScreenState>("form");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const [story, setStory] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood>("friendly");
  const [customMoodDesc, setCustomMoodDesc] = useState("");
  const [objective, setObjective] = useState("");

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const { data: contacts = [] } = useContacts();
  const filteredContacts = contacts.filter(
    (c) => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || (c.phone ?? "").includes(contactSearch),
  );

  const { data: calls = [] } = useCalls();
  const { data: activeCall } = useCall(activeCallId ?? "", {
    enabled: !!activeCallId && screenState === "calling",
    refetchInterval: screenState === "calling" ? 3000 : undefined,
  });

  useEffect(() => {
    if (screenState !== "calling") return;
    setElapsedSeconds(0);
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [screenState]);

  useEffect(() => {
    if (activeCall && ["completed", "failed", "no-answer"].includes(activeCall.status)) setScreenState("summary");
  }, [activeCall?.status]);

  function handleStartStoryCall() {
    setFormError(null);
    if (!selectedContact) return setFormError("Pick who xTan should call.");
    if (!selectedContact.phone) return setFormError(`${selectedContact.name} has no phone number saved.`);
    if (story.trim().length < 10) return setFormError("Tell xTan a little more — at least 10 characters.");
    if (selectedMood === "custom" && !customMoodDesc.trim()) return setFormError("Describe how she should sound.");

    startStoryCall.mutate(
      {
        toNumber: selectedContact.phone,
        contactName: selectedContact.name,
        story: story.trim(),
        mood: selectedMood,
        customMoodDescription: selectedMood === "custom" && customMoodDesc.trim() ? customMoodDesc.trim() : undefined,
        objective: objective.trim() || undefined,
      },
      {
        onSuccess: (call: Call) => {
          setActiveCallId(call.id);
          setScreenState("calling");
        },
        onError: (err: unknown) => setFormError(parseError(err)),
      },
    );
  }

  function handleNewCall() {
    setScreenState("form");
    setActiveCallId(null);
    setElapsedSeconds(0);
    setStory("");
    setSelectedContact(null);
    setContactSearch("");
    setObjective("");
    setCustomMoodDesc("");
    setSelectedMood("friendly");
    setFormError(null);
  }

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(app)/dashboard" as Href));
  const moodLabel = MOODS.find((m) => m.value === selectedMood)?.label ?? "";
  const ready = !!selectedContact?.phone && story.trim().length >= 10;

  // ─── CALLING ───
  if (screenState === "calling") {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.callingWrap}>
          <Text style={s.callingKicker}>CALL IN PROGRESS · {moodLabel.toUpperCase()} MODE</Text>
          <Text style={s.callingName} numberOfLines={1}>
            {selectedContact?.name ?? selectedContact?.phone}
          </Text>
          <Text style={s.callingTimer}>{fmt(elapsedSeconds)}</Text>
          <View style={s.callingStage}>
            <PulseRings />
            <XtanCharacter size={Math.min(230, width * 0.55)} talking />
          </View>
          <Text style={s.callingNote}>xTan is talking to {selectedContact?.name?.split(" ")[0] ?? "them"} for you…</Text>
          <View style={s.storyCard}>
            <Text style={s.storyLabel}>Her brief</Text>
            <Text style={s.storyText} numberOfLines={4}>
              {story}
            </Text>
            {objective.trim() ? (
              <View style={s.goalRow}>
                <Ionicons name="flag" size={14} color={colors.accent} />
                <Text style={s.goalText}>{objective}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── SUMMARY ───
  if (screenState === "summary" && activeCall) {
    const tone = toneColors[CALL_STATUS_TONE[activeCall.status] ?? "neutral"];
    const ok = activeCall.status === "completed";
    return (
      <SafeAreaView style={s.screen}>
        <ScrollView contentContainerStyle={[s.content, { alignItems: "center" }]}>
          <Animated.View entering={FadeInDown} style={s.summaryCard}>
            <View style={[s.resultBadge, { backgroundColor: tone.bg }]}>
              <Ionicons name={ok ? "checkmark-circle" : "close-circle"} size={40} color={tone.fg} />
            </View>
            <Text style={s.summaryTitle}>{ok ? "Call complete" : activeCall.status === "no-answer" ? "No answer" : "Call failed"}</Text>
            <Text style={s.summarySub}>
              {selectedContact?.name ?? activeCall.toNumber} · {activeCall.duration ? fmt(activeCall.duration) : "--:--"} · {moodLabel}
            </Text>
            {activeCall.summary ? (
              <View style={s.summaryBox}>
                <Text style={s.storyLabel}>What happened</Text>
                <Text style={s.storyText}>{activeCall.summary}</Text>
              </View>
            ) : null}
            <Pressable onPress={handleNewCall} style={({ pressed }) => [s.cta, pressed && s.pressed]}>
              <Ionicons name="add" size={20} color={colors.onAccent} />
              <Text style={s.ctaText}>New call</Text>
            </Pressable>
            <Pressable onPress={goBack} style={s.linkBtn}>
              <Text style={s.linkText}>Back to app</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── FORM ───
  const form = (
    <View style={{ gap: 16 }}>
      {/* 1. Who */}
      <Step n={1} title="Who should she call?" done={!!selectedContact}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={colors.textSubtle} />
          <TextInput
            style={s.searchInput}
            value={contactSearch}
            onChangeText={setContactSearch}
            placeholder="Search contacts"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
          />
        </View>
        {contacts.length === 0 ? (
          <Pressable onPress={() => router.push("/(app)/contact/new")} style={s.emptyContacts}>
            <Ionicons name="person-add" size={18} color={colors.accent} />
            <Text style={s.emptyContactsText}>Add your first contact</Text>
          </Pressable>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.contactRow}>
            {filteredContacts.slice(0, 20).map((c) => {
              const on = selectedContact?.id === c.id;
              return (
                <Pressable key={c.id} onPress={() => setSelectedContact(on ? null : c)} style={({ pressed }) => [s.contactChip, on && s.contactChipOn, pressed && s.pressed]}>
                  <View>
                    <ContactAvatar name={c.name} size={46} />
                    {on ? (
                      <View style={s.checkDot}>
                        <Ionicons name="checkmark" size={12} color={colors.onAccent} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[s.contactName, on && { color: colors.text }]} numberOfLines={1}>
                    {c.name.split(" ")[0]}
                  </Text>
                  <Text style={s.contactPhone} numberOfLines={1}>
                    {c.phone ?? "no phone"}
                  </Text>
                </Pressable>
              );
            })}
            {filteredContacts.length === 0 ? <Text style={s.muted}>No matches</Text> : null}
          </ScrollView>
        )}
      </Step>

      {/* 2. Story */}
      <Step n={2} title="What's the story?" done={story.trim().length >= 10}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
          {STORY_IDEAS.map((idea) => (
            <Pressable
              key={idea.label}
              onPress={() => {
                setStory(idea.story);
                if (!objective) setObjective(idea.objective);
              }}
              style={({ pressed }) => [s.idea, pressed && s.pressed]}
            >
              <Text style={s.ideaText}>{idea.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput
          style={[s.input, s.textArea]}
          value={story}
          onChangeText={setStory}
          placeholder="What should xTan say? Who is she calling for, and what's the context?"
          placeholderTextColor={colors.textSubtle}
          multiline
          maxLength={3000}
        />
        <Text style={s.counter}>{story.length} / 3000</Text>
      </Step>

      {/* 3. Mood */}
      <Step n={3} title="How should she sound?" done>
        <View style={s.moodGrid}>
          {MOODS.map((m) => {
            const on = selectedMood === m.value;
            return (
              <Pressable key={m.value} onPress={() => setSelectedMood(m.value)} style={({ pressed }) => [s.mood, wide && { width: "31.5%" }, on && s.moodOn, pressed && s.pressed]}>
                <GradientIcon icon={m.icon} gradient={m.gradient} size={38} />
                <Text style={s.moodLabel}>{m.label}</Text>
                <Text style={s.moodDesc}>{m.desc}</Text>
                {on ? (
                  <View style={s.moodCheck}>
                    <Ionicons name="checkmark" size={12} color={colors.onAccent} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {selectedMood === "custom" ? (
          <Animated.View entering={FadeIn}>
            <TextInput
              style={[s.input, { marginTop: 12 }]}
              value={customMoodDesc}
              onChangeText={setCustomMoodDesc}
              placeholder="e.g. Calm but assertive negotiator"
              placeholderTextColor={colors.textSubtle}
            />
          </Animated.View>
        ) : null}
      </Step>

      {/* 4. Goal */}
      <Step n={4} title="Goal" optional done={!!objective.trim()}>
        <TextInput
          style={s.input}
          value={objective}
          onChangeText={setObjective}
          placeholder="e.g. Get them to agree to a product demo"
          placeholderTextColor={colors.textSubtle}
          returnKeyType="done"
        />
      </Step>

      {formError ? (
        <Animated.View entering={FadeIn} style={s.errorBox}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={s.errorText}>{formError}</Text>
        </Animated.View>
      ) : null}

      {/* Summary + CTA */}
      <View style={s.launch}>
        <View style={s.launchFace}>
          <XtanCharacter size={52} variant="face" still />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.launchTitle} numberOfLines={1}>
            {selectedContact ? `Ready to call ${selectedContact.name.split(" ")[0]}` : "Pick someone to call"}
          </Text>
          <Text style={s.launchSub}>{moodLabel} mode{objective.trim() ? " · goal set" : ""}</Text>
        </View>
        <Pressable
          onPress={handleStartStoryCall}
          disabled={startStoryCall.isPending || !PHONE_CALLS_ENABLED}
          style={({ pressed }) => [s.cta, (!ready || !PHONE_CALLS_ENABLED) && { opacity: 0.55 }, pressed && s.pressed]}
        >
          <Ionicons name="call" size={18} color={colors.onAccent} />
          <Text style={s.ctaText}>{startStoryCall.isPending ? "Starting…" : "Start call"}</Text>
        </Pressable>
      </View>
    </View>
  );

  const past = (
    <View style={{ gap: 4 }}>
      <Text style={s.sideTitle}>Recent calls</Text>
      {calls.length === 0 ? (
        <Text style={s.muted}>Your calls will show up here.</Text>
      ) : (
        calls.slice(0, wide ? 8 : 5).map((c) => <CallCard key={c.id} call={c} onPress={() => router.push(`/(app)/call/${c.id}` as Href)} />)
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(350)} style={s.header}>
          <Pressable onPress={goBack} style={s.backBtn} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>New call</Text>
            <Text style={s.subtitle}>Give xTan a brief — she'll make the call and talk for you.</Text>
          </View>
        </Animated.View>

        <PhoneCallsNotice />

        {wide ? (
          <View style={s.columns}>
            <View style={{ flex: 1.4 }}>{form}</View>
            <View style={{ flex: 1 }}>{past}</View>
          </View>
        ) : (
          <>
            {form}
            <View style={{ marginTop: 28 }}>{past}</View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ n, title, optional, done, children }: { n: number; title: string; optional?: boolean; done?: boolean; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(n * 70)} style={s.step}>
      <View style={s.stepHead}>
        <View style={[s.stepNum, done && s.stepNumDone]}>
          {done ? <Ionicons name="checkmark" size={13} color={colors.onAccent} /> : <Text style={s.stepNumText}>{n}</Text>}
        </View>
        <Text style={s.stepTitle}>{title}</Text>
        {optional ? <Text style={s.optional}>optional</Text> : null}
      </View>
      {children}
    </Animated.View>
  );
}

function PulseRings() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      {[0, 1, 2].map((i) => (
        <PulseRing key={i} delay={i * 600} />
      ))}
    </View>
  );
}

function PulseRing({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      v.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1);
    }, delay);
    return () => clearTimeout(t);
  }, [v, delay]);
  const a = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - v.value), transform: [{ scale: 0.6 + v.value * 0.7 }] }));
  return <Animated.View style={[s.pulseRing, a]} />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40, width: "100%", maxWidth: 1100, alignSelf: "center" },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  muted: { color: colors.textMuted, fontSize: 14 },

  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 30, fontFamily: DISPLAY, letterSpacing: -0.8 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  columns: { flexDirection: "row", gap: 28, alignItems: "flex-start" },

  step: { backgroundColor: colors.surface, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", borderRadius: 24, padding: 18 },
  stepHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  stepNumDone: { backgroundColor: colors.accent },
  stepNumText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  stepTitle: { color: colors.text, fontSize: 17, fontFamily: BOLD, flex: 1 },
  optional: { color: colors.textSubtle, fontSize: 12, fontWeight: "600" },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 10, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  contactRow: { gap: 10, paddingRight: 4 },
  contactChip: { width: 96, alignItems: "center", gap: 6, padding: 10, borderRadius: 18, borderWidth: 1.5, borderColor: "transparent", backgroundColor: colors.bg },
  contactChipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  checkDot: { position: "absolute", right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  contactName: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  contactPhone: { color: colors.textSubtle, fontSize: 10 },
  emptyContacts: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong },
  emptyContactsText: { color: colors.accent, fontWeight: "700" },

  idea: { backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  ideaText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 15,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  textArea: { minHeight: 120, textAlignVertical: "top", lineHeight: 22 },
  counter: { color: colors.textSubtle, fontSize: 12, textAlign: "right", marginTop: 6 },

  moodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  mood: { width: "48%", flexGrow: 1, backgroundColor: colors.bg, borderRadius: 18, padding: 14, gap: 6, borderWidth: 1.5, borderColor: "transparent" },
  moodOn: { borderColor: colors.accent, backgroundColor: "rgba(251,191,36,0.06)" },
  moodLabel: { color: colors.text, fontSize: 15, fontFamily: BOLD, marginTop: 4 },
  moodDesc: { color: colors.textMuted, fontSize: 12 },
  moodCheck: { position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 12 },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "600", flex: 1 },

  launch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#100d05",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
    borderRadius: 24,
    padding: 12,
    paddingLeft: 14,
  },
  launchFace: { width: 52, height: 52, borderRadius: 26, overflow: "hidden", backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  launchTitle: { color: colors.text, fontSize: 15, fontFamily: BOLD },
  launchSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 13,
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: { color: colors.onAccent, fontSize: 15, fontWeight: "800" },
  sideTitle: { color: colors.text, fontSize: 17, fontFamily: BOLD, marginBottom: 8 },

  callingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 6, width: "100%", maxWidth: 520, alignSelf: "center" },
  callingKicker: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  callingName: { color: colors.text, fontSize: 32, fontFamily: DISPLAY, letterSpacing: -0.8 },
  callingTimer: { color: colors.textMuted, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  callingStage: { width: 300, height: 340, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  pulseRing: { position: "absolute", width: 300, height: 300, borderRadius: 150, borderWidth: 2, borderColor: colors.accent },
  callingNote: { color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 14 },
  storyCard: { alignSelf: "stretch", backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 6 },
  storyLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  storyText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  goalText: { color: colors.accent, fontSize: 14, fontWeight: "600", flex: 1 },

  summaryCard: { width: "100%", maxWidth: 480, alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: 28, padding: 26, borderWidth: 1, borderColor: colors.border, marginTop: 40 },
  resultBadge: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  summaryTitle: { color: colors.text, fontSize: 26, fontFamily: DISPLAY },
  summarySub: { color: colors.textMuted, fontSize: 14, marginBottom: 6 },
  summaryBox: { alignSelf: "stretch", backgroundColor: colors.bg, borderRadius: 16, padding: 14, gap: 6, marginBottom: 8 },
  linkBtn: { paddingVertical: 10 },
  linkText: { color: colors.textMuted, fontWeight: "700" },
});
