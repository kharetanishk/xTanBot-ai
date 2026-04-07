import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useStartStoryCall, useCalls, useCall } from "../../../src/hooks/useCalls";
import { useContacts } from "../../../src/hooks/useContacts";
import { parseError } from "../../../src/utils/error.utils";
import type { Call, Contact } from "../../../src/types/api.types";

type Mood = "friendly" | "sales" | "rude" | "intellectual" | "influencing" | "custom";
type ScreenState = "form" | "calling" | "summary";

const MOODS: { value: Mood; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "friendly", label: "FRIENDLY", icon: "happy-outline" },
  { value: "sales", label: "SALES", icon: "briefcase-outline" },
  { value: "rude", label: "RUDE", icon: "flash-outline" },
  { value: "intellectual", label: "INTELLECTUAL", icon: "school-outline" },
  { value: "influencing", label: "INFLUENCING", icon: "megaphone-outline" },
  { value: "custom", label: "CUSTOM", icon: "settings-outline" },
];

const STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e",
  failed: "#ef4444",
  "no-answer": "#f59e0b",
  "in-progress": "#FBBF24",
  initiated: "#FBBF24",
};

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function NewCallScreen() {
  const router = useRouter();
  const startStoryCall = useStartStoryCall();

  const [screenState, setScreenState] = useState<ScreenState>("form");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [story, setStory] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood>("friendly");
  const [customMoodDesc, setCustomMoodDesc] = useState("");
  const [objective, setObjective] = useState("");

  // Contact picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const { data: contacts } = useContacts();

  const filteredContacts = (contacts ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      (c.phone ?? "").includes(contactSearch),
  );

  const { data: calls } = useCalls();
  const { data: activeCall } = useCall(activeCallId ?? "", {
    enabled: !!activeCallId && screenState === "calling",
    refetchInterval: screenState === "calling" ? 3000 : undefined,
  });

  // Pulsing ring animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (screenState !== "calling") {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.5,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [screenState]);

  // Elapsed timer
  useEffect(() => {
    if (screenState !== "calling") return;
    setElapsedSeconds(0);
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [screenState]);

  // Watch for call completion
  useEffect(() => {
    if (!activeCall) return;
    const terminal = ["completed", "failed", "no-answer"];
    if (terminal.includes(activeCall.status)) {
      setScreenState("summary");
    }
  }, [activeCall?.status]);

  function handleStartStoryCall() {
    setFormError(null);
    if (!selectedContact) {
      setFormError("Please select a contact to call");
      return;
    }
    if (!selectedContact.phone) {
      setFormError(`${selectedContact.name} has no phone number saved`);
      return;
    }
    if (story.trim().length < 10) {
      setFormError("Story must be at least 10 characters");
      return;
    }

    startStoryCall.mutate(
      {
        toNumber: selectedContact.phone,
        contactName: selectedContact.name,
        story: story.trim(),
        mood: selectedMood,
        customMoodDescription:
          selectedMood === "custom" && customMoodDesc.trim()
            ? customMoodDesc.trim()
            : undefined,
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
    setPickerOpen(false);
    setObjective("");
    setCustomMoodDesc("");
    setSelectedMood("friendly");
    setFormError(null);
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/dashboard" as Parameters<typeof router.replace>[0]);
    }
  }

  // ─── CALLING STATE ───────────────────────────────────────────
  if (screenState === "calling") {
    return (
      <View style={styles.screen}>
        <View style={styles.callingContainer}>
          <View style={styles.pulseWrapper}>
            <Animated.View
              style={[
                styles.pulseRing,
                { transform: [{ scale: pulseAnim }], opacity: pulseOpacity },
              ]}
            />
            <View style={styles.pulseCore}>
              <Ionicons name="call" size={44} color="#000" />
            </View>
          </View>

          <Text style={styles.callingStatusText}>CALL IN PROGRESS</Text>
          <Text style={styles.callingTarget} numberOfLines={1}>
            {selectedContact?.name ?? selectedContact?.phone ?? ""}
          </Text>
          <Text style={styles.callingMoodBadge}>{selectedMood.toUpperCase()} MODE</Text>
          <Text style={styles.callingTimer}>{formatDuration(elapsedSeconds)}</Text>

          <View style={styles.callingInfoCard}>
            <Text style={styles.callingInfoLabel}>STORY</Text>
            <Text style={styles.callingInfoText} numberOfLines={4}>
              {story}
            </Text>
            {objective.trim() ? (
              <>
                <Text style={[styles.callingInfoLabel, { marginTop: 14 }]}>OBJECTIVE</Text>
                <Text style={styles.callingInfoText}>{objective}</Text>
              </>
            ) : null}
          </View>

          <Text style={styles.callingWaitText}>Waiting for call to complete…</Text>
        </View>
      </View>
    );
  }

  // ─── SUMMARY STATE ───────────────────────────────────────────
  if (screenState === "summary" && activeCall) {
    const statusColor = STATUS_COLORS[activeCall.status] ?? "#9ca3af";
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>CALL SUMMARY</Text>

        <View style={[styles.summaryCard, { borderColor: statusColor }]}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{activeCall.status.toUpperCase()}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Ionicons name="call-outline" size={15} color="#6b7280" style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>TO</Text>
            <Text style={styles.summaryValue}>{activeCall.toNumber}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Ionicons name="time-outline" size={15} color="#6b7280" style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>DURATION</Text>
            <Text style={styles.summaryValue}>
              {activeCall.duration ? formatDuration(activeCall.duration) : "--:--"}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Ionicons name="flash-outline" size={15} color="#6b7280" style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>MOOD</Text>
            <Text style={styles.summaryValue}>{selectedMood.toUpperCase()}</Text>
          </View>

          {activeCall.summary ? (
            <View style={styles.summarySummarySection}>
              <Text style={styles.summarySectionTitle}>CALL SUMMARY</Text>
              <Text style={styles.summarySectionText}>{activeCall.summary}</Text>
            </View>
          ) : null}
        </View>

        <Pressable style={styles.newCallButton} onPress={handleNewCall}>
          <Ionicons name="add-circle-outline" size={18} color="#000" />
          <Text style={styles.newCallButtonText}>NEW STORY CALL</Text>
        </Pressable>

        <Pressable onPress={goBack} style={styles.backLinkCenter}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ─── FORM STATE ──────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={goBack} style={styles.backLinkTop}>
        <Text style={styles.backText}>← BACK</Text>
      </Pressable>

      <Text style={styles.title}>⚡ STORY CALL</Text>
      <Text style={styles.subtitle}>Call anyone with a custom script and speaking mood</Text>

      {/* ─ Story call form ─ */}
      <View style={styles.formCard}>
        <Text style={styles.label}>CALL TO *</Text>

        {/* Contact selector */}
        <Pressable
          style={[styles.contactSelector, pickerOpen && styles.contactSelectorOpen]}
          onPress={() => setPickerOpen((o) => !o)}
        >
          {selectedContact ? (
            <View style={styles.contactSelectorFilled}>
              <View style={styles.contactSelectorAvatar}>
                <Text style={styles.contactSelectorAvatarText}>
                  {selectedContact.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactSelectorName}>{selectedContact.name}</Text>
                {selectedContact.phone ? (
                  <Text style={styles.contactSelectorPhone}>{selectedContact.phone}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedContact(null);
                  setContactSearch("");
                  setPickerOpen(false);
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color="#6b7280" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.contactSelectorPlaceholder}>
              <Ionicons name="person-outline" size={16} color="#555" />
              <Text style={styles.contactSelectorPlaceholderText}>Select a contact…</Text>
            </View>
          )}
          <Ionicons
            name={pickerOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color="#555"
            style={{ marginLeft: 8 }}
          />
        </Pressable>

        {pickerOpen ? (
          <View style={styles.contactDropdown}>
            {/* Search inside dropdown */}
            <View style={styles.contactSearchRow}>
              <Ionicons name="search-outline" size={14} color="#555" />
              <TextInput
                style={styles.contactSearchInput}
                value={contactSearch}
                onChangeText={setContactSearch}
                placeholder="Search contacts…"
                placeholderTextColor="#555"
                autoCapitalize="none"
              />
            </View>

            {filteredContacts.length === 0 ? (
              <Text style={styles.contactDropdownEmpty}>
                {contacts?.length === 0 ? "No contacts saved" : "No matches"}
              </Text>
            ) : (
              filteredContacts.slice(0, 20).map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.contactDropdownRow}
                  onPress={() => {
                    setSelectedContact(c);
                    setPickerOpen(false);
                    setContactSearch("");
                  }}
                >
                  <View style={styles.contactDropdownAvatar}>
                    <Text style={styles.contactDropdownAvatarText}>
                      {c.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactDropdownName}>{c.name}</Text>
                    {c.phone ? (
                      <Text style={styles.contactDropdownPhone}>{c.phone}</Text>
                    ) : (
                      <Text style={styles.contactDropdownNoPhone}>No phone</Text>
                    )}
                  </View>
                  {selectedContact?.id === c.id ? (
                    <Ionicons name="checkmark-circle" size={16} color="#FBBF24" />
                  ) : null}
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        <Text style={styles.label}>STORY / CONTEXT *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={story}
          onChangeText={setStory}
          placeholder="What should I say? What am I selling or achieving? Give the full context..."
          placeholderTextColor="#555"
          multiline
          numberOfLines={4}
          maxLength={3000}
        />
        <Text style={styles.charCount}>{story.length} / 3000</Text>

        <Text style={styles.label}>MOOD *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.moodScroll}
          contentContainerStyle={styles.moodScrollContent}
        >
          {MOODS.map((m) => (
            <Pressable
              key={m.value}
              style={[styles.moodChip, selectedMood === m.value && styles.moodChipSelected]}
              onPress={() => setSelectedMood(m.value)}
            >
              <Ionicons
                name={m.icon}
                size={13}
                color={selectedMood === m.value ? "#000" : "#9ca3af"}
              />
              <Text
                style={[
                  styles.moodChipText,
                  selectedMood === m.value && styles.moodChipTextSelected,
                ]}
              >
                {m.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {selectedMood === "custom" ? (
          <>
            <Text style={styles.label}>DESCRIBE THE MOOD *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={customMoodDesc}
              onChangeText={setCustomMoodDesc}
              placeholder="e.g. Speak like a calm but assertive negotiator"
              placeholderTextColor="#555"
              multiline
            />
          </>
        ) : null}

        <Text style={styles.label}>OBJECTIVE (optional)</Text>
        <TextInput
          style={styles.input}
          value={objective}
          onChangeText={setObjective}
          placeholder="e.g. Get them to agree to a product demo"
          placeholderTextColor="#555"
          returnKeyType="done"
        />

        {formError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <Pressable
          style={[
            styles.startButton,
            startStoryCall.isPending && styles.startButtonDisabled,
          ]}
          onPress={handleStartStoryCall}
          disabled={startStoryCall.isPending}
        >
          <Ionicons name="call" size={18} color="#000" />
          <Text style={styles.startButtonText}>
            {startStoryCall.isPending ? "INITIATING…" : "START STORY CALL"}
          </Text>
        </Pressable>
      </View>

      {/* ─ Past calls ─ */}
      <Text style={styles.sectionTitle}>PAST CALLS</Text>
      <View style={styles.callsList}>
        {!calls || calls.length === 0 ? (
          <Text style={styles.muted}>No calls yet</Text>
        ) : (
          calls.slice(0, 15).map((c, idx) => (
            <Pressable
              key={c.id}
              style={[
                styles.callRow,
                idx === calls.slice(0, 15).length - 1 && styles.callRowLast,
              ]}
              onPress={() =>
                router.push(`/(app)/call/${c.id}` as Parameters<typeof router.push>[0])
              }
            >
              <View style={styles.callRowLeft}>
                <View
                  style={[
                    styles.callStatusDot,
                    { backgroundColor: STATUS_COLORS[c.status] ?? "#6b7280" },
                  ]}
                />
                <View>
                  <Text style={styles.callRowNumber}>{c.toNumber}</Text>
                  <Text style={styles.callRowMeta}>
                    {c.status.toUpperCase()}
                    {c.duration ? `  ·  ${formatDuration(c.duration)}` : ""}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#555" />
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { paddingHorizontal: 20, paddingVertical: 48, paddingBottom: 80 },

  backLinkTop: { alignSelf: "flex-start", marginBottom: 16 },
  backLinkCenter: { alignSelf: "center", marginTop: 4 },
  backText: { color: "#FBBF24", fontWeight: "900", fontSize: 14, letterSpacing: 0.5 },

  title: { fontSize: 26, fontWeight: "900", color: "#ffffff", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 24, lineHeight: 18 },

  // Form card
  formCard: {
    backgroundColor: "#111",
    borderWidth: 1.5,
    borderColor: "#FBBF24",
    borderRadius: 6,
    padding: 20,
    marginBottom: 32,
    shadowColor: "#FBBF24",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    color: "#9ca3af",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1.5,
    borderColor: "#2a2a2a",
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#fff",
    marginBottom: 16,
  },
  textArea: { minHeight: 96, textAlignVertical: "top" },
  charCount: {
    fontSize: 11,
    color: "#555",
    textAlign: "right",
    marginTop: -12,
    marginBottom: 16,
  },
  moodScroll: { marginBottom: 16 },
  moodScrollContent: { gap: 8, paddingRight: 8 },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: "#2a2a2a",
    borderRadius: 5,
    backgroundColor: "#1a1a1a",
  },
  moodChipSelected: { backgroundColor: "#FBBF24", borderColor: "#FBBF24" },
  moodChipText: { fontSize: 11, fontWeight: "800", color: "#9ca3af", letterSpacing: 0.5 },
  moodChipTextSelected: { color: "#000" },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1a0a0a",
    borderWidth: 1,
    borderColor: "#ef444440",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  errorText: { color: "#ef4444", fontSize: 13, fontWeight: "600", flex: 1 },

  startButton: {
    backgroundColor: "#FBBF24",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 5,
    marginTop: 8,
    shadowColor: "#FBBF24",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonDisabled: { opacity: 0.45 },
  startButtonText: { fontSize: 15, fontWeight: "900", color: "#000", letterSpacing: 1 },

  // Past calls
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  callsList: {
    backgroundColor: "#111",
    borderWidth: 1.5,
    borderColor: "#1e1e1e",
    borderRadius: 6,
    overflow: "hidden",
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  callRowLast: { borderBottomWidth: 0 },
  callRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  callStatusDot: { width: 8, height: 8, borderRadius: 4 },
  callRowNumber: { fontSize: 14, fontWeight: "700", color: "#fff" },
  callRowMeta: { fontSize: 11, color: "#6b7280", marginTop: 2, letterSpacing: 0.3 },
  muted: { color: "#555", fontSize: 13, padding: 16 },

  // ─── Calling state ───────────────────────────────────────────
  callingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#0a0a0a",
  },
  pulseWrapper: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
  },
  pulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#FBBF24",
  },
  pulseCore: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FBBF24",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FBBF24",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  callingStatusText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FBBF24",
    letterSpacing: 3,
    marginBottom: 10,
  },
  callingTarget: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 6,
    maxWidth: "90%",
    textAlign: "center",
  },
  callingMoodBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9ca3af",
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  callingTimer: {
    fontSize: 44,
    fontWeight: "900",
    color: "#FBBF24",
    marginBottom: 32,
    letterSpacing: 2,
  },
  callingInfoCard: {
    backgroundColor: "#111",
    borderWidth: 1.5,
    borderColor: "#1e1e1e",
    borderRadius: 6,
    padding: 16,
    width: "100%",
    marginBottom: 24,
  },
  callingInfoLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  callingInfoText: { fontSize: 13, color: "#d1d5db", lineHeight: 19 },
  callingWaitText: { fontSize: 12, color: "#444", textAlign: "center" },

  // ─── Summary state ───────────────────────────────────────────
  summaryCard: {
    backgroundColor: "#111",
    borderWidth: 2,
    borderRadius: 6,
    padding: 20,
    marginBottom: 20,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 3,
    marginBottom: 20,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1.5,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  summaryIcon: { marginRight: 8 },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1,
    flex: 1,
  },
  summaryValue: { fontSize: 14, fontWeight: "700", color: "#fff" },
  summarySummarySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1e1e1e",
  },
  summarySectionTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  summarySectionText: { fontSize: 13, color: "#d1d5db", lineHeight: 20 },
  newCallButton: {
    backgroundColor: "#FBBF24",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 5,
    marginBottom: 16,
    shadowColor: "#FBBF24",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  newCallButtonText: { fontSize: 14, fontWeight: "900", color: "#000", letterSpacing: 1 },

  // Contact picker
  contactSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderWidth: 1.5,
    borderColor: "#2a2a2a",
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 0,
  },
  contactSelectorOpen: {
    borderColor: "#FBBF24",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  contactSelectorFilled: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  contactSelectorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FBBF2430",
    borderWidth: 1,
    borderColor: "#FBBF2460",
    alignItems: "center",
    justifyContent: "center",
  },
  contactSelectorAvatarText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FBBF24",
  },
  contactSelectorName: { fontSize: 15, fontWeight: "700", color: "#fff" },
  contactSelectorPhone: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  contactSelectorPlaceholder: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactSelectorPlaceholderText: { fontSize: 15, color: "#555" },

  contactDropdown: {
    backgroundColor: "#161616",
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: "#FBBF24",
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    marginBottom: 16,
    maxHeight: 260,
    overflow: "hidden",
  },
  contactSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  contactSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#fff",
    paddingVertical: 0,
  },
  contactDropdownEmpty: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    paddingVertical: 20,
  },
  contactDropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
  },
  contactDropdownAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  contactDropdownAvatarText: { fontSize: 14, fontWeight: "800", color: "#9ca3af" },
  contactDropdownName: { fontSize: 14, fontWeight: "700", color: "#fff" },
  contactDropdownPhone: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  contactDropdownNoPhone: { fontSize: 12, color: "#444", marginTop: 1, fontStyle: "italic" },
});
