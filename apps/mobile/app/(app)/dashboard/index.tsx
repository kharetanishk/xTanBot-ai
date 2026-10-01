import { useEffect, useId, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { hrefDashboardCalls, hrefDashboardMeetings, hrefTab } from "../../../src/navigation/href";
import { useAuthStore } from "../../../src/stores/auth.store";
import { useMe } from "../../../src/hooks/useAuth";
import { useCalls } from "../../../src/hooks/useCalls";
import { useUpcomingMeetings } from "../../../src/hooks/useMeetings";
import { useContacts } from "../../../src/hooks/useContacts";
import { useAlarms } from "../../../src/hooks/useAlarms";
import CallCard from "../../../src/components/calls/CallCard";
import MeetingCard from "../../../src/components/meetings/MeetingCard";
import XtanCharacter from "../../../src/components/character/XtanCharacter";
import { Appear, BarChart, GradientIcon, Screen, SectionTitle, Skeleton, type Gradient, type IconName } from "../../../src/components/ui";
import { colors, radius } from "../../../src/theme";
import type { Call } from "../../../src/types/api.types";

const DISPLAY = "BricolageGrotesque_800ExtraBold";
const BOLD = "BricolageGrotesque_700Bold";

const SUGGESTIONS: { emoji: string; text: string }[] = [
  { emoji: "🦷", text: "Book a dentist for Friday evening" },
  { emoji: "⏰", text: "Wake me up at 7 AM tomorrow" },
  { emoji: "☕", text: "Find a good café near me" },
  { emoji: "📅", text: "Schedule a team sync at 5 PM" },
  { emoji: "💬", text: "WhatsApp mom good night" },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const firstName = (name?: string) => {
  const f = name?.split(/[\s_]+/)[0] ?? "";
  return f ? f[0]!.toUpperCase() + f.slice(1) : "there";
};
const initials = (name?: string) =>
  (name ?? "?")
    .split(/[\s_]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** Calls per day for the last 7 days (local time), oldest → today. */
function lastSevenDays(calls: Call[]) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - i));
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const value = calls.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return t >= day.getTime() && t < next.getTime();
    }).length;
    return { label: i === 6 ? "Today" : day.toLocaleDateString("en-IN", { weekday: "short" }), value };
  });
}

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const storeUser = useAuthStore((s) => s.user);
  const { data: apiUser } = useMe();
  const user = apiUser ?? storeUser;
  const { data: calls = [], isLoading: callsLoading } = useCalls({ refetchInterval: 5000 });
  const { data: upcoming = [], isLoading: meetingsLoading } = useUpcomingMeetings();
  const { data: contacts = [] } = useContacts();
  const { data: alarms = [] } = useAlarms();

  const [waving, setWaving] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setWaving(false), 2600);
    return () => clearTimeout(t);
  }, []);

  const sortedCalls = useMemo(() => [...calls].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [calls]);
  const week = useMemo(() => lastSevenDays(calls), [calls]);
  const weekCalls = calls.filter((c) => Date.now() - +new Date(c.createdAt) < 7 * 864e5);
  const completed = weekCalls.filter((c) => c.status === "completed");
  const completionRate = weekCalls.length ? Math.round((completed.length / weekCalls.length) * 100) : 0;
  const durations = completed.map((c) => c.duration ?? 0).filter(Boolean);
  const avgDur = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const busiest = week.reduce((b, d) => (d.value > b.value ? d : b), week[0]!);
  const activeCalls = calls.filter((c) => ["in-progress", "ringing", "initiated"].includes(c.status)).length;
  const nextAlarm = alarms
    .filter((a) => a.status === "scheduled" && +new Date(a.scheduledAt) > Date.now())
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const nextMeeting = upcoming[0];

  const stats: { label: string; value: number; sub: string; icon: IconName; gradient: Gradient; to: Href }[] = [
    { label: "Calls", value: calls.length, sub: `${weekCalls.length} this week`, icon: "call", gradient: "amber", to: hrefDashboardCalls() },
    {
      label: "Meetings",
      value: upcoming.length,
      sub: nextMeeting ? `Next: ${nextMeeting.title}` : "Nothing scheduled",
      icon: "calendar",
      gradient: "indigo",
      to: hrefDashboardMeetings(),
    },
    { label: "Contacts", value: contacts.length, sub: "people xTan can reach", icon: "people", gradient: "emerald", to: hrefTab("contacts") },
    {
      label: "Alarms",
      value: nextAlarm.length,
      sub: nextAlarm[0] ? `Next: ${time(nextAlarm[0].scheduledAt)}` : "None set",
      icon: "alarm",
      gradient: "rose",
      to: hrefTab("alarms"),
    },
  ];

  const actions: { label: string; icon: IconName; gradient: Gradient; to: Href }[] = [
    { label: "New call", icon: "call", gradient: "amber", to: "/(app)/call/new" },
    { label: "Meeting", icon: "calendar", gradient: "indigo", to: "/(app)/meeting/new" },
    { label: "Alarm", icon: "alarm", gradient: "rose", to: hrefTab("alarms") },
    { label: "Contact", icon: "person-add", gradient: "emerald", to: "/(app)/contact/new" },
  ];

  const gid = `h${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const ask = (text: string) => router.push({ pathname: "/dashboard/chat", params: { prefill: text } } as unknown as Href);
  const wide = width >= 700;

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <Appear style={s.header}>
          <View style={{ flex: 1 }}>
            <View style={s.dateChip}>
              <Ionicons name="sunny" size={12} color={colors.accent} />
              <Text style={s.dateText}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</Text>
            </View>
            <Text style={s.hello}>{greeting()},</Text>
            <Text style={s.name} numberOfLines={1}>
              {firstName(user?.name)} <Text style={{ color: colors.accent }}>✦</Text>
            </Text>
          </View>
          <Pressable onPress={() => router.push(hrefTab("settings"))} accessibilityLabel="Open settings" style={s.avatarRing}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials(user?.name)}</Text>
            </View>
          </Pressable>
        </Appear>

        {/* ── Hero ── */}
        <Appear index={1}>
          <View style={s.hero}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <RadialGradient id={`${gid}a`} cx="85%" cy="70%" r="75%">
                  <Stop offset="0" stopColor="#FBBF24" stopOpacity={0.35} />
                  <Stop offset="0.5" stopColor="#F59E0B" stopOpacity={0.08} />
                  <Stop offset="1" stopColor="#F59E0B" stopOpacity={0} />
                </RadialGradient>
                <RadialGradient id={`${gid}b`} cx="0%" cy="0%" r="70%">
                  <Stop offset="0" stopColor="#818CF8" stopOpacity={0.18} />
                  <Stop offset="1" stopColor="#818CF8" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${gid}a)`} />
              <Rect width="100%" height="100%" fill={`url(#${gid}b)`} />
            </Svg>

            <View style={s.heroCopy}>
              <View style={s.livePill}>
                <LiveDot />
                <Text style={s.liveText}>xTan is online</Text>
              </View>
              <Text style={s.heroTitle}>What should I handle for you today?</Text>
              <View style={s.heroBtns}>
                <Pressable onPress={() => router.push("/voice")} style={({ pressed }) => [s.talkBtn, pressed && s.pressed]}>
                  <Ionicons name="mic" size={18} color={colors.onAccent} />
                  <Text style={s.talkText}>Talk to xTan</Text>
                </Pressable>
                <Pressable onPress={() => router.push(hrefTab("chat"))} style={({ pressed }) => [s.typeBtn, pressed && s.pressed]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.text} />
                  <Text style={s.typeText}>Type</Text>
                </Pressable>
              </View>
            </View>
            <View style={s.heroChar} pointerEvents="none">
              <XtanCharacter size={wide ? 170 : width < 380 ? 92 : 128} wave={waving} />
            </View>
          </View>
        </Appear>

        {/* ── Suggestions ── */}
        <Appear index={2}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipsScroll}>
            {SUGGESTIONS.map((sg) => (
              <Pressable key={sg.text} onPress={() => ask(sg.text)} style={({ pressed }) => [s.chip, pressed && s.pressed]}>
                <Text style={s.chipEmoji}>{sg.emoji}</Text>
                <Text style={s.chipText}>{sg.text}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Appear>

        {/* ── Stats ── */}
        <View style={s.statsGrid}>
          {stats.map((st, i) => (
            <Appear key={st.label} index={i + 3} style={[s.statCell, wide && { width: "25%" }]}>
              <Pressable onPress={() => router.push(st.to)} style={({ pressed }) => [s.statCard, pressed && s.pressed]}>
                <View style={s.statTop}>
                  <GradientIcon icon={st.icon} gradient={st.gradient} size={40} />
                  <Ionicons name="arrow-forward" size={16} color={colors.textSubtle} />
                </View>
                <Text style={s.statValue}>{callsLoading ? "–" : st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
                <Text style={s.statSub} numberOfLines={1}>
                  {st.sub}
                </Text>
              </Pressable>
            </Appear>
          ))}
        </View>

        {/* ── Activity ── */}
        <Appear index={7}>
          <View style={s.card}>
            <View style={s.chartHead}>
              <View>
                <Text style={s.cardTitle}>Call activity</Text>
                <Text style={s.cardSub}>Last 7 days</Text>
              </View>
              {activeCalls > 0 ? (
                <View style={s.livePillSm}>
                  <LiveDot color={colors.success} />
                  <Text style={[s.liveText, { color: colors.success }]}>{activeCalls} live</Text>
                </View>
              ) : null}
            </View>
            {weekCalls.length ? (
              <>
                <BarChart data={week} height={110} />
                <View style={s.metrics}>
                  <Metric label="Calls" value={String(weekCalls.length)} />
                  <Metric label="Completed" value={`${completionRate}%`} />
                  <Metric label="Avg length" value={avgDur ? `${Math.floor(avgDur / 60)}m ${avgDur % 60}s` : "—"} />
                  <Metric label="Busiest" value={busiest.value ? busiest.label : "—"} />
                </View>
              </>
            ) : (
              <View style={s.emptyChart}>
                <View style={s.ghostBars}>
                  {[30, 55, 40, 70, 45, 60, 35].map((h, i) => (
                    <View key={i} style={[s.ghostBar, { height: h }]} />
                  ))}
                </View>
                <Text style={s.emptyTitle}>No calls this week</Text>
                <Pressable onPress={() => ask("Call my dentist and book an appointment for Friday")}>
                  <Text style={s.emptyLink}>Ask xTan to make your first call →</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Appear>

        {/* ── Quick actions ── */}
        <Appear index={8}>
          <SectionTitle title="Quick actions" />
          <View style={s.actions}>
            {actions.map((a) => (
              <Pressable key={a.label} onPress={() => router.push(a.to)} style={({ pressed }) => [s.action, pressed && s.pressed]}>
                <GradientIcon icon={a.icon} gradient={a.gradient} size={46} />
                <Text style={s.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </Appear>

        {/* ── Recent calls ── */}
        <Appear index={9} style={s.section}>
          <SectionTitle title="Recent calls" action={sortedCalls.length ? { label: "See all", onPress: () => router.push(hrefDashboardCalls()) } : undefined} />
          {callsLoading ? (
            [0, 1].map((i) => <Skeleton key={i} />)
          ) : sortedCalls.length === 0 ? (
            <EmptyRow icon="call-outline" text="Calls xTan makes for you will show up here." />
          ) : (
            sortedCalls.slice(0, 3).map((call) => <CallCard key={call.id} call={call} onPress={() => router.push(`/(app)/call/${call.id}`)} />)
          )}
        </Appear>

        {/* ── Upcoming meetings ── */}
        <Appear index={10} style={s.section}>
          <SectionTitle title="Upcoming meetings" action={upcoming.length ? { label: "See all", onPress: () => router.push(hrefDashboardMeetings()) } : undefined} />
          {meetingsLoading ? (
            [0, 1].map((i) => <Skeleton key={i} />)
          ) : upcoming.length === 0 ? (
            <EmptyRow icon="calendar-outline" text="Nothing scheduled. Enjoy the free time ☕" />
          ) : (
            upcoming.slice(0, 3).map((m) => <MeetingCard key={m.id} meeting={m} onPress={() => router.push(`/(app)/meeting/${m.id}`)} />)
          )}
        </Appear>
      </ScrollView>
    </Screen>
  );
}

function LiveDot({ color = colors.accent }: { color?: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), -1);
  }, [v]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - v.value, transform: [{ scale: 1 + v.value * 1.6 }] }));
  return (
    <View style={{ width: 8, height: 8, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: color }, ring]} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function EmptyRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={s.emptyRow}>
      <Ionicons name={icon} size={18} color={colors.textSubtle} />
      <Text style={s.emptyRowText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, width: "100%", maxWidth: 900, alignSelf: "center" },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },

  header: { flexDirection: "row", alignItems: "flex-end", marginBottom: 20, gap: 12 },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  dateText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  hello: { color: colors.textMuted, fontSize: 18, fontFamily: BOLD },
  name: { color: colors.text, fontSize: 36, fontFamily: DISPLAY, letterSpacing: -1, marginTop: -2 },
  avatarRing: { padding: 2.5, borderRadius: 30, backgroundColor: colors.accent, marginBottom: 6 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#141006", alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.accent, fontFamily: DISPLAY, fontSize: 17 },

  hero: {
    minHeight: 200,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#100d05",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.28)",
    flexDirection: "row",
    marginBottom: 14,
  },
  heroCopy: { flex: 1, padding: 20, paddingRight: 0, gap: 12, justifyContent: "center", zIndex: 2 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: "rgba(251,191,36,0.12)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  livePillSm: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: colors.successSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  liveText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  heroTitle: { color: colors.text, fontSize: 24, lineHeight: 29, fontFamily: DISPLAY, letterSpacing: -0.6, maxWidth: 300 },
  heroBtns: { flexDirection: "row", gap: 10, marginTop: 4, flexWrap: "wrap" },
  talkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  talkText: { color: colors.onAccent, fontFamily: BOLD, fontSize: 15 },
  typeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typeText: { color: colors.text, fontFamily: BOLD, fontSize: 15 },
  heroChar: { justifyContent: "flex-end", marginBottom: -24, marginRight: -6, zIndex: 1 },

  chipsScroll: { marginHorizontal: -20, marginBottom: 18 },
  chips: { gap: 8, paddingHorizontal: 20 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipEmoji: { fontSize: 15 },
  chipText: { color: colors.text, fontSize: 14, fontWeight: "600" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6, marginBottom: 10 },
  statCell: { width: "50%", padding: 6 },
  statCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 24,
    padding: 16,
    gap: 2,
  },
  statTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
  statValue: { color: colors.text, fontSize: 32, fontFamily: DISPLAY, letterSpacing: -1 },
  statLabel: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: -2 },
  statSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 24,
    padding: 18,
    marginBottom: 24,
  },
  chartHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  cardTitle: { color: colors.text, fontSize: 18, fontFamily: BOLD },
  cardSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  metrics: { flexDirection: "row", marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  metric: { flex: 1, alignItems: "center", gap: 2 },
  metricValue: { color: colors.text, fontSize: 16, fontFamily: BOLD },
  metricLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: "600" },
  emptyChart: { alignItems: "center", gap: 8, paddingVertical: 4 },
  ghostBars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 74, marginBottom: 8 },
  ghostBar: { width: 22, borderRadius: 7, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.borderStrong },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  emptyLink: { color: colors.accent, fontSize: 14, fontWeight: "700" },

  actions: { flexDirection: "row", gap: 10, marginBottom: 26 },
  action: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 22,
    paddingVertical: 16,
  },
  actionLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },

  section: { marginBottom: 24 },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    borderRadius: 18,
    padding: 16,
  },
  emptyRowText: { color: colors.textMuted, fontSize: 14, flex: 1 },
});
