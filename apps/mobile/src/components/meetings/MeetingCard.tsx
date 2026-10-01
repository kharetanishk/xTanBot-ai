import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Meeting } from "../../types/api.types";
import MeetingStatusBadge from "./MeetingStatusBadge";
import { Card } from "../ui";
import { colors, radius } from "../../theme";

const t = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export default function MeetingCard({ meeting, onPress }: { meeting: Meeting; onPress: () => void }) {
  const start = new Date(meeting.startTime);
  const n = meeting.attendees.length;

  return (
    <Card onPress={onPress} style={s.card}>
      {/* Calendar-style date block */}
      <View style={s.date}>
        <Text style={s.month}>{start.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}</Text>
        <Text style={s.day}>{start.getDate()}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>
          {meeting.title}
        </Text>
        <View style={s.metaRow}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={s.meta}>
            {t(meeting.startTime)} – {t(meeting.endTime)}
          </Text>
        </View>
        <View style={s.metaRow}>
          <Ionicons name="people-outline" size={13} color={colors.textMuted} />
          <Text style={s.meta}>
            {n} attendee{n !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
      <MeetingStatusBadge status={meeting.status} />
    </Card>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 10, padding: 14 },
  date: {
    width: 52,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  month: { color: colors.info, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  day: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: -1 },
  body: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { color: colors.textMuted, fontSize: 13 },
});
