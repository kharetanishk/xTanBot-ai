import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import Toast, { BaseToast, ErrorToast } from "react-native-toast-message";
import { useAuthStore } from "../src/stores/auth.store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function RootLayout() {
  const loadToken = useAuthStore((s) => s.loadToken);

  useEffect(() => {
    loadToken();
  }, []);

  const toastConfig = {
    success: (props: object) => (
      <BaseToast
        {...props}
        style={{
          borderLeftColor: "#22c55e",
          backgroundColor: "#111111",
          borderWidth: 2,
          borderColor: "#000",
        }}
        text1Style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}
        text2Style={{ fontSize: 13, color: "#d4d4d4" }}
      />
    ),
    error: (props: object) => (
      <ErrorToast
        {...props}
        style={{
          borderLeftColor: "#ef4444",
          backgroundColor: "#111111",
          borderWidth: 2,
          borderColor: "#000",
        }}
        text1Style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}
        text2Style={{ fontSize: 13, color: "#fecaca" }}
      />
    ),
    info: (props: object) => (
      <BaseToast
        {...props}
        style={{
          borderLeftColor: "#6366f1",
          backgroundColor: "#111111",
          borderWidth: 2,
          borderColor: "#000",
        }}
        text1Style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}
        text2Style={{ fontSize: 13, color: "#d4d4d4" }}
      />
    ),
  };

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
      <Toast config={toastConfig} />
    </QueryClientProvider>
  );
}
