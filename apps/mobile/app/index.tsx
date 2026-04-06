import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../src/stores/auth.store";
import { hrefAbout, hrefDashboard } from "../src/navigation/href";

const GITHUB_URL = "https://github.com/kharetanishk/xTanBot-ai";

// ─── TWEAK THIS to nudge video up (positive = moves up) ───
const VIDEO_OFFSET = 40;
// ──────────────────────────────────────────────────────────

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const videoRef = useRef<Video | null>(null);
  const isCompact = width < 380;

  useEffect(() => {
    return () => {
      void videoRef.current?.unloadAsync();
    };
  }, []);

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
      {/* ── VIDEO shifted up — no wrappers causing black bars ── */}
      <Video
        ref={videoRef}
        source={require("../assets/landingpage.mp4")}
        style={[
          StyleSheet.absoluteFillObject,
          { top: -VIDEO_OFFSET, bottom: VIDEO_OFFSET },
        ]}
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        shouldPlay
        isMuted
      />

      {/* ── SINGLE subtle dim — no black bars ── */}
      <View pointerEvents="none" style={styles.videoDim} />

      {/* ── NAV ── */}
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
          <Text style={[styles.brand, isCompact && styles.brandCompact]}>
            xtanbot.ai
          </Text>
        </View>
      </SafeAreaView>

      {/* ── INFO FAB ── */}
      <Pressable
        onPress={() => router.push(hrefAbout())}
        style={({ pressed }) => [
          styles.infoFab,
          {
            bottom: 100 + insets.bottom,
            right: Math.max(16, insets.right),
          },
          pressed && styles.infoFabPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="About xTanBot"
      >
        <Image
          source={require("../assets/info-icon.png")}
          style={styles.infoIcon}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Pressable>

      {/* ── FOOTER ── */}
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
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  loadingRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
  },
  videoDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  navSafe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "transparent",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 52,
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
  brand: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 17,
    letterSpacing: 0.8,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  brandCompact: {
    fontSize: 15,
    maxWidth: "42%",
    textAlign: "right",
  },
  infoFab: {
    position: "absolute",
    zIndex: 20,
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: "rgba(10,10,10,0.55)",
    borderWidth: 2,
    borderColor: "rgba(251,191,36,0.6)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      web: { cursor: "pointer" as const },
      default: {},
    }),
  },
  infoFabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  infoIcon: {
    width: 44,
    height: 44,
  },
  footerSafe: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
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
