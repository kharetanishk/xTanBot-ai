import { View, Text, StyleSheet } from "react-native";
import type { Call } from "../../types/api.types";

const STATUS_COLORS: Record<
  Call["status"],
  { bg: string; text: string }
> = {
  "in-progress": { bg: "#22c55e", text: "#000" },
  completed: { bg: "#6b7280", text: "#fff" },
  failed: { bg: "#ef4444", text: "#fff" },
  busy: { bg: "#ef4444", text: "#fff" },
  "no-answer": { bg: "#ef4444", text: "#fff" },
  initiated: { bg: "#FBBF24", text: "#000" },
  ringing: { bg: "#FBBF24", text: "#000" },
};

type StatusBadgeProps = {
  status: Call["status"];
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { bg, text } = STATUS_COLORS[status] ?? {
    bg: "#6b7280",
    text: "#fff",
  };
  const label = status.replace("-", " ").toUpperCase();

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 0,
  },
  text: {
    fontWeight: "900",
    fontSize: 11,
  },
});
