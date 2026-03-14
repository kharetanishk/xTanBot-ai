import { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← BACK</Text>
        </Pressable>

        <Text style={styles.title}>NEW CONTACT</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>CONTACT DETAILS</Text>

          <Input
            label="FULL NAME *"
            value={name}
            onChangeText={setName}
            placeholder="Jane Doe"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />

          <Input
            label="PHONE NUMBER"
            value={phone}
            onChangeText={setPhone}
            placeholder="+91XXXXXXXXXX"
            keyboardType="phone-pad"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />

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

          <Input
            label="COMPANY"
            value={company}
            onChangeText={setCompany}
            placeholder="Acme Inc."
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => notesRef.current?.focus()}
          />

          <Input
            label="NOTES"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes..."
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <ErrorMessage message={error} />

          <Button
            title="SAVE CONTACT"
            onPress={handleSave}
            loading={createContact.isPending}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  backButton: {
    alignSelf: "flex-start",
  },
  backText: {
    color: "#FBBF24",
    fontWeight: "900",
    fontSize: 14,
  },
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
    borderColor: "#000000",
    borderRadius: 0,
    padding: 24,
    shadowOffset: { width: 6, height: 6 },
    shadowColor: "#000000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000000",
    letterSpacing: 2,
    marginBottom: 24,
  },
});
