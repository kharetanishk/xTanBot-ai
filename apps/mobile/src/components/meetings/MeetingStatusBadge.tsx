import { View, Text, StyleSheet } from "react-native";

type MeetingStatus = "scheduled" | "confirmed" | "cancelled" | "completed" | "rescheduled";

const statusColors: Record<MeetingStatus, string> = {
  scheduled: "#FBBF24",
  confirmed: "#22c55e",
  cancelled: "#ef4444",
  completed: "#6b7280",
  rescheduled: "#6366f1",
};

type MeetingStatusBadgeProps = {
  status: MeetingStatus;
};

export default function MeetingStatusBadge({ status }: MeetingStatusBadgeProps) {
  const bg = statusColors[status] ?? "#6b7280";
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.text}>{status.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 0,
  },
  text: {
    fontSize: 10,
    fontWeight: "900",
    color: "#000",
  },
});
