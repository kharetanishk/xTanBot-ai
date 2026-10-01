import { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type TextInput as TextInputType,
} from "react-native";
import { useRouter } from "expo-router";
import { useCreateContact } from "../../../src/hooks/useContacts";
import { parseError } from "../../../src/utils/error.utils";
import Button from "../../../src/components/common/Button";
import Input from "../../../src/components/common/Input";
import ErrorMessage from "../../../src/components/common/ErrorMessage";

export default function NewContactScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900; // desktop: centered card, fields in two columns
  const row = wide ? styles.row : undefined;
  const col = wide ? styles.col : undefined;
  const createContact = useCreateContact();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const phoneRef = useRef<TextInputType>(null);
  const emailRef = useRef<TextInputType>(null);
  const companyRef = useRef<TextInputType>(null);
  const notesRef = useRef<TextInputType>(null);

  function handleSave() {
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    createContact.mutate(
      {
        name: name.trim(),
        ...(phone.trim() && { phone: phone.trim() }),
        ...(email.trim() && { email: email.trim() }),
        ...(company.trim() && { company: company.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
      },
      {
        onSuccess: () => router.back(),
        onError: (err) => setError(parseError(err)),
      },
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, wide && styles.contentWide]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>

        <Text style={styles.title}>NEW CONTACT</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>CONTACT DETAILS</Text>

          <View style={row}>
            <View style={col}>
              <Input
                label="FULL NAME *"
                value={name}
                onChangeText={setName}
                placeholder="Jane Doe"
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
            </View>
            <View style={col}>
              <Input
                label="PHONE NUMBER"
                value={phone}
                onChangeText={setPhone}
                placeholder="+91XXXXXXXXXX"
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
          </View>

          <View style={row}>
            <View style={col}>
              <Input
                label="EMAIL"
                value={email}
                onChangeText={setEmail}
                placeholder="jane@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => companyRef.current?.focus()}
              />
            </View>
            <View style={col}>
              <Input
                label="COMPANY"
                value={company}
                onChangeText={setCompany}
                placeholder="Acme Inc."
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => notesRef.current?.focus()}
              />
            </View>
          </View>

          <Input
            label="NOTES"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes..."
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <ErrorMessage message={error} />

          <View style={wide ? styles.saveWide : undefined}>
            <Button
              title="SAVE CONTACT"
              onPress={handleSave}
              loading={createContact.isPending}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  contentWide: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    gap: 20,
  },
  col: {
    flex: 1,
  },
  saveWide: {
    alignSelf: "flex-end",
    minWidth: 240,
  },
  backButton: {
    alignSelf: "flex-start",
  },
  backText: {
    color: "#FBBF24",
    fontWeight: "800",
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 16,
    padding: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#f9fafb",
    letterSpacing: 2,
    marginBottom: 24,
  },
});
