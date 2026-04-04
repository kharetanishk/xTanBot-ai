import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  useMeeting,
  useCancelMeeting,
  useMeetingSummary,
} from "../../../src/hooks/useMeetings";
import { formatDate, formatTime, formatDuration } from "../../../src/utils/date.utils";
import MeetingStatusBadge from "../../../src/components/meetings/MeetingStatusBadge";
import AttendeeChip from "../../../src/components/meetings/AttendeeChip";
import Button from "../../../src/components/common/Button";

function meetingDurationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

export default function MeetingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: meeting, isLoading } = useMeeting(id ?? "");
  const { data: summaryData, isLoading: summaryLoading } = useMeetingSummary(
    id ?? "",
  );
  const cancelMeeting = useCancelMeeting(id ?? "");

  const canCancel =
    meeting &&
    (meeting.status === "scheduled" || meeting.status === "confirmed");

  function handleCancel() {
    Alert.alert(
      "Cancel meeting",
      "Are you sure you want to cancel this meeting?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: () => {
            cancelMeeting.mutate(undefined, {
              onSuccess: () => router.back(),
            });
          },
        },
      ],
    );
  }

  if (isLoading || !meeting) {
    return (
      <View style={styles.screen}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>
        <View style={styles.skeleton} />
      </View>
    );
  }

  const durationMins = meetingDurationMinutes(meeting.startTime, meeting.endTime);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← BACK</Text>
      </Pressable>

      <Text style={styles.pageTitle} numberOfLines={1}>
        {meeting.title}
      </Text>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <MeetingStatusBadge status={meeting.status} />
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>DATE</Text>
          <Text style={styles.value}>{formatDate(meeting.startTime)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>START</Text>
          <Text style={styles.value}>{formatTime(meeting.startTime)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>END</Text>
          <Text style={styles.value}>{formatTime(meeting.endTime)}</Text>
        </View>
        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.label}>DURATION</Text>
          <Text style={styles.value}>{formatDuration(durationMins * 60)}</Text>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardTitle}>ATTENDEES</Text>
        <View style={styles.chips}>
          {meeting.attendees.length === 0 ? (
            <Text style={styles.muted}>No attendees</Text>
          ) : (
            meeting.attendees.map((email) => (
              <AttendeeChip key={email} email={email} />
            ))
          )}
        </View>
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardTitle}>CALL SUMMARY</Text>

        {summaryLoading ? (
          <View style={styles.skeleton} />
        ) : !summaryData?.hasSummary ? (
          <View style={styles.emptySummary}>
            <Text style={styles.emptySummaryEmoji}>📋</Text>
            <Text style={styles.emptySummaryTitle}>NO SUMMARY YET</Text>
            <Text style={styles.emptySummaryText}>
              Summary will appear here after the AI completes the meeting call.
            </Text>
          </View>
        ) : (
          <View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{summaryData.summary}</Text>
            </View>

            {summaryData.callDuration != null ? (
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statChipLabel}>DURATION</Text>
                  <Text style={styles.statChipValue}>
                    {formatDuration(summaryData.callDuration)}
                  </Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statChipLabel}>STATUS</Text>
                  <Text style={styles.statChipValue}>
                    {(summaryData.callStatus ?? "").toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : null}

            {summaryData.transcript.length > 0 ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.transcriptTitle}>CALL TRANSCRIPT</Text>
                {summaryData.transcript.map((msg, i) => (
                  <View
                    key={`${msg.role}-${msg.createdAt}-${i}`}
                    style={[
                      styles.transcriptBubble,
                      msg.role === "assistant"
                        ? styles.aiBubble
                        : styles.userBubble,
                    ]}
                  >
                    <Text style={styles.transcriptRole}>
                      {msg.role === "assistant" ? "🤖 AI" : "👤 USER"}
                    </Text>
                    <Text style={styles.transcriptContent}>{msg.content}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>

      {canCancel && (
        <View style={[styles.dangerCard, { marginTop: 24 }]}>
          <Button
            title="CANCEL MEETING"
            variant="danger"
            onPress={handleCancel}
            loading={cancelMeeting.isPending}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { paddingHorizontal: 24, paddingVertical: 48, paddingBottom: 48 },
  backButton: { alignSelf: "flex-start" },
  backText: { color: "#FBBF24", fontWeight: "900", fontSize: 14 },
  pageTitle: {
    fontSize: 24,
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
  statusRow: { marginBottom: 16 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
    marginBottom: 12,
  },
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
  chips: { flexDirection: "row", flexWrap: "wrap" },
  muted: { fontSize: 13, color: "#6b7280" },
  dangerCard: {
    borderWidth: 3,
    borderColor: "#ef4444",
    borderRadius: 0,
    padding: 24,
    backgroundColor: "#fff",
  },
  skeleton: {
    backgroundColor: "#1a1a1a",
    height: 200,
    borderWidth: 3,
    borderColor: "#333",
    borderRadius: 0,
    marginTop: 24,
  },
  emptySummary: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptySummaryEmoji: { fontSize: 32, marginBottom: 8 },
  emptySummaryTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
  },
  emptySummaryText: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  summaryBox: {
    backgroundColor: "#f9f9f9",
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 0,
    padding: 16,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 15,
    color: "#000",
    lineHeight: 22,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  statChip: {
    flex: 1,
    backgroundColor: "#FBBF24",
    borderWidth: 2,
    borderColor: "#000",
    padding: 8,
    alignItems: "center",
  },
  statChipLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
  },
  statChipValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#000",
    marginTop: 2,
  },
  transcriptTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 8,
  },
  transcriptBubble: {
    borderWidth: 2,
    borderColor: "#000",
    padding: 10,
    marginBottom: 8,
  },
  aiBubble: { backgroundColor: "#ffffff" },
  userBubble: { backgroundColor: "#FBBF24" },
  transcriptRole: {
    fontSize: 11,
    fontWeight: "900",
    color: "#000",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  transcriptContent: {
    fontSize: 14,
    color: "#000",
    lineHeight: 20,
  },
});
