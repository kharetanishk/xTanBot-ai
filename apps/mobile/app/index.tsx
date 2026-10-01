import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import { Caveat_700Bold } from "@expo-google-fonts/caveat";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useAuthStore } from "../src/stores/auth.store";
import { hrefAbout, hrefDashboard } from "../src/navigation/href";
import XtanCharacter from "../src/components/character/XtanCharacter";
import { narrator, useNarrator } from "../src/components/character/narrator";
import { ScrollProvider, useScroll } from "../src/components/landing/scroll";
import {
  CallAnyone,
  Faq,
  FinalCta,
  FONT,
  Hero,
  HowItWorks,
  Marquee,
  NarratorDock,
  NAV_H,
  Stats,
  StoryChapters,
} from "../src/components/landing/sections";
import { colors, radius } from "../src/theme";

const GITHUB_URL = "https://github.com/kharetanishk/xTanBot-ai";

export default function Index() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Caveat_700Bold,
  });

  if (isLoading || !fontsLoaded) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }
  if (isAuthenticated) return <Redirect href={hrefDashboard()} />;

  return (
    <Landing
      onStart={() => router.push("/(auth)/register")}
      onLogin={() => router.push("/(auth)/login")}
      onAbout={() => router.push(hrefAbout())}
    />
  );
}

/** Tells the narrator which section is in the middle of the screen. */
function FocusTracker() {
  const { scrollY, vh, offsets } = useScroll();
  useAnimatedReaction(
    () => {
      const center = scrollY.value + vh * 0.45;
      const o = offsets.value;
      let i = 0;
      for (let k = 0; k < o.length; k++)
        if (!Number.isNaN(o[k]!) && o[k]! <= center) i = k;
      return i;
    },
    (i, prev) => {
      if (i !== prev) runOnJS(narrator.setSection)(i);
    },
    [vh],
  );
  return null;
}

function Landing({
  onStart,
  onLogin,
  onAbout,
}: {
  onStart: () => void;
  onLogin: () => void;
  onAbout: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const tiny = width < 380; // 320–379px phones: tighter nav, drop the duplicate "Log in" (hero has one)
  const soundOn = useNarrator((st) => st.soundOn);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const toTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });
  const scrollY = useSharedValue(0);
  const contentH = useSharedValue(1);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    contentH.value = e.contentSize.height;
  });

  // Open and transparent at the top; once you scroll it lifts into a floating glass capsule.
  const navBg = useAnimatedStyle(() => {
    const t = interpolate(scrollY.value, [0, 90], [0, 1], Extrapolation.CLAMP);
    return {
      marginTop: t * 10,
      marginHorizontal: t * (wide ? 24 : 10),
      paddingHorizontal: (tiny ? 12 : 20) - t * (tiny ? 4 : 6),
      borderRadius: t * 999,
      backgroundColor: interpolateColor(t, [0, 1], ["rgba(12,12,16,0)", "rgba(12,12,16,0.78)"]),
      borderColor: interpolateColor(t, [0, 1], ["rgba(255,255,255,0)", "rgba(255,255,255,0.09)"]),
      shadowOpacity: t * 0.45,
    };
  });
  const progress = useAnimatedStyle(() => ({
    width: `${interpolate(scrollY.value, [0, Math.max(1, contentH.value - height)], [0, 100], Extrapolation.CLAMP)}%`,
  }));

  return (
    <View style={s.root}>
      <ScrollProvider scrollY={scrollY}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <Hero onStart={onStart} onLogin={onLogin} />
          <Marquee />
          <StoryChapters />
          <HowItWorks />
          <CallAnyone />
          <Stats />
          <Faq />
          <FinalCta onStart={onStart} onLogin={onLogin} />
          <View style={s.footer}>
            <Text style={s.credit}>Developed with 💛 by Tanishk Khare</Text>
            <Pressable
              onPress={() => void Linking.openURL(GITHUB_URL)}
              style={s.github}
              accessibilityRole="link"
            >
              <Ionicons name="logo-github" size={18} color={colors.accent} />
              <Text style={s.githubText}>Contribute on GitHub</Text>
            </Pressable>
          </View>
        </Animated.ScrollView>
        <FocusTracker />
      </ScrollProvider>

      <NarratorDock />

      {/* Fixed nav + scroll progress */}
      <View
        pointerEvents="box-none"
        style={[s.nav, { paddingTop: insets.top, height: NAV_H + insets.top }]}
      >
        <Animated.View style={[s.navInner, navBg]}>
          <Pressable
            onPress={toTop}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              s.brandRow,
              (hovered || pressed) && { opacity: 0.85 },
            ]}
            accessibilityRole="link"
            accessibilityLabel="xtanbot.ai — back to top"
          >
            <View style={s.brandFace}>
              <XtanCharacter size={34} variant="face" still />
            </View>
            <Text style={[s.brand, tiny && { fontSize: 17 }]}>
              xtanbot<Text style={s.brandDot}>.ai</Text>
            </Text>
          </Pressable>

          <View style={s.navRight}>
            {wide ? (
              <>
                <NavLink label="About" onPress={onAbout} />
                <NavLink label="GitHub" icon="logo-github" onPress={() => void Linking.openURL(GITHUB_URL)} />
                <View style={s.navSep} />
              </>
            ) : null}
            <Pressable
              onPress={() => (soundOn ? narrator.disable() : void narrator.enable())}
              style={({ hovered }: { hovered?: boolean }) => [s.soundBtn, soundOn && s.soundOn, hovered && !soundOn && s.hover]}
              accessibilityLabel={soundOn ? "Mute xTan" : "Hear xTan speak"}
            >
              <Ionicons
                name={soundOn ? "volume-high" : "volume-mute"}
                size={16}
                color={soundOn ? colors.accent : colors.textMuted}
              />
              {wide ? (
                <Text style={[s.soundText, soundOn && { color: colors.accent }]}>
                  {soundOn ? "Voice on" : "Hear her"}
                </Text>
              ) : null}
            </Pressable>
            {tiny ? null : <NavLink label="Log in" onPress={onLogin} />}
            <Pressable
              onPress={onStart}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                s.navCta,
                tiny && { paddingHorizontal: 12 },
                hovered && s.navCtaHover,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={s.navCtaText}>{wide ? "Get started" : "Start"}</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.onAccent} />
            </Pressable>
          </View>

          <Animated.View style={[s.progress, progress]} />
        </Animated.View>
      </View>
    </View>
  );
}

function NavLink({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        s.navLinkBtn,
        (hovered || pressed) && s.hover,
      ]}
    >
      {({ hovered }: { hovered?: boolean }) => (
        <>
          {icon ? <Ionicons name={icon} size={16} color={hovered ? colors.text : colors.textMuted} /> : null}
          <Text style={[s.navLink, hovered && { color: colors.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050508" },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  nav: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  navInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
    maxWidth: 1080,
    alignSelf: "center",
    shadowColor: "#000",
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    ...(Platform.OS === "web" ? ({ backdropFilter: "blur(14px) saturate(140%)" } as object) : {}),
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, ...(Platform.OS === "web" ? ({ cursor: "pointer" } as object) : {}) },
  brandDot: { color: colors.text },
  brandFace: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: colors.accent,
    fontSize: 20,
    fontFamily: FONT.display,
    letterSpacing: -0.3,
  },
  navRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  navLinkBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  navLink: { color: colors.textMuted, fontSize: 15, fontFamily: FONT.bold },
  navSep: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 6 },
  hover: { backgroundColor: "rgba(255,255,255,0.06)" },
  navCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  navCtaHover: { shadowOpacity: 0.6, transform: [{ translateY: -1 }] },
  navCtaText: { color: colors.onAccent, fontSize: 14, fontFamily: FONT.bold },
  soundBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  soundOn: {
    borderColor: "rgba(251,191,36,0.5)",
    backgroundColor: colors.accentSoft,
  },
  soundText: { color: colors.textMuted, fontSize: 13, fontFamily: FONT.bold },
  progress: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: 2,
    backgroundColor: colors.accent,
  },

  footer: { alignItems: "center", gap: 8, paddingVertical: 48 },
  credit: { color: colors.textSubtle, fontSize: 14, fontFamily: FONT.semi },
  github: { flexDirection: "row", alignItems: "center", gap: 8 },
  githubText: { color: colors.accent, fontSize: 14, fontFamily: FONT.bold },
});
