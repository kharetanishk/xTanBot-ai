import { useState } from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
};

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: {
      backgroundColor: "#FBBF24",
      borderWidth: 3,
      borderColor: "#000000",
      shadowOffset: { width: 4, height: 4 },
      shadowColor: "#000000",
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    text: { color: "#000000" },
  },
  secondary: {
    container: {
      backgroundColor: "#6366f1",
      borderWidth: 3,
      borderColor: "#000000",
      shadowOffset: { width: 4, height: 4 },
      shadowColor: "#000000",
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    text: { color: "#ffffff" },
  },
  ghost: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: "#ffffff",
      shadowOffset: { width: 0, height: 0 },
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    text: { color: "#ffffff" },
  },
};

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;
  const style = variantStyles[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.base,
        style.container,
        pressed && variant !== "ghost" && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#000000" : "#ffffff"}
          size="small"
        />
      ) : (
        <Text style={[styles.text, style.text]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "900",
    fontSize: 16,
  },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 2, height: 2 },
  },
  disabled: {
    opacity: 0.6,
  },
});
