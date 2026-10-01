import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radius } from "../../theme";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
};

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.accent, fg: colors.onAccent },
  secondary: { bg: colors.surfaceAlt, fg: colors.text },
  ghost: { bg: "transparent", fg: colors.text, border: colors.borderStrong },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: "rgba(239,68,68,0.35)" },
};

export default function Button({ title, onPress, loading = false, disabled = false, variant = "primary" }: ButtonProps) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.base,
        { backgroundColor: v.bg, borderColor: v.border ?? "transparent" },
        pressed && s.pressed,
        isDisabled && s.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        // Callers pass SHOUTY titles from the old design; sentence-case reads calmer.
        <Text style={[s.text, { color: v.fg }]}>{title.charAt(0) + title.slice(1).toLowerCase()}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontWeight: "700", fontSize: 16 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
});
