import { View, Text } from "react-native";

export default function DashboardScreen() {
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
        Dashboard
      </Text>
      <Text style={{ color: "#818cf8", marginTop: 8 }}>
        Foundation complete ✓
      </Text>
    </View>
  );
}
