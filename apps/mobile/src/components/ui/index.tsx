import { useEffect, useId, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors, radius, toneColors, type Tone } from "../../theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/** Full-height dark page with safe top inset. */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView style={[ui.screen, style]} edges={["top", "left", "right"]}>
      {children}
    </SafeAreaView>
  );
}

/** Page title row: big title, muted subtitle, optional trailing action. */
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={ui.header}>
      <View style={{ flex: 1 }}>
        <Text style={ui.title}>{title}</Text>
        {subtitle ? <Text style={ui.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </Animated.View>
  );
}

/** Staggered fade-up entrance for list items and sections. */
export function Appear({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 55)} style={style}>
      {children}
    </Animated.View>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (!onPress) return <View style={[ui.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [ui.card, style, pressed && ui.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const c = toneColors[tone];
  return (
    <View style={[ui.badge, { backgroundColor: c.bg }]}>
      <View style={[ui.badgeDot, { backgroundColor: c.fg }]} />
      <Text style={[ui.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/** Rounded icon tile (used in lists, stats, quick actions). */
export function IconTile({ icon, tone = "accent", size = 40 }: { icon: IconName; tone?: Tone; size?: number }) {
  const c = toneColors[tone];
  return (
    <View style={[ui.iconTile, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: c.bg }]}>
      <Ionicons name={icon} size={size * 0.48} color={c.fg} />
    </View>
  );
}

export type Gradient = "amber" | "indigo" | "emerald" | "rose" | "sky" | "violet";

export const GRADIENTS: Record<Gradient, [string, string, string]> = {
  // [from, to, glyph colour]
  amber: ["#FDE68A", "#F59E0B", "#3b2300"],
  indigo: ["#A5B4FC", "#6366F1", "#ffffff"],
  emerald: ["#6EE7B7", "#059669", "#ffffff"],
  rose: ["#FDA4AF", "#E11D48", "#ffffff"],
  sky: ["#7DD3FC", "#0284C7", "#ffffff"],
  violet: ["#C4B5FD", "#7C3AED", "#ffffff"],
};

/** Two-tone gradient squircle with a glyph — richer than a flat tinted icon. */
export function GradientIcon({ icon, gradient = "amber", size = 44 }: { icon: IconName; gradient?: Gradient; size?: number }) {
  const [from, to, fg] = GRADIENTS[gradient];
  const id = `gi${useId().replace(/[^a-zA-Z0-9]/g, "")}`; // unique per instance (shared SVG id namespace on web)
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, shadowColor: to, shadowOpacity: 0.45, shadowRadius: size * 0.3, shadowOffset: { width: 0, height: size * 0.12 } }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} rx={size * 0.32} fill={`url(#${id})`} />
        {/* glossy top highlight */}
        <Rect x={size * 0.08} y={size * 0.06} width={size * 0.84} height={size * 0.38} rx={size * 0.2} fill="#ffffff" opacity={0.18} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name={icon} size={size * 0.5} color={fg} />
      </View>
    </View>
  );
}

/** Amber pill button with optional leading icon. */
export function PrimaryButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
  tone = "accent",
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "accent" | "danger" | "neutral";
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === "accent" ? colors.accent : tone === "danger" ? colors.danger : colors.surfaceAlt;
  const fg = tone === "accent" ? colors.onAccent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        ui.btn,
        { backgroundColor: bg },
        (disabled || loading) && { opacity: 0.55 },
        pressed && ui.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[ui.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Round icon-only button (header "+" etc.). */
export function IconButton({
  icon,
  onPress,
  tone = "accent",
  accessibilityLabel,
}: {
  icon: IconName;
  onPress: () => void;
  tone?: "accent" | "neutral" | "danger";
  accessibilityLabel?: string;
}) {
  const bg = tone === "accent" ? colors.accent : tone === "danger" ? colors.dangerSoft : colors.surfaceAlt;
  const fg = tone === "accent" ? colors.onAccent : tone === "danger" ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [ui.iconBtn, { backgroundColor: bg }, pressed && ui.pressed]}
    >
      <Ionicons name={icon} size={20} color={fg} />
    </Pressable>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={ui.sectionRow}>
      <Text style={ui.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={ui.sectionAction}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Appear style={ui.empty}>
      <IconTile icon={icon} size={64} tone="neutral" />
      <Text style={ui.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={ui.emptySub}>{subtitle}</Text> : null}
      {action ? <PrimaryButton label={action.label} onPress={action.onPress} style={{ marginTop: 18 }} /> : null}
    </Appear>
  );
}

/** Pulsing placeholder while data loads. */
export function Skeleton({ height = 72, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.45);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.9, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[ui.skeleton, { height }, a, style]} />;
}

/** Simple animated bar chart — no chart library needed. */
export function BarChart({
  data,
  height = 140,
  highlightLast = true,
}: {
  data: { label: string; value: number }[];
  height?: number;
  highlightLast?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={[ui.chart, { height: height + 40 }]}>
      {data.map((d, i) => (
        <Bar
          key={`${d.label}-${i}`}
          value={d.value}
          label={d.label}
          ratio={d.value / max}
          height={height}
          delay={i * 60}
          active={highlightLast && i === data.length - 1}
        />
      ))}
    </View>
  );
}

function Bar({
  value,
  label,
  ratio,
  height,
  delay,
  active,
}: {
  value: number;
  label: string;
  ratio: number;
  height: number;
  delay: number;
  active: boolean;
}) {
  const h = useSharedValue(0);
  useEffect(() => {
    // Minimum stub so empty days still read as a bar.
    h.value = withDelay(delay, withTiming(Math.max(ratio * height, 4), { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [ratio, height, delay, h]);
  const a = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <View style={ui.barCol}>
      <Text style={[ui.barValue, value === 0 && { opacity: 0 }]}>{value}</Text>
      <View style={[ui.barTrack, { height }]}>
        <Animated.View style={[ui.bar, { backgroundColor: active ? colors.accent : "rgba(251,191,36,0.45)" }, a]} />
      </View>
      <Text style={[ui.barLabel, active && { color: colors.text }]}>{label}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, textTransform: "capitalize" },
  iconTile: { alignItems: "center", justifyContent: "center" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  btnText: { fontSize: 15, fontWeight: "700" },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  sectionAction: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 16 },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 },
  skeleton: { backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 12 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  barCol: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { width: "100%", justifyContent: "flex-end", borderRadius: 8, backgroundColor: "rgba(255,255,255,0.03)" },
  bar: { width: "100%", borderRadius: 8 },
  barValue: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  barLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: "600" },
});
