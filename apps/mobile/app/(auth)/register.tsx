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
import { useRegister } from "../../src/hooks/useAuth";
import { parseError } from "../../src/utils/error.utils";
import Button from "../../src/components/common/Button";
import Input from "../../src/components/common/Input";
import ErrorMessage from "../../src/components/common/ErrorMessage";

export default function RegisterScreen() {
  const router = useRouter();
  const register = useRegister();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const emailRef = useRef<TextInputType>(null);
  const passwordRef = useRef<TextInputType>(null);
  const confirmRef = useRef<TextInputType>(null);

  function handleRegister() {
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    register.mutate(
      { name: name.trim(), email: email.trim(), password },
      {
        onSuccess: () => router.replace("/(app)/(tabs)"),
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

        <View style={styles.header}>
          <Text style={styles.logo}>xTanBot</Text>
          <Text style={styles.subtitle}>AI VOICE ASSISTANT</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>CREATE ACCOUNT</Text>

          <Input
            label="FULL NAME"
            value={name}
            onChangeText={setName}
            placeholder="Jane Doe"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />

          <Input
            label="EMAIL"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <Input
            label="PASSWORD"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />

          <Input
            label="CONFIRM PASSWORD"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          <ErrorMessage message={error} />

          <Button
            title="CREATE ACCOUNT"
            onPress={handleRegister}
            loading={register.isPending}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.footerLink}>SIGN IN →</Text>
          </Pressable>
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
    marginBottom: 24,
  },
  backText: {
    color: "#FBBF24",
    fontWeight: "900",
    fontSize: 14,
  },
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  logo: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FBBF24",
    letterSpacing: -2,
  },
  subtitle: {
    fontSize: 14,
    color: "#888888",
    fontWeight: "600",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginTop: 4,
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
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000000",
    letterSpacing: 2,
    marginBottom: 24,
  },
  footer: {
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    color: "#888888",
    fontSize: 14,
    textAlign: "center",
  },
  footerLink: {
    color: "#FBBF24",
    fontWeight: "900",
    fontSize: 14,
  },
});
