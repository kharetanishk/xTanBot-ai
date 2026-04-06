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
import { useLogin } from "../../src/hooks/useAuth";
import { useAuthStore } from "../../src/stores/auth.store";
import { parseError } from "../../src/utils/error.utils";
import { toastError, toastSuccess } from "../../src/utils/toast";
import Button from "../../src/components/common/Button";
import Input from "../../src/components/common/Input";

export default function LoginScreen() {
  const router = useRouter();
  const login = useLogin();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const passwordRef = useRef<TextInputType>(null);

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

  function handleLogin() {
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          toastSuccess("Welcome back.");
          router.replace(hrefDashboard());
        },
        onError: (err) => {
          toastError(parseError(err), "Sign in failed");
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

          <Button
            title="SIGN IN"
            onPress={handleLogin}
            loading={login.isPending}
          />
        </View>

        <View style={styles.footer}>
          <Pressable onPress={() => router.replace("/")} style={styles.homeLink}>
            <Text style={styles.homeLinkText}>← BACK TO HOME</Text>
          </Pressable>
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
  loadingFull: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
  },
  homeLink: {
    marginBottom: 16,
  },
  homeLinkText: {
    color: "#888888",
    fontWeight: "700",
    fontSize: 13,
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
