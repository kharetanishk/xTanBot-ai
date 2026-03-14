import { View, Text } from "react-native";

export default function LoginScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0a0a0a",
      }}
    >
      <Text style={{ color: "#ffffff", fontSize: 24, fontWeight: "bold" }}>
        xTanBot
      </Text>
      <Text style={{ color: "#6366f1", marginTop: 8 }}>
        Login — coming next
      </Text>
    </View>
  );
}
