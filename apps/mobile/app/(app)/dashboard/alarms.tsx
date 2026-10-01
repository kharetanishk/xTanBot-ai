import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, SlideInDown } from "react-native-reanimated";
import type { Alarm } from "../../../src/types/api.types";
import { useAlarms, useCreateAlarm, useDeleteAlarm } from "../../../src/hooks/useAlarms";
import { getApiError } from "../../../src/api/client";
import { useAuthStore } from "../../../src/stores/auth.store";
import { useMe } from "../../../src/hooks/useAuth";
import { zonedYmdFromOffsetDays, zonedWallTimeToUtcIso } from "../../../src/utils/date.utils";
import { TIMEZONE_OPTIONS } from "../../../src/constants/timezones";
import { toastError, toastSuccess } from "../../../src/utils/toast";
import {
  Appear,
  Badge,
  EmptyState,
  IconButton,
  PrimaryButton,
  Screen,
  ScreenHeader,
  Skeleton,
} from "../../../src/components/ui";
import { colors, radius, type Tone } from "../../../src/theme";

const pad2 = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/** Wall-clock parts of a Date in a given IANA timezone. */
function partsInTz(d: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "0";
  return { ymd: `${g("year")}-${g("month")}-${g("day")}`, h: Number(g("hour")) % 24, m: Number(g("minute")), s: Number(g("second")) };
}

const to12 = (h: number) => ({ hh: h % 12 === 0 ? 12 : h % 12, ap: h < 12 ? "AM" : "PM" });

function timeParts(iso: string, timeZone: string) {
  const { h, m } = partsInTz(new Date(iso), timeZone);
  const { hh, ap } = to12(h);
  return { time: `${hh}:${pad2(m)}`, ap };
}

function relative(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${m}m` : `${m} min`;
}

function status(alarm: Alarm): { label: string; tone: Tone } {
  const past = new Date(alarm.scheduledAt).getTime() <= Date.now();
  switch (alarm.status) {
    case "cancelled":
      return { label: "cancelled", tone: "neutral" };
    case "acknowledged":
      return { label: "done", tone: "success" };
    case "failed":
      return { label: "failed", tone: "danger" };
    case "ringing":
      return past ? { label: "rang", tone: "neutral" } : { label: "ringing", tone: "accent" };
    default:
      return past ? { label: "missed", tone: "danger" } : { label: "scheduled", tone: "accent" };
  }
}

export default function AlarmsScreen() {
  const insets = useSafeAreaInsets();
  const storeUser = useAuthStore((s) => s.user);
  const { data: apiUser } = useMe();
  const profileTz = apiUser?.timezone ?? storeUser?.timezone ?? "Asia/Kolkata";

  const { data: alarmsRaw, isFetching, isLoading, isError, error, refetch } = useAlarms();
  const alarms = alarmsRaw ?? [];
  const createAlarm = useCreateAlarm();
  const deleteAlarm = useDeleteAlarm();

  const [tz, setTz] = useState(profileTz);
  useEffect(() => setTz(profileTz), [profileTz]);
  const [tzOpen, setTzOpen] = useState(false);

  // 1s tick drives the live clock and countdown.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const clock = partsInTz(now, tz);
  const { hh, ap } = to12(clock.h);
  const dateLine = now.toLocaleDateString("en-IN", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });

  const upcoming = useMemo(
    () =>
      alarms
        .filter((a) => a.status === "scheduled" && new Date(a.scheduledAt).getTime() > now.getTime())
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [alarms, now],
  );
  const past = useMemo(
    () =>
      alarms
        .filter((a) => !upcoming.includes(a))
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [alarms, upcoming],
  );
  const next = upcoming[0];

  // ── New-alarm sheet ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dayOffset, setDayOffset] = useState<0 | 1>(0);
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [label, setLabel] = useState("");
  const ymd = useMemo(() => zonedYmdFromOffsetDays(tz, dayOffset), [tz, dayOffset]);

  const openSheet = useCallback(() => {
    setDayOffset(0);
    setHour(7);
    setMinute(0);
    setLabel("");
    setSheetOpen(true);
  }, []);

  /** Jump the picker to "now + N minutes" in the alarm timezone. */
  const preset = (minutesFromNow: number) => {
    const target = partsInTz(new Date(Date.now() + minutesFromNow * 60000), tz);
    setDayOffset(target.ymd === partsInTz(new Date(), tz).ymd ? 0 : 1);
    setHour(target.h);
    setMinute(target.m);
  };

  /** Fine-tune by one minute (the grid only offers :05 steps); rolls the hour over. */
  const nudge = (delta: 1 | -1) => {
    const t = (hour * 60 + minute + delta + 1440) % 1440;
    setHour(Math.floor(t / 60));
    setMinute(t % 60);
  };

  const submit = useCallback(() => {
    let scheduledAt: string;
    try {
      scheduledAt = zonedWallTimeToUtcIso(ymd, hour, minute, tz);
    } catch {
      toastError("Could not build that date in your timezone.", "Invalid time");
      return;
    }
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      toastError(`Pick a time in the future (${tz}).`, "That time has passed");
      return;
    }
    createAlarm.mutate(
      { scheduledAt, label: label.trim() || "Wake up alarm" },
      {
        onSuccess: () => {
          setSheetOpen(false);
          toastSuccess(`${to12(hour).hh}:${pad2(minute)} ${to12(hour).ap}, ${dayOffset ? "tomorrow" : "today"}`, "Alarm set");
        },
        onError: (err) => toastError(getApiError(err), "Could not set alarm"),
      },
    );
  }, [ymd, hour, minute, tz, label, dayOffset, createAlarm]);

  const sections = [
    { title: "Upcoming", data: upcoming },
    { title: "Earlier", data: past },
  ].filter((s) => s.data.length);

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              title="Alarms"
              subtitle={upcoming.length ? `${upcoming.length} active` : "xTanBot calls you to wake you up"}
              right={<IconButton icon="add" onPress={openSheet} accessibilityLabel="New alarm" />}
            />

            {/* Live clock */}
            <Appear index={1} style={s.clockCard}>
              <View style={s.clockRow}>
                <Text style={s.clockTime}>
                  {hh}:{pad2(clock.m)}
                </Text>
                <View style={s.clockSide}>
                  <Text style={s.clockSec}>{pad2(clock.s)}</Text>
                  <Text style={s.clockAp}>{ap}</Text>
                </View>
              </View>
              <Text style={s.clockDate}>{dateLine}</Text>

              <View style={s.clockFooter}>
                <Pressable onPress={() => setTzOpen((o) => !o)} style={s.tzPill} hitSlop={6}>
                  <Ionicons name="globe-outline" size={14} color={colors.textMuted} />
                  <Text style={s.tzPillText} numberOfLines={1}>
                    {tz.replace(/_/g, " ")}
                  </Text>
                  <Ionicons name={tzOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
                </Pressable>
                {next ? (
                  <View style={s.nextPill}>
                    <Ionicons name="alarm" size={14} color={colors.accent} />
                    <Text style={s.nextText}>in {relative(new Date(next.scheduledAt).getTime() - now.getTime())}</Text>
                  </View>
                ) : null}
              </View>

              {tzOpen ? (
                <Animated.View entering={FadeInDown.duration(220)} style={s.tzGrid}>
                  {TIMEZONE_OPTIONS.map((opt) => {
                    const on = opt === tz;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => {
                          setTz(opt);
                          setTzOpen(false);
                        }}
                        style={[s.chip, on && s.chipOn]}
                      >
                        <Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>
                          {opt.replace(/_/g, " ")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Animated.View>
              ) : null}
            </Appear>
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={s.section}>{section.title}</Text>}
        renderItem={({ item, index, section }) => {
          const { time, ap: itemAp } = timeParts(item.scheduledAt, tz);
          const st = status(item);
          const dim = section.title === "Earlier";
          return (
            <Appear index={index} style={[s.row, dim && s.rowDim]}>
              <View style={s.rowTime}>
                <Text style={[s.rowClock, dim && { color: colors.textMuted }]}>{time}</Text>
                <Text style={s.rowAp}>{itemAp}</Text>
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={s.rowDate}>
                  {new Date(item.scheduledAt).toLocaleDateString("en-IN", { timeZone: tz, weekday: "short", day: "numeric", month: "short" })}
                </Text>
                <Badge label={st.label} tone={st.tone} />
              </View>
              <IconButton
                icon="trash-outline"
                tone="danger"
                accessibilityLabel={`Delete ${item.label}`}
                onPress={() => deleteAlarm.mutate(item.id, { onError: (e) => toastError(getApiError(e), "Could not delete") })}
              />
            </Appear>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <View>{[0, 1].map((i) => <Skeleton key={i} height={92} />)}</View>
          ) : isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load alarms"
              subtitle={getApiError(error)}
              action={{ label: "Try again", onPress: () => void refetch() }}
            />
          ) : (
            <EmptyState
              icon="alarm-outline"
              title="No alarms yet"
              subtitle={"Set one here, or just tell xTanBot “wake me up at 7”."}
              action={{ label: "Set an alarm", onPress: openSheet }}
            />
          )
        }
      />

      {/* New-alarm bottom sheet */}
      <Modal visible={sheetOpen} transparent animationType="none" onRequestClose={() => setSheetOpen(false)}>
        <Animated.View entering={FadeIn.duration(180)} style={s.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(180)}
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>New alarm</Text>

            {/* Big preview of the chosen time */}
            <View style={s.previewRow}>
              <Pressable onPress={() => nudge(-1)} hitSlop={6} accessibilityLabel="One minute earlier"
                style={({ pressed }) => [s.nudge, pressed && { opacity: 0.6 }]}>
                <Ionicons name="remove" size={18} color={colors.text} />
                <Text style={s.nudgeText}>1 min</Text>
              </Pressable>
              <View style={s.preview}>
                <Text style={s.previewTime}>
                  {to12(hour).hh}:{pad2(minute)}
                </Text>
                <Text style={s.previewAp}>{to12(hour).ap}</Text>
              </View>
              <Pressable onPress={() => nudge(1)} hitSlop={6} accessibilityLabel="One minute later"
                style={({ pressed }) => [s.nudge, pressed && { opacity: 0.6 }]}>
                <Ionicons name="add" size={18} color={colors.text} />
                <Text style={s.nudgeText}>1 min</Text>
              </Pressable>
            </View>
            <Text style={s.previewSub}>
              {dayOffset ? "Tomorrow" : "Today"} · {ymd} · {tz.replace(/_/g, " ")}
            </Text>

            <View style={s.segment}>
              {(["Today", "Tomorrow"] as const).map((d, i) => (
                <Pressable key={d} onPress={() => setDayOffset(i as 0 | 1)} style={[s.segBtn, dayOffset === i && s.segBtnOn]}>
                  <Text style={[s.segText, dayOffset === i && s.segTextOn]}>{d}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.fieldLabel}>Quick set</Text>
            <View style={s.presets}>
              {[
                { l: "+10 min", f: () => preset(10) },
                { l: "+30 min", f: () => preset(30) },
                { l: "+1 hour", f: () => preset(60) },
                {
                  l: "7:00 AM tmrw",
                  f: () => {
                    setDayOffset(1);
                    setHour(7);
                    setMinute(0);
                  },
                },
              ].map((p) => (
                <Pressable key={p.l} onPress={p.f} style={({ pressed }) => [s.chip, pressed && { opacity: 0.7 }]}>
                  <Text style={s.chipText}>{p.l}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.fieldLabel}>Hour</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pickRow}>
              {HOURS.map((h) => (
                <Pressable key={h} onPress={() => setHour(h)} style={[s.num, hour === h && s.numOn]}>
                  <Text style={[s.numText, hour === h && s.numTextOn]}>{to12(h).hh}</Text>
                  <Text style={[s.numSub, hour === h && s.numTextOn]}>{to12(h).ap}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>Minute</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pickRow}>
              {/* Keep an off-grid minute (from ±1 or a preset) selectable alongside the 5-min steps. */}
              {(MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b)).map((m) => (
                <Pressable key={m} onPress={() => setMinute(m)} style={[s.num, minute === m && s.numOn]}>
                  <Text style={[s.numText, minute === m && s.numTextOn]}>:{pad2(m)}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>Label</Text>
            <TextInput
              style={s.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Wake up alarm"
              placeholderTextColor={colors.textSubtle}
            />

            <View style={s.sheetActions}>
              <PrimaryButton label="Cancel" tone="neutral" onPress={() => setSheetOpen(false)} style={{ flex: 1 }} />
              <PrimaryButton label="Set alarm" icon="alarm" onPress={submit} loading={createAlarm.isPending} style={{ flex: 1.4 }} />
            </View>
          </ScrollView>
        </Animated.View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 24, width: "100%", maxWidth: 820, alignSelf: "center" },

  clockCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#1a1505",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
  },
  clockRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  clockTime: { color: colors.text, fontSize: 64, fontWeight: "800", letterSpacing: -2, lineHeight: 70, fontVariant: ["tabular-nums"] },
  clockSide: { paddingBottom: 10 },
  clockSec: { color: colors.accent, fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },
  clockAp: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  clockDate: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
  clockFooter: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 16 },
  tzPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 220,
  },
  tzPillText: { color: colors.textMuted, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  nextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  nextText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  tzGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },

  section: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginHorizontal: 24,
    marginTop: 4,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  rowDim: { opacity: 0.6 },
  rowTime: { minWidth: 76 },
  rowClock: { color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
  rowAp: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: -2 },
  rowBody: { flex: 1, gap: 4 },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  rowDate: { color: colors.textMuted, fontSize: 13 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "90%",
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 12 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 14 },
  preview: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 6 },
  nudge: {
    alignItems: "center", justifyContent: "center", width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong,
  },
  nudgeText: { color: colors.textMuted, fontSize: 10, fontWeight: "700", marginTop: 1 },
  previewTime: { color: colors.text, fontSize: 56, fontWeight: "800", letterSpacing: -1.5, fontVariant: ["tabular-nums"] },
  previewAp: { color: colors.accent, fontSize: 20, fontWeight: "800", paddingBottom: 10 },
  previewSub: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginBottom: 16 },
  segment: { flexDirection: "row", backgroundColor: colors.bg, borderRadius: radius.pill, padding: 4, marginBottom: 6 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: "center" },
  segBtnOn: { backgroundColor: colors.surfaceAlt },
  segText: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
  segTextOn: { color: colors.text },
  fieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600", marginTop: 14, marginBottom: 8 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: "rgba(251,191,36,0.5)" },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600", maxWidth: 160 },
  chipTextOn: { color: colors.accent },
  pickRow: { gap: 8, paddingVertical: 2 },
  num: {
    minWidth: 52,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
  },
  numOn: { backgroundColor: colors.accent },
  numText: { color: colors.text, fontWeight: "700", fontSize: 16, fontVariant: ["tabular-nums"] },
  numSub: { color: colors.textMuted, fontWeight: "700", fontSize: 10 },
  numTextOn: { color: colors.onAccent },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}),
  },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 20 },
});
