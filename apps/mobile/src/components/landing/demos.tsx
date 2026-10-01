import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors, radius } from "../../theme";

/** Live mini-demos of each feature, played when their landing chapter scrolls into view. */
// ── Feature demos ────────────────────────────────────────────────────────────

/** Steps through `n` stages on a timer, e.g. dialing → on call → booked. */
function useStages(timings: number[]) {
  const [stage, setStage] = useState(0);
  const ref = useRef(timings);
  useEffect(() => {
    const timers = ref.current.map((ms, i) => setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  return stage;
}

function DemoCard({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

export function IntroDemo() {
  const chips: [string, React.ComponentProps<typeof Ionicons>["name"]][] = [
    ["Makes calls", "call"],
    ["Books meetings", "calendar"],
    ["Wakes you up", "alarm"],
    ["Searches the web", "search"],
    ["Talks back", "mic"],
  ];
  return (
    <DemoCard>
      <Text style={s.cardKicker}>MEET XTAN</Text>
      <Text style={s.cardTitle}>Your assistant who actually picks up the phone.</Text>
      <View style={s.chips}>
        {chips.map(([label, icon], i) => (
          <Animated.View key={label} entering={ZoomIn.delay(500 + i * 160).springify()} style={s.chip}>
            <Ionicons name={icon} size={14} color={colors.accent} />
            <Text style={s.chipText}>{label}</Text>
          </Animated.View>
        ))}
      </View>
    </DemoCard>
  );
}

export function CallDemo() {
  const stage = useStages([1300, 4200]);
  return (
    <DemoCard>
      <View style={s.row}>
        <View style={[s.tile, { backgroundColor: colors.successSoft }]}>
          <Ionicons name="medkit" size={20} color={colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitleSm}>Smile Dental Clinic</Text>
          <Text style={s.muted}>+91 98123 45678</Text>
        </View>
        {stage < 2 ? <PulseDot color={stage === 0 ? colors.accent : colors.success} /> : null}
      </View>
      <View style={s.callBody}>
        {stage === 0 ? <Text style={s.status}>📞 Dialing…</Text> : null}
        {stage === 1 ? (
          <Animated.View entering={FadeIn} style={s.row}>
            <SoundBars color={colors.success} />
            <Text style={[s.status, { color: colors.success }]}>xTan is talking to the clinic</Text>
          </Animated.View>
        ) : null}
        {stage === 2 ? (
          <Animated.View entering={ZoomIn.springify()} style={s.success}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <View>
              <Text style={s.successTitle}>Appointment booked</Text>
              <Text style={s.muted}>Friday · 4:00 PM · Dr. Rao</Text>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </DemoCard>
  );
}

export function MeetingDemo() {
  const stage = useStages([2600]);
  return (
    <DemoCard>
      <View style={s.row}>
        <View style={[s.dateBlock]}>
          <Text style={s.dateMonth}>OCT</Text>
          <Text style={s.dateDay}>2</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitleSm}>Design review</Text>
          <Text style={s.muted}>5:00 – 5:30 PM · Agenda: launch plan</Text>
        </View>
      </View>
      <View style={[s.chips, { marginTop: 12 }]}>
        {["Aarav", "Neha", "Jordan"].map((n, i) => (
          <Animated.View key={n} entering={FadeInRight.delay(300 + i * 350)} style={s.person}>
            <Text style={s.personText}>{n}</Text>
            {stage === 1 ? <Ionicons name="checkmark" size={13} color={colors.success} /> : null}
          </Animated.View>
        ))}
      </View>
      {stage === 1 ? (
        <Animated.Text entering={FadeInDown} style={[s.status, { color: colors.success, marginTop: 10 }]}>
          ✓ Everyone confirmed by phone
        </Animated.Text>
      ) : (
        <Text style={[s.status, { marginTop: 10 }]}>Calling attendees to confirm…</Text>
      )}
    </DemoCard>
  );
}

export function AlarmDemo() {
  const wiggle = useSharedValue(0);
  useEffect(() => {
    wiggle.value = withRepeat(withSequence(withTiming(1, { duration: 80 }), withTiming(-1, { duration: 80 })), -1, true);
  }, [wiggle]);
  const bell = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.value * 14}deg` }] }));
  return (
    <DemoCard>
      <View style={s.row}>
        <Animated.View style={[s.tile, { backgroundColor: colors.accentSoft }, bell]}>
          <Ionicons name="alarm" size={22} color={colors.accent} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={s.alarmTime}>7:00 AM</Text>
          <Text style={s.muted}>Wake up · Every weekday</Text>
        </View>
      </View>
      <View style={[s.row, { marginTop: 14 }]}>
        <SoundBars color={colors.accent} />
        <Text style={[s.status, { color: colors.accent }]}>Incoming call from xTanBot…</Text>
      </View>
      <View style={[s.row, { marginTop: 14, gap: 10 }]}>
        <View style={[s.pillBtn, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={s.pillText}>Snooze</Text>
        </View>
        <View style={[s.pillBtn, { backgroundColor: colors.accent }]}>
          <Text style={[s.pillText, { color: colors.onAccent }]}>I'm up! ☀️</Text>
        </View>
      </View>
    </DemoCard>
  );
}

export function SearchDemo() {
  const stage = useStages([1200, 2200]);
  return (
    <DemoCard>
      <View style={s.userMsg}>
        <Text style={s.userMsgText}>Best cafe near me? ☕</Text>
      </View>
      {stage === 1 ? (
        <Animated.View entering={FadeIn} style={[s.row, { marginTop: 10 }]}>
          <Ionicons name="search" size={14} color={colors.textMuted} />
          <Text style={s.muted}>Searching the web…</Text>
        </Animated.View>
      ) : null}
      {stage === 2
        ? [
            ["Brew Lab", "⭐ 4.7 · 1.2 km · Open now"],
            ["The Coffee House", "⭐ 4.5 · 2.0 km · Great for work"],
          ].map(([title, meta], i) => (
            <Animated.View key={title} entering={FadeInDown.delay(i * 200)} style={s.result}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitleSm}>{title}</Text>
                <Text style={s.muted}>{meta}</Text>
              </View>
              <View style={[s.tile, { width: 34, height: 34, backgroundColor: colors.accentSoft }]}>
                <Ionicons name="call" size={15} color={colors.accent} />
              </View>
            </Animated.View>
          ))
        : null}
    </DemoCard>
  );
}

export function VoiceDemo() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }), -1);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - pulse.value, transform: [{ scale: 1 + pulse.value * 0.9 }] }));
  return (
    <DemoCard>
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <View style={s.micWrap}>
          <Animated.View style={[s.micRing, ring]} />
          <View style={s.mic}>
            <Ionicons name="mic" size={30} color={colors.onAccent} />
          </View>
        </View>
        <View style={[s.row, { marginTop: 18 }]}>
          <SoundBars color={colors.accent} bars={9} />
        </View>
        <Text style={[s.status, { marginTop: 10 }]}>Listening… just say it.</Text>
      </View>
    </DemoCard>
  );
}

export function OutroDemo() {
  return (
    <DemoCard>
      {["Free to start", "Works on web, Android & iOS", "Speaks English & Hinglish", "Your data stays yours"].map((t, i) => (
        <Animated.View key={t} entering={FadeInRight.delay(250 + i * 180)} style={[s.row, { marginBottom: 10 }]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={s.checkText}>{t}</Text>
        </Animated.View>
      ))}
    </DemoCard>
  );
}

function PulseDot({ color }: { color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [v]);
  const a = useAnimatedStyle(() => ({ opacity: 0.35 + v.value * 0.65 }));
  return <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }, a]} />;
}

export function SoundBars({ color, bars = 5 }: { color: string; bars?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 22 }}>
      {Array.from({ length: bars }, (_, i) => (
        <Bar key={i} color={color} delay={i * 90} />
      ))}
    </View>
  );
}

function Bar({ color, delay }: { color: string; delay: number }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 260 }), withTiming(0.25, { duration: 300 })), -1));
  }, [v, delay]);
  const a = useAnimatedStyle(() => ({ height: 4 + v.value * 18 }));
  return <Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: color }, a]} />;
}

const s = StyleSheet.create({


  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  cardKicker: { color: colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 6, lineHeight: 24 },
  cardTitleSm: { color: colors.text, fontSize: 15, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  tile: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  callBody: { marginTop: 14, minHeight: 46, justifyContent: "center" },
  status: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  success: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.successSoft, borderRadius: radius.md, padding: 12 },
  successTitle: { color: colors.success, fontSize: 15, fontWeight: "800" },
  dateBlock: { width: 50, height: 54, borderRadius: radius.md, backgroundColor: colors.infoSoft, alignItems: "center", justifyContent: "center" },
  dateMonth: { color: colors.info, fontSize: 11, fontWeight: "800" },
  dateDay: { color: colors.text, fontSize: 20, fontWeight: "800" },
  person: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  personText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  alarmTime: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  pillBtn: { flex: 1, borderRadius: radius.pill, paddingVertical: 10, alignItems: "center" },
  pillText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  userMsg: { alignSelf: "flex-end", backgroundColor: colors.surfaceAlt, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 },
  userMsgText: { color: colors.text, fontSize: 15 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  micWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  micRing: { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent },
  mic: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  checkText: { color: colors.text, fontSize: 15, fontWeight: "600" },

});
