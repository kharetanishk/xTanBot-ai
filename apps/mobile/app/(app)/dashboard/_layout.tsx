import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import TabBar from "../../../src/components/ui/TabBar";
import { colors } from "../../../src/theme";

export default function TabLayout() {
  // Desktop web: left sidebar with every section; phones/tablets: floating bottom bar.
  const sidebar = useWindowDimensions().width >= 1024;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} sidebar={sidebar} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: sidebar ? "left" : "bottom",
        animation: "fade",
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="calls" options={{ title: "Calls" }} />
      <Tabs.Screen name="alarms" options={{ title: "Alarms" }} />
      <Tabs.Screen name="meetings" options={{ title: "Meetings" }} />
      <Tabs.Screen name="contacts" options={{ title: "Contacts" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
