import { Stack } from "expo-router";
// import { usePushNotifications } from "../../src/hooks/usePushNotifications";

export default function AppLayout() {
  // usePushNotifications();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="contact/new" />
      <Stack.Screen name="contact/[id]" />
      <Stack.Screen name="call/new" />
      <Stack.Screen name="call/[id]" />
      <Stack.Screen name="meeting/new" />
      <Stack.Screen name="meeting/[id]" />
      <Stack.Screen name="chat/[id]" />
    </Stack>
  );
}
