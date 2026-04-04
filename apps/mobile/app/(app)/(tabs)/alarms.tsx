import { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Alarm } from "../../../src/types/api.types";
import {
  useAlarms,
  useCreateAlarm,
  useDeleteAlarm,
} from "../../../src/hooks/useAlarms";

const APP_TZ = "Asia/Kolkata";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function istYmdFromOffsetDays(offsetDays: number): string {
  const shifted = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

function toISTIso(ymd: string, hour: number, minute: number): string {
  return `${ymd}T${pad2(hour)}:${pad2(minute)}:00+05:30`;
}

function formatAlarmTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: APP_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function StatusBadge({ status }: { status: Alarm["status"] }) {
  const label = status.replace(/_/g, " ").toUpperCase();
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export default function AlarmsScreen() {
  const insets = useSafeAreaInsets();
  const { data: alarms = [], isLoading } = useAlarms();
  const createAlarm = useCreateAlarm();
  const deleteAlarm = useDeleteAlarm();

  const [modalOpen, setModalOpen] = useState(false);
  const [dayOffset, setDayOffset] = useState<0 | 1>(0);
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [label, setLabel] = useState("");

  const ymd = useMemo(() => istYmdFromOffsetDays(dayOffset), [dayOffset]);

  const openModal = useCallback(() => {
    setDayOffset(0);
    setHour(7);
    setMinute(0);
    setLabel("");
    setModalOpen(true);
  }, []);

  const submitAlarm = useCallback(() => {
    const scheduledAt = toISTIso(ymd, hour, minute);
    const at = new Date(scheduledAt);
    if (at <= new Date()) {
      Alert.alert("Invalid time", "Choose a time in the future.");
      return;
    }
    createAlarm.mutate(
      {
        scheduledAt,
        label: label.trim() || "Wake up alarm",
      },
      {
        onSuccess: () => setModalOpen(false),
        onError: () => {
          Alert.alert("Error", "Could not set alarm.");
        },
      },
    );
  }, [ymd, hour, minute, label, createAlarm]);

  const onDelete = useCallback(
    (id: string) => {
      Alert.alert("Cancel alarm", "Remove this alarm?", [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => deleteAlarm.mutate(id),
        },
      ]);
    },
    [deleteAlarm],
  );

  const renderItem = useCallback(
    ({ item }: { item: Alarm }) => (
      <View style={styles.card}>
        <Text style={styles.cardEmoji}>⏰</Text>
        <View style={styles.cardMain}>
          <Text style={styles.cardLabel}>{item.label}</Text>
          <Text style={styles.cardTime}>{formatAlarmTime(item.scheduledAt)}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Pressable
          onPress={() => onDelete(item.id)}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.deletePressed]}
        >
          <Text style={styles.deleteX}>✕</Text>
        </Pressable>
      </View>
    ),
    [onDelete],
  );

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

      {isLoading ? (
        <ActivityIndicator color="#FBBF24" style={{ marginTop: 32 }} />
      ) : alarms.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>⏰</Text>
          <Text style={styles.emptyTitle}>NO ALARMS SET</Text>
          <Text style={styles.emptySub}>
            Tap + or ask the AI to set an alarm
          </Text>
        </View>
      ) : (
        <FlatList
          data={alarms}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SET ALARM</Text>

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
            <Text style={styles.ymdHint}>{ymd} (IST)</Text>

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
                  style={[
                    styles.numChip,
                    hour === h && styles.numChipOn,
                  ]}
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
                  style={[
                    styles.numChip,
                    minute === m && styles.numChipOn,
                  ]}
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
              onPress={submitAlarm}
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
          </View>
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
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
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
  listContent: { paddingBottom: 24 },
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
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 0.5,
  },
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
    marginTop: 48,
    paddingHorizontal: 24,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: "#000",
    padding: 20,
    paddingBottom: 32,
    maxHeight: "92%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#000",
    marginBottom: 16,
    letterSpacing: 1,
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
