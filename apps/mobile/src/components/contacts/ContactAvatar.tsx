import { View, Text, StyleSheet } from "react-native";

const COLORS = ["#FBBF24", "#6366f1", "#EF4444", "#10B981", "#F97316", "#8B5CF6"];

type ContactAvatarProps = {
  name: string;
  size?: number;
};

export default function ContactAvatar({ name, size = 44 }: ContactAvatarProps) {
  const colorIndex = name.charCodeAt(0) % COLORS.length;
  const letter = name.charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS[colorIndex],
        },
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 2,
    borderColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    color: "#000000",
    fontWeight: "900",
  },
});
