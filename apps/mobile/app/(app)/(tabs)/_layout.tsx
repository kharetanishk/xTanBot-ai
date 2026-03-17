import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0a0a0a",
          borderTopWidth: 3,
          borderTopColor: "#FBBF24",
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#FBBF24",
        tabBarInactiveTintColor: "#6b7280",
        tabBarLabelStyle: { fontWeight: "900", fontSize: 10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="calls" options={{ title: "Calls" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="meetings" options={{ title: "Meetings" }} />
      <Tabs.Screen name="contacts" options={{ title: "Contacts" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
