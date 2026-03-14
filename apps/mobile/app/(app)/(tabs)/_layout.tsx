import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#111111" },
        tabBarActiveTintColor: "#6366f1",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
    </Tabs>
  );
}
