import { Pressable, View, Text, StyleSheet } from "react-native";
import type { Meeting } from "../../types/api.types";
import { formatDate } from "../../utils/date.utils";
import MeetingStatusBadge from "./MeetingStatusBadge";

type MeetingCardProps = {
  meeting: Meeting;
  onPress: () => void;
};

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function MeetingCard({ meeting, onPress }: MeetingCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1}>
          {meeting.title}
        </Text>
        <MeetingStatusBadge status={meeting.status} />
      </View>
      <Text style={styles.date}>{formatDate(meeting.startTime)}</Text>
      <Text style={styles.time}>{formatTimeRange(meeting.startTime, meeting.endTime)}</Text>
      <Text style={styles.attendees}>
        {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? "s" : ""}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#000000",
    borderRadius: 0,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 1, height: 1 },
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: "#000",
    flex: 1,
    marginRight: 8,
  },
  date: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  attendees: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "700",
  },
});
