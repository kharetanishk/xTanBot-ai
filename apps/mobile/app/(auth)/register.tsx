import { useState, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, type TextInput as TextInputType } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { hrefDashboard } from "../../src/navigation/href";
import { useRegister } from "../../src/hooks/useAuth";
import { useAuthStore } from "../../src/stores/auth.store";
import { parseError } from "../../src/utils/error.utils";
import { toastError, toastSuccess } from "../../src/utils/toast";
import Input from "../../src/components/common/Input";
import AuthShell, { authStyles, type AuthFocus } from "../../src/components/auth/AuthShell";
import { colors } from "../../src/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const register = useRegister();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [focus, setFocus] = useState<AuthFocus>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const emailRef = useRef<TextInputType>(null);
  const passwordRef = useRef<TextInputType>(null);
  const confirmRef = useRef<TextInputType>(null);

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

  function handleRegister() {
    setFailed(null);
    if (password !== confirmPassword) {
      setFailed("Those passwords don't match — try once more?");
      toastError("Passwords do not match", "Check passwords");
      return;
    }

    register.mutate(
      { name: name.trim(), email: email.trim(), password },
      {
        onSuccess: () => {
          setCelebrate(true);
          toastSuccess("Your account is ready.");
          setTimeout(() => router.replace(hrefDashboard()), 1100);
        },
        onError: (err) => {
          setFailed("Oops, something's off. Check the details?");
          toastError(parseError(err), "Sign up failed");
        },
      },
    );
  }

  const first = name.trim().split(/\s+/)[0];
  const field = (f: AuthFocus) => ({ onFocus: () => setFocus(f), onBlur: () => setFocus(null) });
  const line = celebrate
    ? `Welcome aboard${first ? `, ${first}` : ""}! 🎉`
    : register.isPending
      ? "Setting things up for you…"
      : failed
        ? failed
        : focus === "name"
          ? first
            ? `Nice to meet you, ${first}! 👋`
            : "Ooh, what should I call you?"
          : focus === "email"
            ? `Where can I reach you${first ? `, ${first}` : ""}?`
            : focus === "password"
              ? "Make it a strong one 💪 I won't peek."
              : focus === "confirm"
                ? "One more time, just to be sure."
                : "Hi, I'm xTan! Let's get you set up in 30 seconds ✨";

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever for the basics. Your assistant is one step away."
      line={line}
      celebrate={celebrate}
      footer={
        <>
          <Text style={authStyles.footerText}>Already have an account?</Text>
          <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
            <Text style={authStyles.footerLink}>Sign in →</Text>
          </Pressable>
        </>
      }
    >
      <Input
        label="FULL NAME"
        value={name}
        onChangeText={setName}
        placeholder="Jane Doe"
        autoCapitalize="words"
        returnKeyType="next"
        {...field("name")}
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
        inputRef={emailRef}
        {...field("email")}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Input
        label="PASSWORD"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        returnKeyType="next"
        inputRef={passwordRef}
        {...field("password")}
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <Input
        label="CONFIRM PASSWORD"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="••••••••"
        secureTextEntry
        returnKeyType="done"
        inputRef={confirmRef}
        {...field("confirm")}
        onSubmitEditing={handleRegister}
      />
      <Pressable
        onPress={handleRegister}
        disabled={register.isPending || celebrate}
        style={({ pressed }) => [authStyles.primary, (pressed || register.isPending) && { opacity: 0.85 }]}
      >
        {register.isPending ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <>
            <Text style={authStyles.primaryText}>Create account</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onAccent} />
          </>
        )}
      </Pressable>
    </AuthShell>
  );
}
