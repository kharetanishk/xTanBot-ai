import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../../src/stores/auth.store";
import { API_BASE_URL } from "../../../src/constants/config";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await clearAuth();
            queryClient.clear();
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user ? getInitials(user.name) : "?"}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name ?? "—"}</Text>
        <Text style={styles.email}>{user?.email ?? "—"}</Text>
        {user?.phone ? <Text style={styles.rowValue}>{user.phone}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Edit Profile</Text>
            <Text style={styles.rowValue}>—</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Timezone</Text>
            <Text style={styles.rowValue}>{user?.timezone ?? "—"}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Phone Number</Text>
            <Text style={styles.rowValue}>{user?.phone ?? "—"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SYSTEM</Text>
        <View style={styles.card}>
          <ApiStatusRow />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>App Version</Text>
            <Text style={styles.rowValue}>1.0.0-mvp</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Backend URL</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {API_BASE_URL}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DANGER ZONE</Text>
        <View style={styles.dangerCard}>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutPressed]}
          >
            <Text style={styles.signOutText}>SIGN OUT</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function ApiStatusRow() {
  const { data: ok, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/health`);
      return res.ok;
    },
    refetchInterval: 30000,
  });

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>API Status</Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isLoading ? "#6b7280" : ok ? "#22c55e" : "#ef4444" },
          ]}
        />
        <Text style={styles.rowValue}>{isLoading ? "…" : ok ? "Online" : "Offline"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  scrollContent: {
    padding: 16,
    paddingTop: 56,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#6b7280",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#000000",
    borderRadius: 0,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
  },
  rowValue: {
    fontSize: 14,
    color: "#6b7280",
    maxWidth: "60%",
    textAlign: "right",
  },
  avatar: {
    width: 80,
    height: 80,
    backgroundColor: "#FBBF24",
    borderWidth: 3,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#000000",
  },
  name: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000000",
    textAlign: "center",
  },
  email: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 8,
  },
  dangerCard: {
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#ef4444",
    borderRadius: 0,
    padding: 16,
  },
  signOutButton: {
    backgroundColor: "#ef4444",
    borderWidth: 3,
    borderColor: "#000",
    borderRadius: 0,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  signOutPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 2, height: 2 },
  },
  signOutText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
    textTransform: "uppercase",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
});

