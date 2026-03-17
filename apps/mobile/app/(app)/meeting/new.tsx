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
import { useCreateMeeting } from "../../../src/hooks/useMeetings";
import { useAuthStore } from "../../../src/stores/auth.store";
import { parseError } from "../../../src/utils/error.utils";
import Button from "../../../src/components/common/Button";
import ErrorMessage from "../../../src/components/common/ErrorMessage";

function toISODate(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dte = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0);
  return dte.toISOString();
}

export default function NewMeetingScreen() {
  const router = useRouter();
  const createMeeting = useCreateMeeting();
  const token = useAuthStore((s) => s.token);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [attendeesStr, setAttendeesStr] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    if (!token) {
      setError("You must be logged in to create a meeting");
      return;
    }
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!date.trim()) {
      setError("Date is required (YYYY-MM-DD)");
      return;
    }
    if (!startTime.trim()) {
      setError("Start time is required (HH:MM)");
      return;
    }
    if (!endTime.trim()) {
      setError("End time is required (HH:MM)");
      return;
    }
    const start = toISODate(date, startTime);
    const end = toISODate(date, endTime);
    if (new Date(end) <= new Date(start)) {
      setError("End time must be after start time");
      return;
    }
    const attendees = attendeesStr
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    createMeeting.mutate(
      { title: title.trim(), startTime: start, endTime: end, attendees },
      {
        onSuccess: () => router.back(),
        onError: (err) => setError(parseError(err)),
      },
    );
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

      <Text style={styles.title}>NEW MEETING</Text>

      <View style={styles.card}>
        <Text style={styles.label}>TITLE *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Meeting title"
          placeholderTextColor="#666"
        />
        <Text style={styles.label}>DATE (YYYY-MM-DD) *</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="2025-03-14"
          placeholderTextColor="#666"
        />
        <Text style={styles.label}>START TIME (HH:MM) *</Text>
        <TextInput
          style={styles.input}
          value={startTime}
          onChangeText={setStartTime}
          placeholder="14:00"
          placeholderTextColor="#666"
        />
        <Text style={styles.label}>END TIME (HH:MM) *</Text>
        <TextInput
          style={styles.input}
          value={endTime}
          onChangeText={setEndTime}
          placeholder="15:00"
          placeholderTextColor="#666"
        />
        <Text style={styles.label}>ATTENDEES (comma-separated emails)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={attendeesStr}
          onChangeText={setAttendeesStr}
          placeholder="a@x.com, b@y.com"
          placeholderTextColor="#666"
          multiline
        />
        <ErrorMessage message={error} />
        <Button
          title="CREATE MEETING"
          onPress={handleCreate}
          loading={createMeeting.isPending}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { paddingHorizontal: 24, paddingVertical: 48, paddingBottom: 48 },
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
    shadowOffset: { width: 6, height: 6 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
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
  },
  textArea: { minHeight: 72 },
});
