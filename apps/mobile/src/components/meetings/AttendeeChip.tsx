import { View, Text, StyleSheet } from "react-native";

type AttendeeChipProps = {
  email: string;
};

const MAX_LENGTH = 28;

export default function AttendeeChip({ email }: AttendeeChipProps) {
  const display = email.length > MAX_LENGTH ? `${email.slice(0, MAX_LENGTH - 3)}…` : email;
  return (
    <View style={styles.chip}>
      <Text style={styles.text} numberOfLines={1}>
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#1f2937",
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  text: { fontSize: 13, color: "#e5e7eb", fontWeight: "600" },
});
