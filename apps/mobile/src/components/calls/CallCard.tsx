import { useState } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import type { Call } from "../../types/api.types";
import StatusBadge from "./StatusBadge";
import { formatDate } from "../../utils/date.utils";
import { formatDuration } from "../../utils/date.utils";

type CallCardProps = {
  call: Call;
  onPress: () => void;
};

export default function CallCard({ call, onPress }: CallCardProps) {
  const [pressed, setPressed] = useState(false);
  const isActive =
    call.status === "in-progress" || call.status === "ringing" || call.status === "initiated";

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.card,
        isActive && styles.cardActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.left}>
        <StatusBadge status={call.status} />
        <Text style={styles.sid} numberOfLines={1}>
          {call.callSid.slice(-12)}
        </Text>
      </View>
      <View style={styles.center}>
        <Text style={styles.date}>{formatDate(call.createdAt)}</Text>
      </View>
      <View style={styles.right}>
        {call.duration != null && (
          <Text style={styles.duration}>
            {formatDuration(call.duration)}
          </Text>
        )}
        <Text style={styles.arrow}>→</Text>
      </View>
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
    flexDirection: "row",
    alignItems: "center",
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  cardActive: {
    backgroundColor: "#FEF3C7",
  },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 1, height: 1 },
  },
  left: {
    flex: 1,
    gap: 4,
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sid: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#6b7280",
  },
  date: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  duration: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  arrow: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FBBF24",
  },
});
