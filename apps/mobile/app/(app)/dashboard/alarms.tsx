import { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Alarm } from "../../../src/types/api.types";
import {
  useAlarms,
  useCreateAlarm,
  useDeleteAlarm,
} from "../../../src/hooks/useAlarms";
import { getApiError } from "../../../src/api/client";
import { useAuthStore } from "../../../src/stores/auth.store";
import { useMe } from "../../../src/hooks/useAuth";
import {
  zonedYmdFromOffsetDays,
  zonedWallTimeToUtcIso,
  formatDateTimeInTimeZone,
  formatClockNowInTimeZone,
} from "../../../src/utils/date.utils";
import { TIMEZONE_OPTIONS } from "../../../src/constants/timezones";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

type BadgeVariant = "default" | "past" | "active" | "cancelled" | "failed";

function alarmDisplayStatus(alarm: Alarm): { label: string; variant: BadgeVariant } {
  const now = Date.now();
  const at = new Date(alarm.scheduledAt).getTime();
  const isPast = at <= now;

  switch (alarm.status) {
    case "cancelled":
      return { label: "CANCELLED", variant: "cancelled" };
    case "acknowledged":
      return { label: "ACKNOWLEDGED", variant: "past" };
    case "failed":
      return { label: "FAILED", variant: "failed" };
    case "ringing":
      // Still ringing right now vs already rang
      return isPast
        ? { label: "RANG", variant: "past" }
        : { label: "RINGING", variant: "active" };
    case "scheduled":
    default:
      return isPast
        ? { label: "MISSED", variant: "failed" }
        : { label: "SCHEDULED", variant: "default" };
  }
}

function StatusBadge({ alarm }: { alarm: Alarm }) {
  const { label, variant } = alarmDisplayStatus(alarm);
  return (
    <View style={[styles.badge, styles[`badge_${variant}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${variant}`]]}>{label}</Text>
    </View>
  );
}

export default function AlarmsScreen() {
  const insets = useSafeAreaInsets();
  const storeUser = useAuthStore((s) => s.user);
  const { data: apiUser } = useMe();
  const profileTz =
    apiUser?.timezone ?? storeUser?.timezone ?? "Asia/Kolkata";

  const {
    data: alarmsRaw,
    isFetching,
    isError,
    error: alarmsError,
    refetch,
  } = useAlarms();
  const alarms = alarmsRaw ?? [];
  const createAlarm = useCreateAlarm();
  const deleteAlarm = useDeleteAlarm();

  const [alarmTimeZone, setAlarmTimeZone] = useState(profileTz);
  useEffect(() => {
    setAlarmTimeZone(profileTz);
  }, [profileTz]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const clockText = useMemo(
    () => formatClockNowInTimeZone(alarmTimeZone),
    [alarmTimeZone, tick],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [dayOffset, setDayOffset] = useState<0 | 1>(0);
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [label, setLabel] = useState("");

  const ymd = useMemo(
    () => zonedYmdFromOffsetDays(alarmTimeZone, dayOffset),
    [alarmTimeZone, dayOffset],
  );

  const openModal = useCallback(() => {
    setDayOffset(0);
    setHour(7);
    setMinute(0);
    setLabel("");
    setModalOpen(true);
  }, []);

  const submitAlarm = useCallback(() => {
    let scheduledAt: string;
    try {
      scheduledAt = zonedWallTimeToUtcIso(ymd, hour, minute, alarmTimeZone);
    } catch {
      Alert.alert("Invalid time", "Could not build that date in your timezone.");
      return;
    }
    const atMs = new Date(scheduledAt).getTime();
    if (Number.isNaN(atMs)) {
      Alert.alert("Invalid time", "Could not read that date/time. Try again.");
      return;
    }
    if (atMs <= Date.now()) {
      Alert.alert(
        "Invalid time",
        `Choose a time in the future (clock is in ${alarmTimeZone}).`,
      );
      return;
    }
    createAlarm.mutate(
      {
        scheduledAt,
        label: label.trim() || "Wake up alarm",
      },
      {
        onSuccess: () => setModalOpen(false),
        onError: (err) => {
          Alert.alert("Could not set alarm", getApiError(err));
        },
      },
    );
  }, [ymd, hour, minute, label, alarmTimeZone, createAlarm]);

  const renderItem = useCallback(
    ({ item }: { item: Alarm }) => (
      <View style={styles.card}>
        <Text style={styles.cardEmoji}>⏰</Text>
        <View style={styles.cardMain}>
          <Text style={styles.cardLabel}>{item.label}</Text>
          <Text style={styles.cardTime}>
            {formatDateTimeInTimeZone(item.scheduledAt, alarmTimeZone)}
          </Text>
          <StatusBadge alarm={item} />
        </View>
        <Pressable
          onPress={() => deleteAlarm.mutate(item.id)}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.deletePressed]}
        >
          <Text style={styles.deleteX}>✕</Text>
        </Pressable>
      </View>
    ),
    [deleteAlarm, alarmTimeZone],
  );

  const listEmpty = useMemo(() => {
    if (isError) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>COULD NOT LOAD</Text>
          <Text style={styles.emptySub}>{getApiError(alarmsError)}</Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [styles.retryBtn, pressed && styles.retryPressed]}
          >
            <Text style={styles.retryText}>TAP TO RETRY</Text>
          </Pressable>
        </View>
      );
    }
    if (isFetching && alarms.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={styles.loadingHint}>Loading alarms…</Text>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>⏰</Text>
        <Text style={styles.emptyTitle}>NO ALARMS SET</Text>
        <Text style={styles.emptySub}>
          Tap + or ask the AI to set an alarm
        </Text>
      </View>
    );
  }, [isError, isFetching, alarms.length, alarmsError, refetch]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>ALARMS</Text>
        <Pressable
          onPress={openModal}
          style={({ pressed }) => [styles.addBtn, pressed && styles.addPressed]}
        >
          <Text style={styles.addPlus}>+</Text>
        </Pressable>
      </View>

      <View style={styles.clockCard}>
        <Text style={styles.clockLabel}>NOW ({alarmTimeZone})</Text>
        <Text style={styles.clockValue}>{clockText}</Text>
        <Text style={styles.clockHint}>
          Alarms use this timezone. Change below or update your profile in
          Settings.
        </Text>
        <Text style={styles.modalSection}>ALARM TIMEZONE</Text>
        <View style={styles.tzWrap}>
          {TIMEZONE_OPTIONS.map((tz) => (
            <Pressable
              key={tz}
              onPress={() => setAlarmTimeZone(tz)}
              style={[
                styles.tzChip,
                alarmTimeZone === tz && styles.tzChipOn,
              ]}
            >
              <Text
                style={[
                  styles.tzChipText,
                  alarmTimeZone === tz && styles.tzChipTextOn,
                ]}
                numberOfLines={1}
              >
                {tz.replace(/_/g, " ")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        style={styles.list}
        data={alarms}
        keyExtractor={(a) => a.id}
        renderItem={renderItem}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={
          alarms.length === 0 ? styles.listEmptyContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor="#FBBF24"
          />
        }
      />

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalCard}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalTitle}>SET ALARM</Text>
            <Text style={styles.modalTzNote}>
              Using timezone: {alarmTimeZone}
            </Text>

            <Text style={styles.modalSection}>DATE</Text>
            <View style={styles.dayRow}>
              <Pressable
                onPress={() => setDayOffset(0)}
                style={[
                  styles.dayChip,
                  dayOffset === 0 && styles.dayChipOn,
                ]}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    dayOffset === 0 && styles.dayChipTextOn,
                  ]}
                >
                  TODAY
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDayOffset(1)}
                style={[
                  styles.dayChip,
                  dayOffset === 1 && styles.dayChipOn,
                ]}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    dayOffset === 1 && styles.dayChipTextOn,
                  ]}
                >
                  TOMORROW
                </Text>
              </Pressable>
            </View>
            <Text style={styles.ymdHint}>
              {ymd} · wall time in {alarmTimeZone}
            </Text>

            <Text style={styles.modalSection}>HOUR</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerRow}
            >
              {HOURS.map((h) => (
                <Pressable
                  key={h}
                  onPress={() => setHour(h)}
                  style={[styles.numChip, hour === h && styles.numChipOn]}
                >
                  <Text
                    style={[
                      styles.numChipText,
                      hour === h && styles.numChipTextOn,
                    ]}
                  >
                    {pad2(h)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.modalSection}>MINUTE</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerRow}
            >
              {MINUTES.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMinute(m)}
                  style={[styles.numChip, minute === m && styles.numChipOn]}
                >
                  <Text
                    style={[
                      styles.numChipText,
                      minute === m && styles.numChipTextOn,
                    ]}
                  >
                    {pad2(m)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.modalSection}>LABEL (OPTIONAL)</Text>
            <TextInput
              style={styles.labelInput}
              value={label}
              onChangeText={setLabel}
              placeholder="Morning alarm"
              placeholderTextColor="#9ca3af"
            />

            <Pressable
              onPress={() => {
                submitAlarm();
              }}
              disabled={createAlarm.isPending}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.submitPressed,
                createAlarm.isPending && styles.submitDisabled,
              ]}
            >
              {createAlarm.isPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitText}>SET ALARM</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => setModalOpen(false)}
              style={styles.modalCancel}
            >
              <Text style={styles.modalCancelText}>CANCEL</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  clockCard: {
    backgroundColor: "#1a1a1a",
    borderWidth: 3,
    borderColor: "#FBBF24",
    padding: 14,
    marginBottom: 16,
  },
  clockLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#9ca3af",
    letterSpacing: 1,
  },
  clockValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    marginTop: 4,
  },
  clockHint: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    lineHeight: 16,
  },
  tzWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tzChip: {
    borderWidth: 2,
    borderColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "transparent",
  },
  tzChipOn: {
    backgroundColor: "#FBBF24",
    borderColor: "#000",
  },
  tzChipText: { fontSize: 10, fontWeight: "700", color: "#fff", maxWidth: 120 },
  tzChipTextOn: { color: "#000", fontWeight: "900" },
  addBtn: {
    width: 48,
    height: 48,
    backgroundColor: "#FBBF24",
    borderWidth: 3,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  addPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 2, height: 2 },
  },
  addPlus: {
    fontSize: 28,
    fontWeight: "900",
    color: "#000",
    marginTop: -2,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  listEmptyContent: { flexGrow: 1, paddingBottom: 24 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 3,
    borderColor: "#000",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  cardEmoji: { fontSize: 28, marginRight: 12 },
  cardMain: { flex: 1 },
  cardLabel: {
    fontSize: 15,
    fontWeight: "900",
    color: "#000",
  },
  cardTime: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FBBF24",
    marginTop: 4,
    marginBottom: 6,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "#000",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badge_default: { backgroundColor: "#f3f4f6", borderColor: "#000" },
  badge_past: { backgroundColor: "#e5e7eb", borderColor: "#9ca3af" },
  badge_active: { backgroundColor: "#FBBF24", borderColor: "#000" },
  badge_cancelled: { backgroundColor: "#e5e7eb", borderColor: "#9ca3af" },
  badge_failed: { backgroundColor: "#fee2e2", borderColor: "#ef4444" },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 0.5,
  },
  badgeText_default: { color: "#000" },
  badgeText_past: { color: "#6b7280" },
  badgeText_active: { color: "#000" },
  badgeText_cancelled: { color: "#9ca3af" },
  badgeText_failed: { color: "#ef4444" },
  deleteBtn: {
    width: 40,
    height: 40,
    backgroundColor: "#ef4444",
    borderWidth: 3,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  deletePressed: {
    opacity: 0.85,
  },
  deleteX: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
  empty: {
    alignItems: "center",
    marginTop: 32,
    paddingHorizontal: 24,
  },
  loadingHint: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 1,
  },
  emptySub: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: "#FBBF24",
    borderWidth: 3,
    borderColor: "#000",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  retryPressed: { opacity: 0.9 },
  retryText: { fontWeight: "900", color: "#000" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalScroll: {
    maxHeight: "92%",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: "#000",
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000",
    marginBottom: 6,
    letterSpacing: 1,
  },
  modalTzNote: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  modalSection: {
    fontSize: 11,
    fontWeight: "900",
    color: "#6b7280",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  dayRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  dayChip: {
    flex: 1,
    borderWidth: 3,
    borderColor: "#000",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  dayChipOn: { backgroundColor: "#FBBF24" },
  dayChipText: { fontWeight: "900", color: "#000", fontSize: 12 },
  dayChipTextOn: { fontWeight: "900" },
  ymdHint: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  pickerScroll: { maxHeight: 52, marginBottom: 4 },
  pickerRow: { flexDirection: "row", gap: 6, paddingVertical: 4 },
  numChip: {
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: "#000",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  numChipOn: { backgroundColor: "#FBBF24" },
  numChipText: { fontWeight: "800", color: "#000", fontSize: 14 },
  numChipTextOn: { fontWeight: "900" },
  labelInput: {
    borderWidth: 3,
    borderColor: "#000",
    padding: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  submitBtn: {
    backgroundColor: "#FBBF24",
    borderWidth: 3,
    borderColor: "#000",
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  submitPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 2, height: 2 },
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontWeight: "900", fontSize: 15, color: "#000" },
  modalCancel: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontWeight: "900",
    color: "#6b7280",
    fontSize: 13,
  },
});
