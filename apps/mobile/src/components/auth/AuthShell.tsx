import { useEffect, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import XtanCharacter from "../character/XtanCharacter";
import { SpeechBubble, useTypewriter } from "../character/SpeechBubble";
import type { IconName } from "../ui";
import { colors, radius } from "../../theme";

const DISPLAY = "BricolageGrotesque_800ExtraBold";
const BOLD = "BricolageGrotesque_700Bold";

/**
 * Login/register frame with xTan reacting to the form: she says `line` (typed out, lips
 * moving), waves when you arrive and dances on `celebrate`.
 *  - wide (≥900px): split screen — amber stage with xTan + floating feature cards | form
 *  - phones: xTan peeks over the top edge of the form card, bubble beside her
 */
export default function AuthShell({
  title,
  subtitle,
  line,
  celebrate,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  line: string;
  celebrate?: boolean;
  children: ReactNode;
  footer: ReactNode;
}) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const tiny = width < 380;

  const { shown, done } = useTypewriter(line, 28, 120);
  const [waving, setWaving] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setWaving(false), 2600);
    return () => clearTimeout(t);
  }, []);

  const bubble = (style?: object, tail: "left" | "bottom" | "none" = "bottom", dark = false) => (
    <SpeechBubble text={shown} fullText={line} typing={!done} tail={tail} dark={dark} small={!wide} style={style} />
  );

  const character = (size: number, variant?: "bust") => (
    <XtanCharacter size={size} variant={variant} talking={!done} wave={waving && !celebrate} dance={celebrate} />
  );

  const brand = (
    <Pressable onPress={() => router.replace("/")} style={s.brandRow} accessibilityRole="link" accessibilityLabel="Back to home">
      <Ionicons name="arrow-back" size={16} color={wide ? colors.onAccent : colors.accent} />
      <Text style={[s.brand, wide && { color: colors.onAccent }]}>
        xtanbot<Text style={{ color: wide ? "rgba(10,10,10,0.55)" : colors.text }}>.ai</Text>
      </Text>
    </Pressable>
  );

  const form = (
    <Animated.View entering={FadeInDown.duration(450).delay(120)} style={[s.card, wide && s.cardWide]}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
      <View style={{ marginTop: 22 }}>{children}</View>
    </Animated.View>
  );

  if (wide) {
    const charSize = Math.min(320, height * 0.42);
    return (
      <View style={s.root}>
        <View style={s.stage}>
          <View style={[s.glow, { top: -160, right: -120 }]} />
          <View style={[s.glow, { bottom: -200, left: -140, backgroundColor: "rgba(255,255,255,0.18)" }]} />
          {brand}
          <View style={s.stageCenter}>
            {bubble({ maxWidth: 340, marginBottom: 14 }, "bottom", true)}
            <View>
              <View style={[s.spot, { width: charSize, height: charSize, borderRadius: charSize / 2 }]} />
              {character(charSize)}
              <FloatChip icon="call" label="Calling Dr. Rao…" sub="booked ✓ Fri 4 PM" tone={colors.success} style={{ top: "12%", left: -150 }} delay={0} />
              <FloatChip icon="alarm" label="7:00 AM" sub="wake-up call" tone="#b45309" style={{ top: "44%", right: -140 }} delay={500} />
              <FloatChip icon="calendar" label="Design review" sub="5:00 PM · 3 people" tone={colors.info} style={{ bottom: "6%", left: -120 }} delay={900} />
            </View>
          </View>
          <Text style={s.tagline}>The assistant who actually picks up the phone.</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.formCol} keyboardShouldPersistTaps="handled">
          {form}
          <View style={s.footer}>{footer}</View>
        </ScrollView>
      </View>
    );
  }

  const bust = tiny ? 124 : 150;
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.glow, { top: -170, right: -130, opacity: 0.6 }]} />
      <ScrollView contentContainerStyle={s.mobile} keyboardShouldPersistTaps="handled">
        {brand}

        {/* xTan peeks over the card: the card is drawn after her, so it covers her lower half. */}
        <View style={s.peekRow}>
          <View style={{ flex: 1, paddingBottom: 26 }}>{bubble(undefined, "left")}</View>
          {/* Crop at the shoulders; the card's top edge sits just under her chin. */}
          <View style={[s.peek, { width: bust, height: bust * 0.9 }]}>
            {character(bust, "bust")}
          </View>
        </View>
        <View style={s.peekCard}>
          {form}
          {/* Her hands gripping the card's top edge. */}
          <View pointerEvents="none" style={[s.hands, { right: 6 + bust * 0.2, width: bust * 0.6 }]}>
            <View style={s.hand} />
            <View style={s.hand} />
          </View>
        </View>

        <View style={s.footer}>{footer}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Small glassy feature card that bobs gently around xTan on the desktop stage. */
function FloatChip({
  icon,
  label,
  sub,
  tone,
  style,
  delay,
}: {
  icon: IconName;
  label: string;
  sub: string;
  tone: string;
  style: object;
  delay: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [delay, t]);
  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * t.value }] }));
  return (
    <Animated.View style={[s.chip, style, bob]} pointerEvents="none">
      <View style={[s.chipIcon, { backgroundColor: tone }]}>
        <Ionicons name={icon} size={15} color="#fff" />
      </View>
      <View>
        <Text style={s.chipLabel}>{label}</Text>
        <Text style={s.chipSub}>{sub}</Text>
      </View>
    </Animated.View>
  );
}

/** Field focus → what xTan says. Shared by login and register. */
export type AuthFocus = "name" | "email" | "password" | "confirm" | null;

const web = <T extends object>(st: T) => (Platform.OS === "web" ? st : {});

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.bg, overflow: "hidden" },

  // desktop stage
  stage: {
    flex: 1.05,
    margin: 16,
    borderRadius: 32,
    backgroundColor: colors.accent,
    padding: 32,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  glow: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "rgba(251,191,36,0.22)",
  },
  stageCenter: { alignItems: "center" },
  spot: { position: "absolute", alignSelf: "center", bottom: 0, backgroundColor: "rgba(0,0,0,0.08)" },
  tagline: { fontFamily: DISPLAY, fontSize: 26, lineHeight: 30, color: colors.onAccent, letterSpacing: -0.6, maxWidth: 420 },
  chip: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(10,10,10,0.88)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  chipIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  chipLabel: { color: colors.text, fontFamily: BOLD, fontSize: 13 },
  chipSub: { color: colors.textMuted, fontSize: 11, marginTop: 1 },

  // form
  formCol: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 40, paddingVertical: 40 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", ...web({ cursor: "pointer" as const }) },
  brand: { fontFamily: DISPLAY, fontSize: 20, color: colors.accent, letterSpacing: -0.3 },
  card: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
  cardWide: { backgroundColor: "transparent", borderWidth: 0, shadowOpacity: 0, padding: 0 },
  title: { fontFamily: DISPLAY, fontSize: 30, color: colors.text, letterSpacing: -0.8 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 21, marginTop: 6 },
  footer: { alignItems: "center", gap: 6, marginTop: 22, width: "100%", maxWidth: 440, alignSelf: "center" },

  // phones
  mobile: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, width: "100%", maxWidth: 520, alignSelf: "center" },
  peekRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 18, paddingHorizontal: 4 },
  peek: { overflow: "hidden", justifyContent: "flex-start", marginRight: 6 },
  peekCard: { marginTop: -8 },
  hands: { position: "absolute", top: -9, flexDirection: "row", justifyContent: "space-between", zIndex: 2 },
  hand: {
    width: 26,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#c4703c",
    borderWidth: 2.5,
    borderColor: "#1b1311",
  },
});

export const authStyles = StyleSheet.create({
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 15,
    marginTop: 6,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryText: { color: colors.onAccent, fontFamily: BOLD, fontSize: 16 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.accent, fontFamily: BOLD, fontSize: 15 },
});
