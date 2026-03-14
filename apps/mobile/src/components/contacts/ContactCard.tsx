import { useState } from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import type { Contact } from "../../types/api.types";
import ContactAvatar from "./ContactAvatar";

type ContactCardProps = {
  contact: Contact;
  onPress: () => void;
};

export default function ContactCard({ contact, onPress }: ContactCardProps) {
  const [pressed, setPressed] = useState(false);
  const detail = contact.phone || contact.email;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.card, pressed && styles.pressed]}
    >
      <ContactAvatar name={contact.name} size={44} />
      <View style={styles.info}>
        <Text style={styles.name}>{contact.name}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        {contact.company ? (
          <Text style={styles.company}>{contact.company}</Text>
        ) : null}
      </View>
      <Text style={styles.arrow}>→</Text>
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
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 1, height: 1 },
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
  },
  detail: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    marginTop: 2,
  },
  company: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
    marginTop: 2,
  },
  arrow: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FBBF24",
  },
});
