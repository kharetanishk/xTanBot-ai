import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Animated,
  Easing,
  type LayoutChangeEvent,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../src/stores/auth.store";
import { hrefAbout, hrefDashboard } from "../src/navigation/href";

const GITHUB_URL = "https://github.com/kharetanishk/xTanBot-ai";

const LANDING_BOUNCE_SCALE = 1.05;

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isCompact = width < 380;
  const bounce = useRef(new Animated.Value(1)).current;

  const estHeader = 56 + insets.top;
  const estFooter = 108 + insets.bottom;
  const [heroSlot, setHeroSlot] = useState({
    w: width,
    h: Math.max(160, height - estHeader - estFooter),
  });
  const onHeroSlotLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setHeroSlot({ w, h: Math.max(h, 1) });
  };

  /** Horizontal inset from hero slot (use slot width so it matches layout, not window) */
  const padX = Math.max(14, Math.min(22, heroSlot.w * 0.055));
  const availW = Math.max(heroSlot.w - padX * 1, 1);
  const availH = Math.max(heroSlot.h - 16, 1);

  /** Fixed reservation for title + CTA so they never overlap the image (mobile-first) */
  const bottomBlockMin = isCompact ? 128 : 138;
  const imageRegionH = Math.max(110, availH - bottomBlockMin);

  /** Extra cell so scale transform does not paint over title or get clipped */
  const bouncePad = 1.12;

  const heroImageSize = Math.max(
    96,
    Math.min(
      availW * 0.9,
      imageRegionH / bouncePad,
      width < 400 ? 300 : 340,
    ),
  );
  const bounceCell = heroImageSize * bouncePad;

  const titleSize = Math.min(40, Math.max(20, availW * 0.085));
  const googleBtnMaxW = Math.min(340, availW);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: LANDING_BOUNCE_SCALE,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [bounce]);

  if (isLoading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator color="#FBBF24" size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href={hrefDashboard()} />;
  }

  return (
    <View style={styles.root} accessibilityLabel="xTanBot landing">
      <SafeAreaView style={styles.navSafe} edges={["top"]}>
        <View style={[styles.navBar, isCompact && styles.navBarCompact]}>
          <View style={[styles.navLeft, isCompact && styles.navLeftCompact]}>
            <Pressable
              onPress={() => router.push("/(auth)/login")}
              style={({ pressed }) => [
                styles.navBtnGhost,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Log in"
            >
              <Text style={styles.navBtnGhostText}>Login</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(auth)/register")}
              style={({ pressed }) => [
                styles.navBtnSolid,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Register"
            >
              <Text style={styles.navBtnSolidText}>Register</Text>
            </Pressable>
          </View>
          <View style={styles.navBrandCol}>
            <Text style={[styles.brand, isCompact && styles.brandCompact]}>
              xtanbot.ai
            </Text>
            <Pressable
              onPress={() => router.push(hrefAbout())}
              style={({ pressed }) => [
                styles.navAboutHit,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="About"
            >
              <Text style={styles.navAbout}>About</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Image (flex) + copy/CTA (fixed stack) — no vertical overlap */}
      <View style={styles.heroSlot} onLayout={onHeroSlotLayout}>
        <View style={[styles.heroColumn, { paddingHorizontal: padX }]}>
          <View style={styles.heroImageRegion}>
            <View
              style={[
                styles.bounceCell,
                { width: bounceCell, height: bounceCell },
              ]}
            >
              <Animated.View
                style={[
                  styles.heroImageFrame,
                  {
                    width: heroImageSize,
                    height: heroImageSize,
                    transform: [{ scale: bounce }],
                  },
                ]}
              >
                <Image
                  source={require("../assets/images/xt.png")}
                  style={styles.heroImage}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </Animated.View>
            </View>
          </View>

          <View style={styles.heroCopyBlock}>
            <Text
              style={[
                styles.heroTitle,
                { fontSize: titleSize, lineHeight: titleSize * 1.2 },
              ]}
              accessibilityRole="header"
            >
              xTanBot-ai
            </Text>

            <Pressable
              onPress={() => router.push("/(auth)/login")}
              style={({ pressed }) => [
                styles.googleBtn,
                styles.googleBtnShadow,
                {
                  width: googleBtnMaxW,
                  maxWidth: "100%" as const,
                  alignSelf: "center",
                },
                isCompact && styles.googleBtnCompact,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              <Ionicons
                name="logo-google"
                size={isCompact ? 19 : 21}
                color="#1f1f1f"
              />
              <Text
                style={[
                  styles.googleBtnText,
                  isCompact && styles.googleBtnTextCompact,
                ]}
                numberOfLines={1}
              >
                Continue with Google
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <SafeAreaView style={styles.footerSafe} edges={["bottom"]}>
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Text style={styles.footerCredit}>Developed by Tanishk Khare</Text>
          <Pressable
            onPress={() => void Linking.openURL(GITHUB_URL)}
            style={({ pressed }) => [
              styles.contributeRow,
              pressed && styles.pressed,
            ]}
            accessibilityRole="link"
            accessibilityLabel="Contribute on GitHub"
          >
            <Ionicons name="logo-github" size={18} color="#FBBF24" />
            <Text style={styles.contributeText}>Contribute on GitHub</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050508",
    overflow: "visible",
  },
  loadingRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
  },
  heroSlot: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  heroColumn: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    flexDirection: "column",
  },
  heroImageRegion: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    alignItems: "center",
    /** Bottom-align so the logo sits just above the title (center caused a large empty band on phones). */
    justifyContent: "flex-end",
    paddingBottom: 1,
  },
  bounceCell: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  heroImageFrame: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroCopyBlock: {
    width: "100%",
    flexShrink: 0,
    flexGrow: 0,
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 40,
    gap: 12,
  },
  heroTitle: {
    color: "#fafafa",
    fontWeight: "900",
    color: "#FBBF24",
    letterSpacing: 1.5,
    textAlign: "center",
    width: "100%",
    paddingHorizontal: 4,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    ...Platform.select({
      web: { cursor: "pointer" as const },
      default: {},
    }),
  },
  googleBtnShadow: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }),
  googleBtnCompact: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 8,
  },
  googleBtnText: {
    color: "#1f1f1f",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.15,
    flexShrink: 1,
  },
  googleBtnTextCompact: {
    fontSize: 14,
  },
  navSafe: {
    width: "100%",
    backgroundColor: "transparent",
    zIndex: 10,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
  },
  navBarCompact: {
    paddingHorizontal: 12,
  },
  navLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navLeftCompact: {
    gap: 8,
  },
  navBtnGhost: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(251,191,36,0.85)",
    backgroundColor: "rgba(0,0,0,0.35)",
    ...Platform.select({
      web: { cursor: "pointer" as const },
      default: {},
    }),
  },
  navBtnGhostText: {
    color: "#FBBF24",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  navBtnSolid: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#FBBF24",
    borderWidth: 2,
    borderColor: "#000",
    ...Platform.select({
      web: { cursor: "pointer" as const },
      default: {},
    }),
  },
  navBtnSolidText: {
    color: "#000000",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  navBrandCol: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    maxWidth: "46%",
  },
  brand: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 17,
    letterSpacing: 0.8,
    textAlign: "right",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  brandCompact: {
    fontSize: 15,
  },
  navAboutHit: {
    marginTop: 2,
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginRight: -2,
    ...Platform.select({
      web: { cursor: "pointer" as const },
      default: {},
    }),
  },
  navAbout: {
    color: "#FBBF24",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.35,
    textAlign: "right",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(251,191,36,0.5)",
  },
  footerSafe: {
    width: "100%",
    backgroundColor: "transparent",
  },
  footer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderTopWidth: 1,
    borderTopColor: "rgba(251,191,36,0.25)",
  },
  footerCredit: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  contributeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    backgroundColor: "rgba(251,191,36,0.08)",
    marginBottom: 4,
    ...Platform.select({
      web: { cursor: "pointer" as const },
      default: {},
    }),
  },
  contributeText: {
    color: "#FBBF24",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  pressed: {
    opacity: 0.82,
  },
});
