import { Pressable, Text, StyleSheet } from "react-native";

type SuggestedPromptProps = {
  text: string;
  onPress: () => void;
};

export default function SuggestedPrompt({ text, onPress }: SuggestedPromptProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      <Text style={styles.chipText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    backgroundColor: "#FBBF24",
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  chipPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 1, height: 1 },
  },
  chipText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
  },
});
