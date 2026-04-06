import { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type TextInput as TextInputType,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { hrefDashboard } from "../../src/navigation/href";
import { useRegister } from "../../src/hooks/useAuth";
import { useAuthStore } from "../../src/stores/auth.store";
import { parseError } from "../../src/utils/error.utils";
import { toastError, toastSuccess } from "../../src/utils/toast";
import Button from "../../src/components/common/Button";
import Input from "../../src/components/common/Input";

export default function RegisterScreen() {
  const router = useRouter();
  const register = useRegister();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const emailRef = useRef<TextInputType>(null);
  const passwordRef = useRef<TextInputType>(null);
  const confirmRef = useRef<TextInputType>(null);

  if (!authLoading && isAuthenticated) {
    return <Redirect href={hrefDashboard()} />;
  }

  if (authLoading) {
    return (
      <View style={styles.loadingFull}>
        <ActivityIndicator color="#FBBF24" size="large" />
      </View>
    );
  }

  function handleRegister() {
    if (password !== confirmPassword) {
      toastError("Passwords do not match", "Check passwords");
      return;
    }

    register.mutate(
      { name: name.trim(), email: email.trim(), password },
      {
        onSuccess: () => {
          toastSuccess("Your account is ready.");
          router.replace(hrefDashboard());
        },
        onError: (err) => {
          toastError(parseError(err), "Sign up failed");
        },
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
        <Pressable onPress={() => router.replace("/")} style={styles.backButton}>
          <Text style={styles.backText}>← HOME</Text>
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

          <Button
            title="CREATE ACCOUNT"
            onPress={handleRegister}
            loading={register.isPending}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.footerLink}>SIGN IN →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingFull: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
  },
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
