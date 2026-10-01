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
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#09090b" },
      }}
    >
      <Stack.Screen name="dashboard" options={{ animation: "fade" }} />
      <Stack.Screen name="contact/new" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="contact/[id]" />
      <Stack.Screen name="call/new" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="call/[id]" />
      <Stack.Screen name="meeting/new" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="meeting/[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen
        name="voice"
        options={{ presentation: "fullScreenModal", animation: "fade_from_bottom" }}
      />
    </Stack>
  );
}
