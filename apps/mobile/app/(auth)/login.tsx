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
import { useLogin } from "../../src/hooks/useAuth";
import { parseError } from "../../src/utils/error.utils";
import Button from "../../src/components/common/Button";
import Input from "../../src/components/common/Input";
import ErrorMessage from "../../src/components/common/ErrorMessage";

export default function LoginScreen() {
  const router = useRouter();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<TextInputType>(null);

  function handleLogin() {
    setError(null);
    login.mutate(
      { email: email.trim(), password },
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
        <View style={styles.header}>
          <Text style={styles.logo}>xTanBot</Text>
          <Text style={styles.subtitle}>AI VOICE ASSISTANT</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>SIGN IN</Text>

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
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <ErrorMessage message={error} />

          <Button
            title="SIGN IN"
            onPress={handleLogin}
            loading={login.isPending}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.footerLink}>CREATE ACCOUNT →</Text>
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
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    fontSize: 48,
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
    elevation: 8,
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
