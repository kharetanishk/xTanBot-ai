import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Input from "../../../src/components/common/Input";
import { useAuthStore } from "../../../src/stores/auth.store";
import { useMe } from "../../../src/hooks/useAuth";
import { API_BASE_URL } from "../../../src/constants/config";
import { authApi } from "../../../src/api/auth.api";
import { queryKeys } from "../../../src/constants/queryKeys";
import { getApiError } from "../../../src/api/client";
import { TIMEZONE_OPTIONS } from "../../../src/constants/timezones";
import { toastError, toastSuccess } from "../../../src/utils/toast";

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
  const storeUser = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { data: freshUser, isLoading: meLoading } = useMe();
  const user = freshUser ?? storeUser;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTimezone, setEditTimezone] = useState("Asia/Kolkata");

  useEffect(() => {
    if (freshUser) {
      const token = useAuthStore.getState().token;
      if (token) {
        void useAuthStore.getState().setAuth(token, freshUser);
      }
    }
  }, [freshUser]);

  const startEdit = useCallback(() => {
    if (!user) return;
    setEditName(user.name);
    setEditPhone(user.phone ?? "");
    setEditTimezone(user.timezone ?? "Asia/Kolkata");
    setEditing(true);
  }, [user]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const updateMutation = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: async (updated) => {
      const token = useAuthStore.getState().token;
      if (token) {
        await useAuthStore.getState().setAuth(token, updated);
      }
      queryClient.setQueryData(queryKeys.auth.me, updated);
      setEditing(false);
    },
    onError: (err) => {
      toastError(getApiError(err), "Update failed");
    },
  });

  const handleSave = () => {
    if (!user) return;
    const payload: { name?: string; phone?: string | null; timezone?: string } = {};
    if (editName.trim() !== user.name) payload.name = editName.trim();
    if ((user.phone ?? "") !== editPhone) {
      payload.phone = editPhone.trim() === "" ? null : editPhone.trim();
    }
    if ((user.timezone ?? "") !== editTimezone) payload.timezone = editTimezone;
    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }
    updateMutation.mutate(payload);
  };

  const handleSignOut = () => {
    const finish = async () => {
      await clearAuth();
      queryClient.clear();
      toastSuccess("You are signed out.", "Signed out");
      router.replace("/");
    };

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Sign out from xTanBot?")) {
        void finish();
      }
      return;
    }

    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void finish();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.avatar}>
          {meLoading && !user ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.avatarText}>
              {user ? getInitials(user.name) : "?"}
            </Text>
          )}
        </View>

        {!editing ? (
          <>
            <Text style={styles.name}>{user?.name ?? "—"}</Text>
            <Text style={styles.email}>{user?.email ?? "—"}</Text>
            <Text style={styles.phoneDisplay}>{user?.phone ?? "—"}</Text>
            <Pressable
              onPress={startEdit}
              disabled={!user}
              style={({ pressed }) => [
                styles.editProfileBtn,
                pressed && styles.editProfilePressed,
                !user && styles.editProfileDisabled,
              ]}
            >
              <Text style={styles.editProfileText}>EDIT PROFILE</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.editForm}>
            <Input label="Full name" value={editName} onChangeText={setEditName} />
            <Input
              label="Phone number"
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+919876543210"
              keyboardType="phone-pad"
            />
            <Text style={styles.tzLabel}>TIMEZONE</Text>
            <View style={styles.tzGrid}>
              {TIMEZONE_OPTIONS.map((tz) => (
                <Pressable
                  key={tz}
                  onPress={() => setEditTimezone(tz)}
                  style={[
                    styles.tzChip,
                    editTimezone === tz && styles.tzChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.tzChipText,
                      editTimezone === tz && styles.tzChipTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {tz.replace(/_/g, " ")}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={handleSave}
              disabled={updateMutation.isPending}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && styles.savePressed,
                updateMutation.isPending && styles.saveDisabled,
              ]}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.saveText}>SAVE CHANGES</Text>
              )}
            </Pressable>
            <Pressable
              onPress={cancelEdit}
              disabled={updateMutation.isPending}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelPressed]}
            >
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Timezone</Text>
            <Text style={styles.rowValue} numberOfLines={2}>
              {user?.timezone ?? "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Phone number</Text>
            <Text style={styles.rowValue} numberOfLines={2}>
              {user?.phone ?? "—"}
            </Text>
          </View>
          <ApiStatusRow />
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>App version</Text>
            <Text style={styles.rowValue}>1.0.0-mvp</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SYSTEM</Text>
        <View style={styles.card}>
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
      <Text style={styles.rowLabel}>API status</Text>
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
    maxWidth: "58%",
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
    marginBottom: 4,
  },
  phoneDisplay: {
    fontSize: 14,
    color: "#000000",
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "600",
  },
  editProfileBtn: {
    backgroundColor: "#FBBF24",
    borderWidth: 3,
    borderColor: "#000",
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  editProfilePressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 2, height: 2 },
  },
  editProfileDisabled: {
    opacity: 0.45,
  },
  editProfileText: {
    fontWeight: "900",
    fontSize: 14,
    color: "#000",
  },
  editForm: {
    width: "100%",
  },
  tzLabel: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tzGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tzChip: {
    borderWidth: 3,
    borderColor: "#000",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  tzChipSelected: {
    backgroundColor: "#FBBF24",
  },
  tzChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
    maxWidth: 140,
  },
  tzChipTextSelected: {
    fontWeight: "900",
  },
  saveBtn: {
    backgroundColor: "#22c55e",
    borderWidth: 3,
    borderColor: "#000",
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  savePressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 2, height: 2 },
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontWeight: "900",
    fontSize: 14,
    color: "#000",
  },
  cancelBtn: {
    borderWidth: 3,
    borderColor: "#000",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  cancelPressed: {
    opacity: 0.85,
  },
  cancelText: {
    fontWeight: "900",
    fontSize: 13,
    color: "#000",
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
