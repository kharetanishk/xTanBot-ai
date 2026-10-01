import { useEffect, useId, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import XtanCharacter from "../character/XtanCharacter";
import { colors, radius } from "../../theme";

/**
 * The voice-call screen UI, shared by web (VoiceScreen.tsx) and native (VoiceScreen.native.tsx);
 * those files only wire LiveKit and pass state/levels in.
 */
export type VoiceStageProps = {
  /** LiveKit agent state: connecting | initializing | listening | thinking | speaking | … */
  state: string;
  /** 0..1 loudness of xTan's voice (drives lip-sync + rings while she speaks). */
  agentLevel: number;
  /** 0..1 loudness of the user's mic (rings + mute button while she listens). */
  micLevel: number;
  /** Latest thing she said (grows word-by-word, synced to her audio by LiveKit). */
  caption: string;
  /** Id of the sentence segment the caption belongs to — changes once per sentence. */
  captionId?: string;
  muted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  onChat: () => void;
};

const STATUS: Record<string, { label: string; color: string }> = {
  connecting: { label: "Connecting", color: colors.textMuted },
  initializing: { label: "Waking up", color: colors.textMuted },
  listening: { label: "Listening", color: colors.success },
  thinking: { label: "Thinking", color: colors.info },
  speaking: { label: "Speaking", color: colors.accent },
};

const HINT: Record<string, string> = {
  connecting: "Connecting you to xTan…",
  initializing: "She's getting ready…",
  listening: "Go ahead — I'm listening.",
  thinking: "Hmm, let me think…",
};

export default function VoiceStage({ state, agentLevel, micLevel, caption, captionId, muted, onToggleMute, onEnd, onChat }: VoiceStageProps) {
  const { width, height } = useWindowDimensions();
  const charSize = Math.min(290, height * 0.36, width * 0.68);
  const speaking = state === "speaking";
  const listening = state === "listening" && !muted;
  const status = muted && state === "listening" ? { label: "Muted", color: colors.danger } : (STATUS[state] ?? STATUS.connecting!);

  // Smoothed audio level that drives the rings.
  const level = useSharedValue(0);
  useEffect(() => {
    const target = speaking ? agentLevel * 3.2 : listening ? micLevel * 3.2 : 0;
    level.value = withTiming(Math.min(1, target), { duration: 90 });
  }, [speaking, listening, agentLevel, micLevel, level]);

  // Ambient glow breathes; warmer while she talks.
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withSequence(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 4200, easing: Easing.inOut(Easing.sin) })), -1);
  }, [breathe]);
  const glowA = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.55, 0.9]),
    transform: [{ translateX: interpolate(breathe.value, [0, 1], [-30, 30]) }, { scale: 1 + level.value * 0.15 }],
  }));
  const glowB = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.8, 0.45]),
    transform: [{ translateY: interpolate(breathe.value, [0, 1], [20, -20]) }],
  }));

  const timer = useCallTimer(state);
  const line = speaking || (caption && state !== "listening" && state !== "thinking") ? caption : HINT[state] ?? "";

  return (
    <View style={s.root}>
      {/* Ambient light */}
      <Animated.View pointerEvents="none" style={[s.glow, { top: height * 0.02 }, glowA]}>
        <SoftGlow size={Math.max(width, 520) * 1.2} color="#FBBF24" opacity={0.22} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[s.glow, { bottom: -height * 0.12 }, glowB]}>
        <SoftGlow size={Math.max(width, 520)} color="#818cf8" opacity={0.16} />
      </Animated.View>

      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
          <Pressable onPress={onEnd} style={s.headerBtn} accessibilityLabel="Close">
            <Ionicons name="chevron-down" size={22} color={colors.text} />
          </Pressable>
          <View style={s.headerMid}>
            <Text style={s.name}>xTan</Text>
            <StatusPill label={status.label} color={status.color} pulse={state === "listening" || speaking} />
          </View>
          <View style={s.timerBox}>
            <Text style={s.timer}>{timer}</Text>
          </View>
        </Animated.View>

        {/* Stage */}
        <View style={s.stage}>
          <Rings level={level} active={speaking || listening} color={speaking ? colors.accent : colors.success} size={charSize * 1.25} />
          <View style={{ alignItems: "center" }}>
            <XtanCharacter size={charSize} level={speaking ? agentLevel : 0} />
            {state === "thinking" ? <Orbit size={charSize * 0.42} /> : null}
          </View>
          {state === "connecting" || state === "initializing" ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={s.connecting}>
              <ActivityIndicator color={colors.accent} />
            </Animated.View>
          ) : null}
        </View>

        {/* Live caption */}
        <View style={s.captionBox}>
          {/* Keyed per sentence/hint (not per word) so words flow in without the line remounting. */}
          <Animated.Text key={speaking || caption === line ? `seg-${captionId ?? ""}` : `hint-${state}`} entering={FadeIn.duration(200)} style={[s.caption, !speaking && s.captionHint]} numberOfLines={4}>
            {line}
          </Animated.Text>
        </View>

        {/* Controls */}
        <Animated.View entering={FadeInDown.duration(450).delay(150)} style={s.dock}>
          <MuteButton muted={muted} micLevel={micLevel} onPress={onToggleMute} />
          <Pressable onPress={onEnd} style={({ pressed }) => [s.endBtn, pressed && s.pressed]} accessibilityLabel="End call">
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </Pressable>
          <DockButton icon="chatbubble-ellipses-outline" label="Chat" onPress={onChat} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/** Error / loading shell with the same look. */
export function VoiceStageMessage({ message, onClose }: { message?: string; onClose: () => void }) {
  return (
    <View style={[s.root, { alignItems: "center", justifyContent: "center", padding: 32, gap: 18 }]}>
      <XtanCharacter size={150} variant="bust" still={!!message} />
      {message ? (
        <>
          <Text style={s.errTitle}>Couldn't connect</Text>
          <Text style={s.errBody}>{message}</Text>
          <Pressable onPress={onClose} style={({ pressed }) => [s.errBtn, pressed && s.pressed]}>
            <Text style={s.errBtnText}>Go back</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.errBody}>Calling xTan…</Text>
        </>
      )}
    </View>
  );
}

function useCallTimer(state: string) {
  const started = useRef<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!started.current && (state === "listening" || state === "speaking" || state === "thinking")) started.current = Date.now();
  }, [state]);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!started.current) return "00:00";
  const sec = Math.floor((Date.now() - started.current) / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

/** Soft radial light (real gradient, so no hard edge). */
function SoftGlow({ size, color, opacity }: { size: number; color: string; opacity: number }) {
  const id = `sg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

function StatusPill({ label, color, pulse }: { label: string; color: string; pulse: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = pulse ? withRepeat(withTiming(1, { duration: 900 }), -1, true) : 0;
  }, [pulse, v]);
  const dot = useAnimatedStyle(() => ({ opacity: 0.45 + v.value * 0.55, transform: [{ scale: 1 + v.value * 0.35 }] }));
  return (
    <View style={[s.pill, { borderColor: `${color}55`, backgroundColor: `${color}1a` }]}>
      <Animated.View style={[s.pillDot, { backgroundColor: color }, dot]} />
      <Text style={[s.pillText, { color }]}>{label}</Text>
    </View>
  );
}

/** Three concentric rings that swell with the live audio level. */
function Rings({ level, active, color, size }: { level: SharedValue<number>; active: boolean; color: string; size: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      {[0, 1, 2].map((i) => (
        <Ring key={i} i={i} level={level} active={active} color={color} size={size} />
      ))}
    </View>
  );
}

function Ring({ i, level, active, color, size }: { i: number; level: SharedValue<number>; active: boolean; color: string; size: number }) {
  const idle = useSharedValue(0);
  useEffect(() => {
    idle.value = withRepeat(withTiming(1, { duration: 2600 + i * 500, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [idle, i]);
  const a = useAnimatedStyle(() => ({
    opacity: (active ? 0.5 : 0.18) - i * 0.12 + level.value * 0.3,
    transform: [{ scale: 0.82 + i * 0.16 + idle.value * 0.03 + level.value * (0.12 + i * 0.08) }],
  }));
  return <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 2 - i * 0.5, borderColor: color }, a]} />;
}

/** "Thinking" — three glowing dots circling above her head like a halo. */
function Orbit({ size }: { size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(Math.PI * 2, { duration: 1800, easing: Easing.linear }), -1);
  }, [t]);
  return (
    <View pointerEvents="none" style={[s.orbit, { width: size, height: size * 0.3, top: -size * 0.12 }]}>
      {[0, 1, 2].map((i) => (
        <OrbitDot key={i} t={t} phase={(i * Math.PI * 2) / 3} rx={size / 2} ry={size * 0.15} />
      ))}
    </View>
  );
}

function OrbitDot({ t, phase, rx, ry }: { t: SharedValue<number>; phase: number; rx: number; ry: number }) {
  const a = useAnimatedStyle(() => {
    const ang = t.value + phase;
    const front = Math.sin(ang); // >0 = near side of the halo
    return {
      transform: [{ translateX: Math.cos(ang) * rx }, { translateY: front * ry }, { scale: 0.75 + (front + 1) * 0.2 }],
      opacity: 0.55 + (front + 1) * 0.22,
    };
  });
  return <Animated.View style={[s.orbitDot, a]} />;
}

function MuteButton({ muted, micLevel, onPress }: { muted: boolean; micLevel: number; onPress: () => void }) {
  const lv = useSharedValue(0);
  useEffect(() => {
    lv.value = withTiming(muted ? 0 : Math.min(1, micLevel * 4), { duration: 80 });
  }, [micLevel, muted, lv]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + lv.value * 0.35 }], opacity: 0.25 + lv.value * 0.6 }));
  return (
    <View style={s.dockItem}>
      <View style={s.muteWrap}>
        <Animated.View style={[s.muteRing, ring]} />
        <Pressable onPress={onPress} style={({ pressed }) => [s.dockBtn, muted && s.dockBtnMuted, pressed && s.pressed]} accessibilityLabel={muted ? "Unmute" : "Mute"}>
          <Ionicons name={muted ? "mic-off" : "mic"} size={24} color={muted ? colors.danger : colors.text} />
        </Pressable>
      </View>
      <Text style={s.dockLabel}>{muted ? "Unmute" : "Mute"}</Text>
    </View>
  );
}

function DockButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void }) {
  return (
    <View style={s.dockItem}>
      <Pressable onPress={onPress} style={({ pressed }) => [s.dockBtn, pressed && s.pressed]} accessibilityLabel={label}>
        <Ionicons name={icon} size={24} color={colors.text} />
      </Pressable>
      <Text style={s.dockLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#06060a", overflow: "hidden" },
  safe: { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" },
  glow: { position: "absolute", alignSelf: "center" },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 8, gap: 12 },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerMid: { flex: 1, alignItems: "center", gap: 6 },
  name: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  pill: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  timerBox: { width: 42, alignItems: "flex-end" },
  timer: { color: colors.textMuted, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },

  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  connecting: { position: "absolute", bottom: "6%" },
  orbit: { position: "absolute", alignSelf: "center" },
  orbitDot: { position: "absolute", left: "50%", top: "50%", marginLeft: -6, marginTop: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.info, shadowColor: colors.info, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },

  captionBox: { minHeight: 104, paddingHorizontal: 28, justifyContent: "center" },
  caption: { color: colors.text, fontSize: 21, lineHeight: 30, fontWeight: "600", textAlign: "center", letterSpacing: -0.2 },
  captionHint: { color: colors.textMuted, fontSize: 17, fontWeight: "500" },

  dock: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-evenly",
    marginHorizontal: 22,
    marginBottom: 14,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 32,
    backgroundColor: "rgba(17,24,39,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  dockItem: { alignItems: "center", gap: 8, width: 76 },
  dockBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  dockBtnMuted: { backgroundColor: colors.dangerSoft },
  dockLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  muteWrap: { width: 58, height: 58, alignItems: "center", justifyContent: "center" },
  muteRing: { position: "absolute", width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: colors.success },
  endBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -7,
    shadowColor: "#ef4444",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },

  errTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  errBody: { color: colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  errBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 26, paddingVertical: 13 },
  errBtnText: { color: colors.onAccent, fontWeight: "800", fontSize: 15 },
});
