import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Contact } from "../../types/api.types";
import ContactAvatar from "./ContactAvatar";
import { Card } from "../ui";
import { colors } from "../../theme";

export default function ContactCard({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  const detail = contact.phone || contact.email;
  return (
    <Card onPress={onPress} style={s.card}>
      <ContactAvatar name={contact.name} size={44} />
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>
          {contact.name}
        </Text>
        {detail ? (
          <Text style={s.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
        {contact.company ? (
          <Text style={s.company} numberOfLines={1}>
            {contact.company}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
    </Card>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, padding: 14 },
  info: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: "700" },
  detail: { color: colors.textMuted, fontSize: 13 },
  company: { color: colors.textSubtle, fontSize: 12 },
});
