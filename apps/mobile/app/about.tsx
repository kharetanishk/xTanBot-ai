import { View, Text, ScrollView, Pressable, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Appear, GradientIcon, type Gradient, type IconName } from "../src/components/ui";
import XtanCharacter from "../src/components/character/XtanCharacter";
import { colors, radius } from "../src/theme";

const GITHUB_URL = "https://github.com/kharetanishk/xTanBot-ai";
const DEV_PHONE_DISPLAY = "+91 62604 40241";
const DEV_PHONE_TEL = "+916260440241";

const FEATURES: { title: string; body: string; icon: IconName; gradient: Gradient }[] = [
  {
    title: "Voice calls",
    body: "Natural AI voice for outbound and inbound calls via Twilio, with real-time Deepgram speech and ElevenLabs TTS.",
    icon: "call",
    gradient: "emerald",
  },
  {
    title: "Live voice chat",
    body: "Talk to xTan in the app with sub-second replies, and interrupt any time — she stops and listens.",
    icon: "mic",
    gradient: "rose",
  },
  {
    title: "Chat assistant",
    body: "Streaming text chat with web search, page reading, WhatsApp drafts with confirmation and location context.",
    icon: "chatbubbles",
    gradient: "amber",
  },
  {
    title: "Meetings",
    body: "Schedule meetings in your timezone; xTanBot calls attendees with your agenda when it's time.",
    icon: "calendar",
    gradient: "indigo",
  },
  {
    title: "Contacts",
    body: "Store and search contacts, then use them for calls, WhatsApp messages and meeting invites.",
    icon: "people",
    gradient: "sky",
  },
  {
    title: "Alarms",
    body: "Set an alarm and xTanBot rings your phone at exactly that minute.",
    icon: "alarm",
    gradient: "violet",
  },
];

const STACK = ["Expo", "React Native", "Fastify", "BullMQ", "Postgres", "Redis", "LiveKit", "Twilio", "Deepgram", "ElevenLabs", "OpenRouter"];

export default function AboutScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cols = width >= 1000 ? 3 : width >= 640 ? 2 : 1;
  const wide = width >= 900;

  return (
    <Screen>
      <View style={s.topBar}>
        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => [s.backBtn, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={16} color={colors.accent} />
          <Text style={s.backText}>Home</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Appear index={0}>
          <View style={[s.hero, wide && s.heroWide]}>
            <View style={s.heroGlow} />
            <XtanCharacter size={wide ? 150 : 116} />
            <View style={[s.heroText, wide && { alignItems: "flex-start" }]}>
              <Text style={s.kicker}>ABOUT</Text>
              <Text style={[s.heroTitle, wide && { textAlign: "left", fontSize: 44 }]}>
                xTanBot<Text style={{ color: colors.accent }}>.ai</Text>
              </Text>
              <Text style={[s.heroSub, wide && { textAlign: "left" }]}>
                Your AI voice and chat assistant — it schedules, calls, reminds and answers, so the
                small tasks of the day take care of themselves.
              </Text>
            </View>
          </View>
        </Appear>

        {/* Features */}
        <Appear index={1}>
          <Text style={s.sectionTitle}>What it does</Text>
        </Appear>
        <View style={s.grid}>
          {FEATURES.map((f, i) => (
            <Appear key={f.title} index={i + 2} style={{ width: `${100 / cols}%`, padding: 6 }}>
              <View style={s.feature}>
                <GradientIcon icon={f.icon} gradient={f.gradient} size={44} />
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureBody}>{f.body}</Text>
              </View>
            </Appear>
          ))}
        </View>

        {/* Stack */}
        <Appear index={8}>
          <Text style={s.sectionTitle}>Built with</Text>
          <View style={s.stack}>
            {STACK.map((t) => (
              <View key={t} style={s.pill}>
                <Text style={s.pillText}>{t}</Text>
              </View>
            ))}
          </View>
        </Appear>

        {/* Links */}
        <Appear index={9}>
          <View style={[s.linkRow, wide && { flexDirection: "row" }]}>
            <Pressable
              onPress={() => void Linking.openURL(GITHUB_URL)}
              style={({ pressed }) => [s.linkCard, s.linkCardAccent, wide && { flex: 1 }, pressed && s.pressed]}
              accessibilityRole="link"
            >
              <View style={s.linkIcon}>
                <Ionicons name="logo-github" size={24} color={colors.onAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.linkTitle}>Open source on GitHub</Text>
                <Text style={s.linkSub}>kharetanishk/xTanBot-ai · contributions welcome</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.accent} />
            </Pressable>

            <Pressable
              onPress={() => void Linking.openURL(`tel:${DEV_PHONE_TEL}`)}
              style={({ pressed }) => [s.linkCard, wide && { flex: 1 }, pressed && s.pressed]}
              accessibilityRole="link"
              accessibilityLabel={`Call ${DEV_PHONE_DISPLAY}`}
            >
              <View style={[s.linkIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={s.initials}>TK</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.linkKicker}>DEVELOPER</Text>
                <Text style={s.linkTitle}>Tanishk Khare</Text>
                <Text style={s.linkSub}>{DEV_PHONE_DISPLAY}</Text>
              </View>
              <Ionicons name="call-outline" size={20} color={colors.accent} />
            </Pressable>
          </View>
        </Appear>

        <Text style={s.footer}>Made with ☕ and a lot of phone calls.</Text>
      </ScrollView>
    </Screen>
  );
}

const web = <T extends object>(style: T) => (Platform.OS === "web" ? style : {});

const s = StyleSheet.create({
  topBar: { paddingHorizontal: 20, paddingVertical: 10, width: "100%", maxWidth: 1120, alignSelf: "center" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6, ...web({ cursor: "pointer" as const }) },
  backText: { color: colors.accent, fontWeight: "700", fontSize: 14 },

  scroll: { paddingHorizontal: 14, paddingBottom: 48, width: "100%", maxWidth: 1120, alignSelf: "center" },

  hero: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginHorizontal: 6,
    marginBottom: 28,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  heroWide: { flexDirection: "row", gap: 36, paddingVertical: 40, paddingHorizontal: 48 },
  heroGlow: {
    position: "absolute", width: 360, height: 360, borderRadius: 180, top: -180, right: -80,
    backgroundColor: "rgba(251,191,36,0.10)",
  },
  heroText: { flex: 1, alignItems: "center" },
  kicker: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 2.5 },
  heroTitle: { color: colors.text, fontSize: 36, fontWeight: "900", letterSpacing: -1, marginTop: 6, textAlign: "center" },
  heroSub: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 560, textAlign: "center" },

  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginHorizontal: 6, marginBottom: 10, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 24 },
  feature: {
    flex: 1,
    gap: 10,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 4 },
  featureBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },

  stack: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginHorizontal: 6, marginBottom: 28 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong,
  },
  pillText: { color: colors.text, fontSize: 13, fontWeight: "600" },

  linkRow: { gap: 12, marginHorizontal: 6 },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...web({ cursor: "pointer" as const }),
  },
  linkCardAccent: { borderColor: "rgba(251,191,36,0.45)", backgroundColor: "rgba(251,191,36,0.06)" },
  linkIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  initials: { color: colors.accent, fontWeight: "900", fontSize: 16 },
  linkKicker: { color: colors.textSubtle, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 },
  linkTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  linkSub: { color: colors.textMuted, fontSize: 13, marginTop: 3 },

  footer: { color: colors.textSubtle, fontSize: 13, textAlign: "center", marginTop: 32 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
