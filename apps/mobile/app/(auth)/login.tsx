import { useState, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, type TextInput as TextInputType } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { hrefDashboard } from "../../src/navigation/href";
import { useLogin } from "../../src/hooks/useAuth";
import { useAuthStore } from "../../src/stores/auth.store";
import { parseError } from "../../src/utils/error.utils";
import { toastError, toastSuccess } from "../../src/utils/toast";
import Input from "../../src/components/common/Input";
import AuthShell, { authStyles, type AuthFocus } from "../../src/components/auth/AuthShell";
import { colors } from "../../src/theme";

export default function LoginScreen() {
  const router = useRouter();
  const login = useLogin();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focus, setFocus] = useState<AuthFocus>(null);
  const [failed, setFailed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const passwordRef = useRef<TextInputType>(null);

  // Let the success dance play briefly before leaving.
  if (!authLoading && isAuthenticated && !celebrate) {
    return <Redirect href={hrefDashboard()} />;
  }

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  function handleLogin() {
    setFailed(false);
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          setCelebrate(true);
          toastSuccess("Welcome back.");
          setTimeout(() => router.replace(hrefDashboard()), 900);
        },
        onError: (err) => {
          setFailed(true);
          toastError(parseError(err), "Sign in failed");
        },
      },
    );
  }

  const line = celebrate
    ? "Yay, you're back! Let's go 🎉"
    : login.isPending
      ? "Checking… one sec!"
      : failed
        ? "Hmm, that didn't work. Try again?"
        : focus === "password"
          ? "I'm not looking, promise 🙈"
          : focus === "email"
            ? "Your email, please — I never forget a friend."
            : "Welcome back! I missed you 💛";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in and pick up where you left off."
      line={line}
      celebrate={celebrate}
      footer={
        <>
          <Text style={authStyles.footerText}>Don't have an account?</Text>
          <Pressable onPress={() => router.push("/(auth)/register")} hitSlop={8}>
            <Text style={authStyles.footerLink}>Create one — it's free →</Text>
          </Pressable>
        </>
      }
    >
      <Input
        label="EMAIL"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="next"
        onFocus={() => setFocus("email")}
        onBlur={() => setFocus(null)}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Input
        label="PASSWORD"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        returnKeyType="done"
        inputRef={passwordRef}
        onFocus={() => setFocus("password")}
        onBlur={() => setFocus(null)}
        onSubmitEditing={handleLogin}
      />
      <Pressable
        onPress={handleLogin}
        disabled={login.isPending || celebrate}
        style={({ pressed }) => [authStyles.primary, (pressed || login.isPending) && { opacity: 0.85 }]}
      >
        {login.isPending ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <>
            <Text style={authStyles.primaryText}>Sign in</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onAccent} />
          </>
        )}
      </Pressable>
    </AuthShell>
  );
}
