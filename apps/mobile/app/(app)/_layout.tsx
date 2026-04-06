import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../src/stores/auth.store";

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0a0a0a",
        }}
      >
        <ActivityIndicator color="#FBBF24" size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
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
