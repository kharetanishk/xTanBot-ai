import { View, Text, StyleSheet } from "react-native";

type ErrorMessageProps = {
  message: string | null;
};

export default function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#EF4444",
    borderWidth: 3,
    borderColor: "#000000",
    borderRadius: 0,
    padding: 12,
    marginBottom: 16,
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  text: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
});
