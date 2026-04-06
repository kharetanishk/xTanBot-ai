import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";

const GITHUB_URL = "https://github.com/kharetanishk/xTanBot-ai";
const DEV_PHONE_DISPLAY = "+91 62604 40241";
const DEV_PHONE_TEL = "+916260440241";

const FEATURES = [
  {
    title: "Voice calls",
    body: "Natural AI voice for outbound and inbound calls via Twilio, with real-time speech (Deepgram) and ElevenLabs TTS.",
  },
  {
    title: "Meetings",
    body: "Schedule and manage meetings with attendees, times in your timezone, and calendar-aware flows.",
  },
  {
    title: "Contacts",
    body: "Store and search contacts; use them when placing calls, sending WhatsApp, or scheduling.",
  },
  {
    title: "Alarms",
    body: "Set reminder alarms that can reach you by phone when it is time.",
  },
  {
    title: "Chat assistant",
    body: "Text chat with Claude: web search, page fetch, WhatsApp drafts with confirmation, location context, and more.",
  },
  {
    title: "Dashboard",
    body: "One place to see recent calls, upcoming meetings, and quick actions after you sign in.",
  },
] as const;

export default function AboutScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const maxW = Math.min(560, width - 32);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <Text style={styles.backText}>← Home</Text>
        </Pressable>
        <Text style={styles.topTitle}>About</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.block, { maxWidth: maxW, alignSelf: "center", width: "100%" }]}>
          <Text style={styles.hero}>xTanBot.ai</Text>
          <Text style={styles.sub}>
            AI voice and chat assistant — scheduling, calls, contacts, and daily tasks powered by
            Claude and modern telephony.
          </Text>
        </View>

        <View style={[styles.section, { maxWidth: maxW, alignSelf: "center", width: "100%" }]}>
          <Text style={styles.sectionTitle}>FEATURES</Text>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureBody}>{f.body}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, { maxWidth: maxW, alignSelf: "center", width: "100%" }]}>
          <Text style={styles.sectionTitle}>OPEN SOURCE</Text>
          <Pressable
            onPress={() => void Linking.openURL(GITHUB_URL)}
            style={({ pressed }) => [styles.linkCard, pressed && styles.pressed]}
            accessibilityRole="link"
          >
            <Ionicons name="logo-github" size={28} color="#FBBF24" />
            <View style={styles.linkTextCol}>
              <Text style={styles.linkTitle}>Contribute on GitHub</Text>
              <Text style={styles.linkSub}>kharetanishk/xTanBot-ai</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#737373" />
          </Pressable>
        </View>

        <View style={[styles.section, styles.lastSection, { maxWidth: maxW, alignSelf: "center", width: "100%" }]}>
          <Text style={styles.sectionTitle}>DEVELOPER</Text>
          <View style={styles.devCard}>
            <Text style={styles.devName}>Tanishk Khare</Text>
            <Pressable
              onPress={() => void Linking.openURL(`tel:${DEV_PHONE_TEL}`)}
              style={({ pressed }) => [styles.phoneRow, pressed && styles.pressed]}
              accessibilityRole="link"
              accessibilityLabel={`Call ${DEV_PHONE_DISPLAY}`}
            >
              <Ionicons name="call-outline" size={20} color="#FBBF24" />
              <Text style={styles.phoneText}>{DEV_PHONE_DISPLAY}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(251,191,36,0.35)",
    backgroundColor: "#111111",
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 88,
    ...Platform.select({
      web: { cursor: "pointer" as const },
      default: {},
    }),
  },
  backText: {
    color: "#FBBF24",
    fontWeight: "900",
    fontSize: 14,
  },
  topTitle: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 1,
  },
  topSpacer: {
    minWidth: 88,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  block: {
    marginBottom: 28,
  },
  hero: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FBBF24",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  sub: {
    fontSize: 16,
    lineHeight: 24,
    color: "#a3a3a3",
    fontWeight: "500",
  },
  section: {
    marginBottom: 28,
  },
  lastSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#737373",
    letterSpacing: 2,
    marginBottom: 14,
  },
  featureCard: {
    backgroundColor: "#141414",
    borderWidth: 2,
    borderColor: "#262626",
    padding: 16,
    marginBottom: 12,
    borderRadius: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 8,
  },
  featureBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#a3a3a3",
    fontWeight: "500",
  },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#141414",
    borderWidth: 2,
    borderColor: "#FBBF24",
    padding: 16,
    borderRadius: 4,
    ...Platform.select({
      web: { cursor: "pointer" as const },
      default: {},
    }),
  },
  linkTextCol: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
  },
  linkSub: {
    fontSize: 13,
    color: "#737373",
    marginTop: 4,
    fontWeight: "600",
  },
  devCard: {
    backgroundColor: "#141414",
    borderWidth: 2,
    borderColor: "#404040",
    padding: 20,
    borderRadius: 4,
  },
  devName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 16,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
    ...Platform.select({
      web: { cursor: "pointer" as const },
      default: {},
    }),
  },
  phoneText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FBBF24",
  },
  pressed: {
    opacity: 0.82,
  },
});
