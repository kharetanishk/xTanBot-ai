import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, {
  FadeIn,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, radius } from "../../theme";
import type { IconName } from "./index";
import XtanCharacter from "../character/XtanCharacter";
import { useAuthStore } from "../../stores/auth.store";

type Item = { name: string; label: string; icon: IconName; iconOn: IconName; hint?: string };

/** Always visible in the bar. */
const PRIMARY: Item[] = [
  { name: "index", label: "Home", icon: "home-outline", iconOn: "home" },
  { name: "chat", label: "Chat", icon: "chatbubble-ellipses-outline", iconOn: "chatbubble-ellipses" },
  { name: "calls", label: "Calls", icon: "call-outline", iconOn: "call" },
  { name: "alarms", label: "Alarms", icon: "alarm-outline", iconOn: "alarm" },
];

/** Tucked into the "More" drop-up sheet. */
const MORE: Item[] = [
  { name: "meetings", label: "Meetings", icon: "calendar-outline", iconOn: "calendar", hint: "Schedule & agendas" },
  { name: "contacts", label: "Contacts", icon: "people-outline", iconOn: "people", hint: "People xTanBot calls" },
  { name: "settings", label: "Settings", icon: "settings-outline", iconOn: "settings", hint: "Profile & account" },
];

export default function TabBar(props: BottomTabBarProps & { sidebar?: boolean }) {
  return props.sidebar ? <Sidebar {...props} /> : <BottomBar {...props} />;
}

/** Desktop: full-height left sidebar — every section visible, no "More" sheet needed. */
function Sidebar({ state, navigation }: BottomTabBarProps) {
  const current = state.routes[state.index]?.name ?? "index";
  const user = useAuthStore((st) => st.user);
  const items = [...PRIMARY, ...MORE];
  const initials = (user?.name ?? "?").split(/[\s_]+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <View style={s.side}>
      <View style={s.sideBrand}>
        <View style={s.sideFace}>
          <XtanCharacter size={38} variant="face" still />
        </View>
        <Text style={s.sideBrandText}>xTanBot</Text>
      </View>

      <Pressable onPress={() => router.push("/voice")} style={({ pressed }) => [s.sideTalk, pressed && s.pressed]}>
        <Ionicons name="mic" size={18} color={colors.onAccent} />
        <Text style={s.sideTalkText}>Talk to xTan</Text>
      </Pressable>

      <Text style={s.sideSection}>MENU</Text>
      {items.map((item) => {
        const active = current === item.name;
        return (
          <Pressable
            key={item.name}
            onPress={() => navigation.navigate(item.name as never)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.sideItem, active && s.sideItemOn, (hovered || pressed) && !active && s.sideItemHover]}
          >
            {active ? <View style={s.sideIndicator} /> : null}
            <Ionicons name={active ? item.iconOn : item.icon} size={20} color={active ? colors.accent : colors.textMuted} />
            <Text style={[s.sideItemText, active && s.sideItemTextOn]}>{item.label}</Text>
          </Pressable>
        );
      })}

      <View style={{ flex: 1 }} />
      <Pressable onPress={() => navigation.navigate("settings" as never)} style={({ pressed }) => [s.sideUser, pressed && s.pressed]}>
        <View style={s.sideAvatar}>
          <Text style={s.sideAvatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.sideUserName} numberOfLines={1}>
            {user?.name ?? "Account"}
          </Text>
          <Text style={s.sideUserMail} numberOfLines={1}>
            {user?.email ?? ""}
          </Text>
        </View>
        <Ionicons name="settings-outline" size={18} color={colors.textSubtle} />
      </Pressable>
    </View>
  );
}

function BottomBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = state.routes[state.index]?.name ?? "index";
  const inMore = MORE.some((m) => m.name === current);

  const go = (name: string) => {
    setMoreOpen(false);
    navigation.navigate(name as never);
  };

  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={s.bar}>
        {PRIMARY.map((item) => (
          <TabButton key={item.name} item={item} focused={current === item.name} onPress={() => go(item.name)} />
        ))}
        <TabButton
          item={{ name: "more", label: "More", icon: "grid-outline", iconOn: "grid" }}
          focused={inMore || moreOpen}
          onPress={() => setMoreOpen(true)}
        />
      </View>

      <Modal visible={moreOpen} transparent animationType="none" onRequestClose={() => setMoreOpen(false)}>
        <Animated.View entering={FadeIn.duration(180)} style={s.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMoreOpen(false)} />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(180)}
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        >
          <View style={s.handle} />
          <Text style={s.sheetTitle}>More</Text>

          {/* Voice shortcut — the headline feature gets the hero slot. */}
          <Pressable
            onPress={() => {
              setMoreOpen(false);
              router.push("/voice");
            }}
            style={({ pressed }) => [s.voiceRow, pressed && s.pressed]}
          >
            <View style={s.voiceIcon}>
              <Ionicons name="mic" size={22} color={colors.onAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.voiceTitle}>Talk to xTanBot</Text>
              <Text style={s.voiceHint}>Hands-free voice conversation</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onAccent} />
          </Pressable>

          {MORE.map((item) => {
            const active = current === item.name;
            return (
              <Pressable
                key={item.name}
                onPress={() => go(item.name)}
                style={({ pressed }) => [s.row, active && s.rowActive, pressed && s.pressed]}
              >
                <View style={[s.rowIcon, active && { backgroundColor: colors.accentSoft }]}>
                  <Ionicons
                    name={active ? item.iconOn : item.icon}
                    size={20}
                    color={active ? colors.accent : colors.text}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{item.label}</Text>
                  <Text style={s.rowHint}>{item.hint}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Pressable>
            );
          })}
        </Animated.View>
      </Modal>
    </View>
  );
}

function TabButton({ item, focused, onPress }: { item: Item; focused: boolean; onPress: () => void }) {
  const p = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(focused ? 1 : 0, { duration: 220 });
  }, [focused, p]);

  const pill = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scaleX: 0.6 + p.value * 0.4 }],
  }));
  const icon = useAnimatedStyle(() => ({
    transform: [{ translateY: -p.value }, { scale: 1 + p.value * 0.06 }],
  }));

  return (
    <Pressable onPress={onPress} style={s.tab} accessibilityRole="button" accessibilityState={{ selected: focused }}>
      <View style={s.iconWrap}>
        <Animated.View style={[s.pill, pill]} />
        <Animated.View style={icon}>
          <Ionicons
            name={focused ? item.iconOn : item.icon}
            size={21}
            color={focused ? colors.accent : colors.textSubtle}
          />
        </Animated.View>
      </View>
      <Text style={[s.label, focused && s.labelOn]} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  side: {
    width: 252,
    height: "100%",
    backgroundColor: "#08080c",
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 4,
  },
  sideBrand: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6, marginBottom: 18 },
  sideFace: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  sideBrandText: { color: colors.accent, fontSize: 20, fontFamily: "BricolageGrotesque_800ExtraBold", letterSpacing: -0.4 },
  sideTalk: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 22,
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  sideTalkText: { color: colors.onAccent, fontSize: 15, fontWeight: "800" },
  sideSection: { color: colors.textSubtle, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, paddingHorizontal: 12, marginBottom: 6 },
  sideItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12 },
  sideItemOn: { backgroundColor: colors.accentSoft },
  sideItemHover: { backgroundColor: "rgba(255,255,255,0.04)" },
  sideIndicator: { position: "absolute", left: -16, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: colors.accent },
  sideItemText: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  sideItemTextOn: { color: colors.text, fontWeight: "700" },
  sideUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sideAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  sideAvatarText: { color: colors.accent, fontWeight: "800", fontSize: 13 },
  sideUserName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  sideUserMail: { color: colors.textSubtle, fontSize: 12 },

  wrap: { backgroundColor: colors.bg, paddingHorizontal: 12, paddingTop: 6 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 6,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  tab: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 2 },
  iconWrap: { width: 52, height: 30, alignItems: "center", justifyContent: "center" },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  label: { fontSize: 11, fontWeight: "600", color: colors.textSubtle },
  labelOn: { color: colors.text },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 6 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 4, paddingHorizontal: 4 },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 4,
  },
  voiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceTitle: { color: colors.onAccent, fontSize: 16, fontWeight: "800" },
  voiceHint: { color: "rgba(0,0,0,0.6)", fontSize: 13, marginTop: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 12, borderRadius: radius.lg },
  rowActive: { backgroundColor: colors.surfaceAlt },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  rowHint: { color: colors.textMuted, fontSize: 13, marginTop: 1 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
