import { useState, type Ref } from "react";
import {
  Platform,
  View,
  Text,
  TextInput,
  StyleSheet,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
} from "react-native";

type InputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  error?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  inputRef?: Ref<TextInput>;
};

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
  autoCapitalize,
  error,
  onFocus,
  onBlur,
  inputRef,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.container}>
      {/* Callers pass UPPERCASE labels from the old design; sentence-case reads calmer. */}
      <Text style={styles.label}>{label.charAt(0) + label.slice(1).toLowerCase()}</Text>
      <TextInput
        ref={inputRef}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize={autoCapitalize}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { color: "#9ca3af", fontWeight: "600", fontSize: 13, marginBottom: 8 },
  input: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#f9fafb",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  inputFocused: { borderColor: "rgba(251,191,36,0.6)" },
  inputError: { borderColor: "#ef4444" },
  errorText: { color: "#ef4444", fontSize: 12, marginTop: 6, fontWeight: "600" },
});
