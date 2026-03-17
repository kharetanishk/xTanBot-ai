import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useInitiateCall } from "../../../src/hooks/useCalls";
import { useContacts } from "../../../src/hooks/useContacts";
import { parseError } from "../../../src/utils/error.utils";
import { isValidE164 } from "../../../src/utils/phone.utils";
import Button from "../../../src/components/common/Button";
import ErrorMessage from "../../../src/components/common/ErrorMessage";

export default function NewCallScreen() {
  const router = useRouter();
  const initiateCall = useInitiateCall();
  const { data: contacts } = useContacts();

  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmed = phone.trim();

  function handleCall() {
    setError(null);
    if (!trimmed) {
      setError("Enter a phone number");
      return;
    }
    if (!isValidE164(trimmed)) {
      setError("Phone must be E.164 (e.g. +1234567890)");
      return;
    }
    initiateCall.mutate(
      { toNumber: trimmed },
      {
        onSuccess: (call) => router.replace(`/(app)/call/${call.id}`),
        onError: (err) => setError(parseError(err)),
      },
    );
  }

  function handleSelectContact(contactPhone: string) {
    if (contactPhone) setPhone(contactPhone);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← BACK</Text>
      </Pressable>

      <Text style={styles.title}>NEW CALL</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>ENTER PHONE NUMBER</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+1234567890"
          placeholderTextColor="#666"
          keyboardType="phone-pad"
        />
        <ErrorMessage message={error} />
        <Button
          title="CALL"
          onPress={handleCall}
          loading={initiateCall.isPending}
        />
      </View>

      <Text style={styles.sectionTitle}>OR SELECT CONTACT</Text>
      <View style={styles.contactsCard}>
        {contacts?.length === 0 ? (
          <Text style={styles.muted}>No contacts</Text>
        ) : (
          (contacts ?? []).map((c) => (
            <Pressable
              key={c.id}
              style={styles.contactRow}
              onPress={() => c.phone && handleSelectContact(c.phone)}
            >
              <Text style={styles.contactName}>{c.name}</Text>
              {c.phone ? (
                <Text style={styles.contactPhone}>{c.phone}</Text>
              ) : (
                <Text style={styles.muted}>No phone</Text>
              )}
            </Pressable>
          ))
        )}
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
    marginBottom: 24,
    shadowOffset: { width: 6, height: 6 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 12,
  },
  contactsCard: {
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    padding: 16,
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  contactRow: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#f0f0f0",
  },
  contactName: { fontSize: 16, fontWeight: "800", color: "#000" },
  contactPhone: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  muted: { fontSize: 13, color: "#6b7280" },
});
