import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type IonName = ComponentProps<typeof Ionicons>["name"];

function tabBarIcon(outline: IonName, solid: IonName) {
  return ({
    color,
    focused,
    size,
  }: {
    color: string;
    focused: boolean;
    size: number;
  }) => (
    <Ionicons
      name={focused ? solid : outline}
      size={Math.min(size + 2, 26)}
      color={color}
    />
  );
}

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
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: tabBarIcon("grid-outline", "grid"),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: "Calls",
          tabBarIcon: tabBarIcon("call-outline", "call"),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: tabBarIcon(
            "chatbubble-ellipses-outline",
            "chatbubble-ellipses",
          ),
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: "Meetings",
          tabBarIcon: tabBarIcon("calendar-outline", "calendar"),
        }}
      />
      <Tabs.Screen
        name="alarms"
        options={{
          title: "Alarms",
          tabBarIcon: tabBarIcon("alarm-outline", "alarm"),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Contacts",
          tabBarIcon: tabBarIcon("people-outline", "people"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: tabBarIcon("settings-outline", "settings"),
        }}
      />
    </Tabs>
  );
}
