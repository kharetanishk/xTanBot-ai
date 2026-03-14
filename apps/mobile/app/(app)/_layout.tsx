import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="contact/new" />
      <Stack.Screen name="contact/[id]" />
    </Stack>
  );
}
