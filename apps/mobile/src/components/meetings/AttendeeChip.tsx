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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: "#6b7280",
    borderRadius: 0,
    marginRight: 8,
    marginBottom: 8,
  },
  text: {
    fontSize: 12,
    color: "#000",
    fontWeight: "700",
  },
});
