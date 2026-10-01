import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  ZoomIn,
} from "react-native-reanimated";
import {
  Appear,
  IconTile,
  PrimaryButton,
  Screen,
  ScreenHeader,
  type IconName,
} from "../../../src/components/ui";
import { colors, radius, type Tone } from "../../../src/theme";
import { useRouter } from "expo-router";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import Input from "../../../src/components/common/Input";
import { useAuthStore } from "../../../src/stores/auth.store";
import { useMe } from "../../../src/hooks/useAuth";
import { authApi } from "../../../src/api/auth.api";
import { queryKeys } from "../../../src/constants/queryKeys";
import { getApiError } from "../../../src/api/client";
import { TIMEZONE_OPTIONS } from "../../../src/constants/timezones";
import { toastError, toastSuccess } from "../../../src/utils/toast";

function getInitials(name: string): string {
  return name
    .split(/[\s_]+/)
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
  const [showSignOutModal, setShowSignOutModal] = useState(false);
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

  const tiny = useWindowDimensions().width < 380; // icon-only Edit so the name isn't cut off
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

  const confirmSignOut = async () => {
    setShowSignOutModal(false);
    await clearAuth();
    queryClient.clear();
    toastSuccess("You are signed out.", "Signed out");
    router.replace("/");
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Settings" />

        {/* Profile */}
        <Appear index={1} style={styles.profile}>
          <View style={styles.avatar}>
            {meLoading && !user ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.avatarText}>{user ? getInitials(user.name) : "?"}</Text>
            )}
          </View>

          {!editing ? (
            <>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{user?.name ?? "—"}</Text>
                <Text style={styles.email} numberOfLines={1}>{user?.email ?? "—"}</Text>
              </View>
              <Pressable
                onPress={startEdit}
                disabled={!user}
                style={({ pressed }) => [styles.editBtn, pressed && styles.pressed, !user && { opacity: 0.5 }]}
              >
                <Ionicons name="create-outline" size={16} color={colors.accent} />
                {tiny ? null : <Text style={styles.editText}>Edit</Text>}
              </Pressable>
            </>
          ) : (
            <Text style={styles.name}>Edit profile</Text>
          )}
        </Appear>

        {editing ? (
          <Appear style={styles.editForm}>
            <Input label="Full name" value={editName} onChangeText={setEditName} />
            <Input
              label="Phone number"
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+919876543210"
              keyboardType="phone-pad"
            />
            <Text style={styles.fieldLabel}>Timezone</Text>
            <View style={styles.tzGrid}>
              {TIMEZONE_OPTIONS.map((tz) => {
                const on = editTimezone === tz;
                return (
                  <Pressable key={tz} onPress={() => setEditTimezone(tz)} style={[styles.tzChip, on && styles.tzChipOn]}>
                    <Text style={[styles.tzChipText, on && styles.tzChipTextOn]} numberOfLines={1}>
                      {tz.replace(/_/g, " ")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.formActions}>
              <PrimaryButton label="Cancel" tone="neutral" onPress={cancelEdit} disabled={updateMutation.isPending} style={{ flex: 1 }} />
              <PrimaryButton label="Save" icon="checkmark" onPress={handleSave} loading={updateMutation.isPending} style={{ flex: 1 }} />
            </View>
          </Appear>
        ) : null}

        <Appear index={2}>
          <Text style={styles.groupTitle}>Account</Text>
          <View style={styles.group}>
            <Row icon="globe-outline" tone="info" label="Timezone" value={user?.timezone ?? "—"} />
            <Row icon="call-outline" tone="success" label="Phone" value={user?.phone ?? "Not set"} />
            <Row icon="mail-outline" tone="accent" label="Email" value={user?.email ?? "—"} last />
          </View>
        </Appear>

        <Appear index={3}>
          <Pressable
            onPress={() => setShowSignOutModal(true)}
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </Appear>
      </ScrollView>

      {/* Sign-out confirmation */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSignOutModal(false)} />
          <Animated.View entering={ZoomIn.springify().damping(18)} style={styles.dialog}>
            <IconTile icon="log-out-outline" tone="danger" size={52} />
            <Text style={styles.dialogTitle}>Sign out?</Text>
            <Text style={styles.dialogBody}>You'll need to log in again to use xTanBot on this device.</Text>
            <View style={styles.formActions}>
              <PrimaryButton label="Cancel" tone="neutral" onPress={() => setShowSignOutModal(false)} style={{ flex: 1 }} />
              <PrimaryButton label="Sign out" tone="danger" onPress={() => void confirmSignOut()} style={{ flex: 1 }} />
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </Screen>
  );
}

function Row({
  icon,
  tone,
  label,
  value,
  valueNode,
  last,
}: {
  icon: IconName;
  tone: Tone;
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <IconTile icon={icon} tone={tone} size={34} />
      <Text style={styles.rowLabel}>{label}</Text>
      {valueNode ?? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, width: "100%", maxWidth: 820, alignSelf: "center" },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.accent, fontSize: 20, fontWeight: "800" },
  name: { color: colors.text, fontSize: 18, fontWeight: "700" },
  email: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  editForm: { marginHorizontal: 20, marginTop: -8, marginBottom: 24 },
  fieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  tzGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  tzChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tzChipOn: { backgroundColor: colors.accentSoft, borderColor: "rgba(251,191,36,0.5)" },
  tzChipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600", maxWidth: 160 },
  tzChipTextOn: { color: colors.accent },
  formActions: { flexDirection: "row", gap: 10, alignSelf: "stretch" },

  groupTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginHorizontal: 24,
    marginBottom: 8,
  },
  group: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  // flexShrink + flex:1 lets long values truncate on one line instead of wrapping.
  rowValue: { flex: 1, flexShrink: 1, color: colors.textMuted, fontSize: 14, textAlign: "right" },

  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  signOutText: { color: colors.danger, fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 24,
  },
  dialogTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 4 },
  dialogBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 8 },
});
