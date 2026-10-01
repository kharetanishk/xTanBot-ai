import { StyleSheet, Text, View } from "react-native";

// Muted tints that sit well on the dark theme; text uses the matching strong colour.
const PALETTE = [
  { bg: "rgba(251,191,36,0.15)", fg: "#FBBF24" },
  { bg: "rgba(129,140,248,0.16)", fg: "#818cf8" },
  { bg: "rgba(239,68,68,0.15)", fg: "#f87171" },
  { bg: "rgba(34,197,94,0.15)", fg: "#4ade80" },
  { bg: "rgba(249,115,22,0.15)", fg: "#fb923c" },
  { bg: "rgba(168,85,247,0.16)", fg: "#c084fc" },
];

export default function ContactAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const c = PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length]!;
  return (
    <View style={[s.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }]}>
      <Text style={[s.letter, { fontSize: size * 0.4, color: c.fg }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  letter: { fontWeight: "800" },
});
