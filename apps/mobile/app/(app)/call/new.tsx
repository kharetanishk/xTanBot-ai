import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useInitiateCall } from "../../../src/hooks/useCalls";
import { useContacts } from "../../../src/hooks/useContacts";
import { parseError } from "../../../src/utils/error.utils";
import { isValidE164 } from "../../../src/utils/phone.utils";
import Button from "../../../src/components/common/Button";
import ErrorMessage from "../../../src/components/common/ErrorMessage";

type Mood = "friendly" | "sales" | "rude" | "intellectual" | "influencing" | "custom";

const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: "friendly", label: "FRIENDLY", emoji: "😊" },
  { value: "sales", label: "SALES", emoji: "💼" },
  { value: "rude", label: "RUDE", emoji: "😤" },
  { value: "intellectual", label: "INTELLECTUAL", emoji: "🎓" },
  { value: "influencing", label: "INFLUENCING", emoji: "🎯" },
  { value: "custom", label: "CUSTOM", emoji: "⚡" },
];

export default function NewCallScreen() {
  const router = useRouter();
  const initiateCall = useInitiateCall();
  const { data: contacts } = useContacts();

  // Direct call state
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Story call state
  const [storyTarget, setStoryTarget] = useState("");
  const [story, setStory] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood>("friendly");
  const [customMoodDesc, setCustomMoodDesc] = useState("");
  const [objective, setObjective] = useState("");
  const [storyError, setStoryError] = useState<string | null>(null);

  const trimmed = phone.trim();

  function handleCall() {
    setError(null);
    if (!trimmed) {
      setError("Enter a phone number");
      return;
    }
    if (!isValidE164(trimmed)) {
      setError("Phone must be E.164 (e.g. +1234567890)");
      return;
    }
    initiateCall.mutate(
      { toNumber: trimmed },
      {
        onSuccess: (call) => router.replace(`/(app)/call/${call.id}`),
        onError: (err) => setError(parseError(err)),
      },
    );
  }

  function handleSelectContact(contactPhone: string) {
    if (contactPhone) setPhone(contactPhone);
  }

  function handleStartStoryCall() {
    setStoryError(null);
    if (!storyTarget.trim()) {
      setStoryError("Please enter a name or phone number to call");
      return;
    }
    if (story.trim().length < 10) {
      setStoryError("Story must be at least 10 characters");
      return;
    }

    const moodPart = selectedMood === "custom" && customMoodDesc.trim()
      ? `custom mood: ${customMoodDesc.trim()}`
      : selectedMood;
    const objectivePart = objective.trim()
      ? ` Objective: ${objective.trim()}.`
      : "";

    const prefill =
      `Call ${storyTarget.trim()} with this story in ${moodPart} mode: ` +
      `${story.trim()}.${objectivePart}`;

    // Navigate to Chat tab with pre-filled message to trigger story_call tool
    router.replace({
      pathname: "/(app)/dashboard/chat",
      params: { prefill },
    } as Parameters<typeof router.replace>[0]);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← BACK</Text>
      </Pressable>

      <Text style={styles.title}>NEW CALL</Text>

      {/* ── Direct call card ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ENTER PHONE NUMBER</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+1234567890"
          placeholderTextColor="#666"
          keyboardType="phone-pad"
        />
        <ErrorMessage message={error} />
        <Button
          title="CALL"
          onPress={handleCall}
          loading={initiateCall.isPending}
        />
      </View>

      <Text style={styles.sectionTitle}>OR SELECT CONTACT</Text>
      <View style={styles.contactsCard}>
        {contacts?.length === 0 ? (
          <Text style={styles.muted}>No contacts</Text>
        ) : (
          (contacts ?? []).map((c) => (
            <Pressable
              key={c.id}
              style={styles.contactRow}
              onPress={() => c.phone && handleSelectContact(c.phone)}
            >
              <Text style={styles.contactName}>{c.name}</Text>
              {c.phone ? (
                <Text style={styles.contactPhone}>{c.phone}</Text>
              ) : (
                <Text style={styles.muted}>No phone</Text>
              )}
            </Pressable>
          ))
        )}
      </View>

      {/* ── Story call card ── */}
      <View style={styles.divider} />

      <View style={styles.storyCard}>
        <Text style={styles.storyCardTitle}>⚡ STORY CALL</Text>
        <Text style={styles.storyCardSub}>
          Call with a custom script and mood — for sales, pitches, or any scripted conversation
        </Text>

        <Text style={styles.label}>CALL TO *</Text>
        <TextInput
          style={styles.input}
          value={storyTarget}
          onChangeText={setStoryTarget}
          placeholder="Contact name or +91XXXXXXXXXX"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>STORY / CONTEXT *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={story}
          onChangeText={setStory}
          placeholder={"What should I say? What am I selling or achieving?\nGive the full context..."}
          placeholderTextColor="#666"
          multiline
          numberOfLines={4}
          maxLength={3000}
        />
        <Text style={styles.charCount}>{story.length}/3000</Text>

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
              style={[
                styles.moodChip,
                selectedMood === m.value && styles.moodChipSelected,
              ]}
              onPress={() => setSelectedMood(m.value)}
            >
              <Text
                style={[
                  styles.moodChipText,
                  selectedMood === m.value && styles.moodChipTextSelected,
                ]}
              >
                {m.emoji} {m.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {selectedMood === "custom" && (
          <>
            <Text style={styles.label}>DESCRIBE THE MOOD *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={customMoodDesc}
              onChangeText={setCustomMoodDesc}
              placeholder="e.g. Speak like a calm but assertive negotiator"
              placeholderTextColor="#666"
              multiline
            />
          </>
        )}

        <Text style={styles.label}>OBJECTIVE (optional)</Text>
        <TextInput
          style={styles.input}
          value={objective}
          onChangeText={setObjective}
          placeholder="What should I achieve? e.g. Get them to agree to a demo"
          placeholderTextColor="#666"
          returnKeyType="done"
        />

        <ErrorMessage message={storyError} />

        <Pressable style={styles.storyCallButton} onPress={handleStartStoryCall}>
          <Text style={styles.storyCallButtonText}>⚡ START STORY CALL</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { paddingHorizontal: 24, paddingVertical: 48, paddingBottom: 64 },
  backButton: { alignSelf: "flex-start" },
  backText: { color: "#FBBF24", fontWeight: "900", fontSize: 14 },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    padding: 24,
    marginBottom: 24,
    shadowOffset: { width: 6, height: 6 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 12,
  },
  contactsCard: {
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    padding: 16,
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  contactRow: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#f0f0f0",
  },
  contactName: { fontSize: 16, fontWeight: "800", color: "#000" },
  contactPhone: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  muted: { fontSize: 13, color: "#6b7280" },

  // Story call styles
  divider: {
    height: 3,
    backgroundColor: "#FBBF24",
    marginVertical: 32,
  },
  storyCard: {
    backgroundColor: "#111111",
    borderWidth: 3,
    borderColor: "#FBBF24",
    borderRadius: 0,
    padding: 24,
    shadowOffset: { width: 6, height: 6 },
    shadowColor: "#FBBF24",
    shadowOpacity: 0.4,
    shadowRadius: 0,
    elevation: 6,
  },
  storyCardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FBBF24",
    letterSpacing: 1,
    marginBottom: 4,
  },
  storyCardSub: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 20,
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    color: "#9ca3af",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "right",
    marginTop: -12,
    marginBottom: 16,
  },
  moodScroll: {
    marginBottom: 16,
  },
  moodScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  moodChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: "#374151",
    borderRadius: 0,
    backgroundColor: "#1f2937",
  },
  moodChipSelected: {
    backgroundColor: "#FBBF24",
    borderColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  moodChipText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#9ca3af",
    letterSpacing: 0.5,
  },
  moodChipTextSelected: {
    color: "#000",
  },
  storyCallButton: {
    backgroundColor: "#FBBF24",
    borderWidth: 3,
    borderColor: "#000",
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowOffset: { width: 4, height: 4 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  storyCallButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
  },
});
