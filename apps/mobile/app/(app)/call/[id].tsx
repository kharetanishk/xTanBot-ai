import { useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCall } from "../../../src/hooks/useCalls";
import { formatDate, formatTime, formatDuration } from "../../../src/utils/date.utils";
import StatusBadge from "../../../src/components/calls/StatusBadge";
import Button from "../../../src/components/common/Button";

export default function CallDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: call, isLoading, refetch } = useCall(id ?? "");

  const isActive =
    call &&
    (call.status === "in-progress" ||
      call.status === "ringing" ||
      call.status === "initiated");

  useEffect(() => {
    if (!call || !isActive) return;
    const t = setInterval(refetch, 3000);
    return () => clearInterval(t);
  }, [call?.id, call?.status, isActive, refetch]);

  if (isLoading || !call) {
    return (
      <View style={styles.screen}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>
        <View style={styles.skeleton} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={undefined}
    >
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← BACK</Text>
      </Pressable>

      <Text style={styles.title}>CALL DETAIL</Text>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <StatusBadge status={call.status} />
        </View>
        <Text style={styles.mono}>{call.callSid}</Text>
        {call.duration != null && (
          <Text style={styles.duration}>
            Duration: {formatDuration(call.duration)}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>DATE / TIME</Text>
          <Text style={styles.value}>
            {formatDate(call.createdAt)} {formatTime(call.createdAt)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>STATUS</Text>
          <Text style={styles.value}>{call.status}</Text>
        </View>
        {call.duration != null && (
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>DURATION</Text>
            <Text style={styles.value}>{formatDuration(call.duration)}</Text>
          </View>
        )}
      </View>

      {call.summary ? (
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={styles.cardTitle}>AI SUMMARY</Text>
          <Text style={styles.summaryText}>{call.summary}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <Button
          title="VIEW CONVERSATION"
          variant="secondary"
          onPress={() => router.push(`/(app)/chat/${call.id}`)}
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
  statusRow: { marginBottom: 12 },
  mono: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
  },
  duration: { fontSize: 16, fontWeight: "700", color: "#000" },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
    marginBottom: 12,
  },
  summaryText: { fontSize: 14, color: "#000", lineHeight: 20 },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#f0f0f0",
  },
  label: {
    fontSize: 11,
    color: "#999",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  value: { fontSize: 16, fontWeight: "700", color: "#000" },
  skeleton: {
    backgroundColor: "#1a1a1a",
    height: 200,
    borderWidth: 3,
    borderColor: "#333",
    borderRadius: 0,
    marginTop: 24,
  },
});
