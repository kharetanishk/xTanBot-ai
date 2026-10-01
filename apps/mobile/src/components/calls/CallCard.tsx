import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Call } from "../../types/api.types";
import StatusBadge, { CALL_STATUS_TONE } from "./StatusBadge";
import { formatDate, formatDuration } from "../../utils/date.utils";
import { Card, IconTile } from "../ui";
import { colors } from "../../theme";

export default function CallCard({ call, onPress }: { call: Call; onPress: () => void }) {
  const tone = CALL_STATUS_TONE[call.status] ?? "neutral";
  const meta = [formatDate(call.createdAt), call.duration != null ? formatDuration(call.duration) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card onPress={onPress} style={s.card}>
      <IconTile icon={tone === "danger" ? "call-outline" : "call"} tone={tone} size={42} />
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>
          {call.toNumber || "Unknown number"}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {meta}
        </Text>
        {call.summary ? (
          <Text style={s.summary} numberOfLines={1}>
            {call.summary}
          </Text>
        ) : null}
      </View>
      <View style={s.right}>
        <StatusBadge status={call.status} />
        <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, padding: 14 },
  body: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 13 },
  summary: { color: colors.textSubtle, fontSize: 12, marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
});
