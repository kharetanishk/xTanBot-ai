import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOutDown,
  LinearTransition,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import XtanCharacter from "../character/XtanCharacter";
import { SpeechBubble, useTypewriter } from "../character/SpeechBubble";
import {
  LINES,
  narrator,
  useNarrator,
  type LineId,
} from "../character/narrator";
import {
  AlarmDemo,
  CallDemo,
  MeetingDemo,
  SearchDemo,
  VoiceDemo,
} from "./demos";
import { progressFor, useInView, useScroll, useSection } from "./scroll";
import { colors, radius } from "../../theme";

export const FONT = {
  display: "BricolageGrotesque_800ExtraBold",
  bold: "BricolageGrotesque_700Bold",
  semi: "BricolageGrotesque_600SemiBold",
  hand: "Caveat_700Bold",
};
export const NAV_H = 64;
const WEB = Platform.OS === "web";
// react-native-web passes `position: sticky` straight through to CSS.
const STICKY = { position: "sticky", top: NAV_H } as unknown as object;
const MAX_W = 1120;

type IconName = ComponentProps<typeof Ionicons>["name"];
const mix = (a: number, b: number, t: number) => {
  "worklet";
  return a + (b - a) * t;
};

// ── Shared bits ──────────────────────────────────────────────────────────────

/** Headline that slides up word by word (SplitText-style) once `show` flips. */
export function RevealWords({
  text,
  show,
  style,
  accent = [],
  delay = 0,
  center,
}: {
  text: string;
  show: boolean;
  style: StyleProp<TextStyle>;
  accent?: string[];
  delay?: number;
  center?: boolean;
}) {
  const fontSize = (StyleSheet.flatten(style)?.fontSize as number) ?? 32;
  return (
    <View style={[s.words, center && { justifyContent: "center" }]}>
      {text.split(" ").map((w, i) => (
        <Word
          key={`${w}-${i}`}
          word={w}
          show={show}
          delay={delay + i * 60}
          style={style}
          accent={accent.includes(w)}
          gap={fontSize * 0.26}
        />
      ))}
    </View>
  );
}

function Word({
  word,
  show,
  delay,
  style,
  accent,
  gap,
}: {
  word: string;
  show: boolean;
  delay: number;
  style: StyleProp<TextStyle>;
  accent: boolean;
  gap: number;
}) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = show
      ? withDelay(
          delay,
          withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
        )
      : 0;
  }, [show, delay, v]);
  const a = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [
      { translateY: (1 - v.value) * 60 },
      { rotate: `${(1 - v.value) * 6}deg` },
    ],
  }));
  return (
    <View style={{ overflow: "hidden", marginRight: gap, paddingBottom: 6 }}>
      <Animated.Text style={[style, accent && { color: colors.accent }, a]}>
        {word}
      </Animated.Text>
    </View>
  );
}

/** Fade + rise when `show` flips. */
function Rise({
  show,
  delay = 0,
  children,
  style,
}: {
  show: boolean;
  delay?: number;
  children: ReactNode;
  style?: object;
}) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = show
      ? withDelay(
          delay,
          withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }),
        )
      : 0;
  }, [show, delay, v]);
  const a = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: (1 - v.value) * 30 }],
  }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

/** Handwritten margin note. */
function Note({
  children,
  rotate = -6,
  style,
}: {
  children: ReactNode;
  rotate?: number;
  style?: object;
}) {
  return (
    <Text style={[s.note, { transform: [{ rotate: `${rotate}deg` }] }, style]}>
      {children}
    </Text>
  );
}

function Float({
  children,
  amp = 8,
  duration = 2600,
  delay = 0,
  style,
}: {
  children: ReactNode;
  amp?: number;
  duration?: number;
  delay?: number;
  style?: object;
}) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [v, amp, duration, delay]);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateY: -v.value * amp }],
  }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

/**
 * xTan's caption for line `id` (typed once `show` is true) and whether her lips move.
 * With sound on, lips follow the narrator (only while *this* line is actually playing);
 * muted, they flap while the caption types.
 */
function useLine(id: LineId, show: boolean) {
  const soundOn = useNarrator((st) => st.soundOn);
  const speaking = useNarrator((st) => st.speaking === id);
  const { shown, done } = useTypewriter(
    show ? LINES[id].show : "",
    soundOn ? 50 : 30,
    150,
  );
  return { shown, typing: !done, talking: soundOn ? speaking : show && !done };
}

/** XtanCharacter lip-synced to the narrator's live audio level while `id` is playing (web). */
function Narrated({
  id,
  talking,
  ...props
}: { id: LineId; talking: boolean } & ComponentProps<typeof XtanCharacter>) {
  const level = useNarrator((st) =>
    st.metered && st.speaking === id ? st.level : undefined,
  );
  return <XtanCharacter {...props} talking={talking} level={level} />;
}

/**
 * Speech bubble / character that own their typewriter state. Keeping that state *here*
 * (not in the big sections) means each typed character re-renders only the bubble or the
 * character — not the whole section with its chapters and live demos (that caused scroll lag).
 */
function LineBubble({
  id,
  show,
  ...bubble
}: { id: LineId; show: boolean } & Omit<
  ComponentProps<typeof SpeechBubble>,
  "text" | "typing"
>) {
  const { shown, typing } = useLine(id, show);
  return (
    <SpeechBubble
      {...bubble}
      text={shown}
      fullText={LINES[id].show}
      typing={show && typing}
      style={[bubble.style, { opacity: show ? 1 : 0 }]}
    />
  );
}

function LineCharacter({
  id,
  show,
  ...props
}: { id: LineId; show: boolean } & ComponentProps<typeof XtanCharacter>) {
  const { talking } = useLine(id, show);
  return <Narrated id={id} talking={talking} {...props} />;
}

/** Big, obvious opt-in: browsers only allow audio after a tap/click. */
export function HearButton({ compact }: { compact?: boolean }) {
  const soundOn = useNarrator((st) => st.soundOn);
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
      -1,
    );
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.25 }],
  }));
  if (soundOn) return null;
  return (
    <Animated.View entering={FadeIn} style={{ alignSelf: "center" }}>
      <Animated.View style={[s.hearRing, ring]} />
      <Pressable
        onPress={() => void narrator.enable()}
        style={({ pressed }) => [
          s.hearBtn,
          compact && s.hearCompact,
          pressed && s.pressed,
        ]}
      >
        <Ionicons
          name="volume-high"
          size={compact ? 16 : 18}
          color={colors.onAccent}
        />
        <Text style={s.hearText}>
          {compact ? "Hear her" : "Tap to hear xTan talk"}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Floating mini-xTan that narrates sections where she isn't on screen. */
const DOCK_LINES: LineId[] = ["marquee", "how", "callees", "stats", "faq"];

export function NarratorDock() {
  const focus = useNarrator((st) => st.focus);
  const visible = DOCK_LINES.includes(focus);
  return visible ? <DockCard key={focus} id={focus} /> : null;
}

function DockCard({ id }: { id: LineId }) {
  const { shown, typing, talking } = useLine(id, true);
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(200)}
      style={s.dock}
    >
      <View style={s.dockFace}>
        <Narrated id={id} talking={talking} size={58} variant="face" still />
      </View>
      <Text style={s.dockText} numberOfLines={3}>
        {shown}
        {typing ? <Text style={{ color: colors.accent }}>▍</Text> : null}
      </Text>
    </Animated.View>
  );
}

// ── 1. Hero ──────────────────────────────────────────────────────────────────

export function Hero({
  onStart,
  onLogin,
}: {
  onStart: () => void;
  onLogin: () => void;
}) {
  const { scrollY, vh, vw } = useScroll();
  const { onLayout } = useSection(0);
  const wide = vw >= 900;
  const [waving, setWaving] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setWaving(false), 2800);
    return () => clearTimeout(t);
  }, []);

  const charSize = wide ? 330 : Math.min(250, vw * 0.6);
  const title = wide ? 88 : vw < 400 ? 46 : 56;

  // Parallax layers: character drifts slower than the page, floating cards faster.
  // (Skipped on web: JS-driven scroll transforms lag the compositor there and jitter.)
  const charStyle = useAnimatedStyle(() =>
    WEB
      ? {}
      : {
          transform: [
            { translateY: scrollY.value * 0.22 },
            {
              scale: interpolate(
                scrollY.value,
                [0, vh],
                [1, 0.9],
                Extrapolation.CLAMP,
              ),
            },
          ],
        },
  );
  // Hero tokens fly up (and spin a little) at different depths as you scroll.
  const l1 = useLayer(scrollY, 0.45, 0.02);
  const l2 = useLayer(scrollY, 0.25, -0.03);
  const l3 = useLayer(scrollY, 0.6, 0.015);
  const blobA = useLayer(scrollY, 0.15, 0);
  const blobB = useLayer(scrollY, 0.08, 0);
  const cue = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 120], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View
      onLayout={onLayout}
      style={[
        s.hero,
        { minHeight: wide ? vh : undefined, paddingTop: NAV_H + 24 },
      ]}
    >
      <Animated.View
        style={[
          s.blob,
          {
            width: vw * 0.8,
            height: vw * 0.8,
            top: -vw * 0.2,
            left: -vw * 0.3,
            backgroundColor: "rgba(251,191,36,0.07)",
          },
          blobA,
        ]}
      />
      <Animated.View
        style={[
          s.blob,
          {
            width: vw * 0.5,
            height: vw * 0.5,
            top: vh * 0.25,
            right: -vw * 0.2,
            backgroundColor: "rgba(129,140,248,0.07)",
          },
          blobB,
        ]}
      />

      <View style={[s.heroInner, wide && s.heroInnerWide]}>
        <View style={[s.heroCopy, wide && { flex: 1.15 }]}>
          <Rise show delay={0}>
            <Text style={s.kicker}>YOUR PERSONAL AI ASSISTANT</Text>
          </Rise>
          <RevealWords
            text="Your assistant who actually picks up the phone."
            show
            delay={150}
            accent={["picks", "up", "the", "phone."]}
            style={[s.display, { fontSize: title, lineHeight: title * 1.02 }]}
            center={!wide}
          />
          <Rise
            show
            delay={900}
            style={{ alignItems: wide ? "flex-start" : "center" }}
          >
            <Text style={[s.lead, !wide && { textAlign: "center" }]}>
              Meet xTan. She calls clinics, schedules meetings, wakes you up and
              searches the web — all from one chat. Or just talk to her.
            </Text>
            <View style={[s.ctaRow, !wide && { justifyContent: "center" }]}>
              <Pressable
                onPress={onStart}
                style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}
              >
                <Text style={s.primaryText}>Get started — free</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={colors.onAccent}
                />
              </Pressable>
              <Pressable
                onPress={onLogin}
                style={({ pressed }) => [s.ghostBtn, pressed && s.pressed]}
              >
                <Text style={s.ghostText}>Log in</Text>
              </Pressable>
            </View>
          </Rise>
        </View>

        <View style={[s.heroStage, wide && { flex: 1 }]}>
          <LineBubble id="hero" show tail="bottom" style={s.heroBubble} />
          <Animated.View style={[{ alignItems: "center" }, charStyle]}>
            <View
              style={[
                s.spot,
                {
                  width: charSize,
                  height: charSize,
                  borderRadius: charSize / 2,
                },
              ]}
            />
            <LineCharacter id="hero" show size={charSize} wave={waving} />
          </Animated.View>
          <View style={{ marginTop: 14 }}>
            <HearButton />
          </View>

          {/* Floating feature tokens at different parallax depths */}
          <Animated.View
            style={[s.token, { top: wide ? "18%" : "30%", left: wide ? "-6%" : "0%" }, l1]}
          >
            <Float amp={10} delay={0}>
              <TokenCard
                icon="call"
                tone={colors.success}
                title="Calling Dr. Rao…"
                sub="booked ✓ Fri 4 PM"
                rotate={-8}
              />
            </Float>
          </Animated.View>
          <Animated.View
            style={[s.token, { top: wide ? "48%" : "55%", right: wide ? "-8%" : "0%" }, l2]}
          >
            <Float amp={12} delay={500}>
              <TokenCard
                icon="alarm"
                tone={colors.accent}
                title="7:00 AM"
                sub="wake-up call"
                rotate={7}
              />
            </Float>
          </Animated.View>
          <Animated.View
            style={[s.token, { bottom: "8%", left: wide ? "2%" : "4%" }, l3]}
          >
            <Float amp={8} delay={900}>
              <TokenCard
                icon="calendar"
                tone={colors.info}
                title="Design review"
                sub="5:00 PM · 3 people"
                rotate={-4}
              />
            </Float>
          </Animated.View>
          {wide ? (
            <Note style={s.heroNote}>psst… she really talks →</Note>
          ) : null}
        </View>
      </View>

      <Animated.View style={[s.cue, cue]}>
        <Text style={s.cueText}>Scroll</Text>
        <Float amp={6} duration={700}>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </Float>
      </Animated.View>
    </View>
  );
}

/** Parallax layer: moves `speed`× the scroll distance and spins slightly. */
function useLayer(scrollY: SharedValue<number>, speed: number, spin: number) {
  return useAnimatedStyle(() => ({
    transform: [
      { translateY: -scrollY.value * speed },
      { rotate: `${scrollY.value * spin}deg` },
    ],
  }));
}

function TokenCard({
  icon,
  tone,
  title,
  sub,
  rotate,
}: {
  icon: IconName;
  tone: string;
  title: string;
  sub: string;
  rotate: number;
}) {
  return (
    <View style={[s.tokenCard, { transform: [{ rotate: `${rotate}deg` }] }]}>
      <View style={[s.tokenIcon, { backgroundColor: `${tone}22` }]}>
        <Ionicons name={icon} size={16} color={tone} />
      </View>
      <View>
        <Text style={s.tokenTitle}>{title}</Text>
        <Text style={s.tokenSub}>{sub}</Text>
      </View>
    </View>
  );
}

// ── 2. Marquee ───────────────────────────────────────────────────────────────

const TICKER = [
  "📞 Makes calls",
  "📅 Books meetings",
  "⏰ Wakes you up",
  "🔎 Searches the web",
  "💬 Sends WhatsApps",
  "🎙️ Talks back",
  "🇮🇳 Speaks Hinglish",
];

export function Marquee() {
  const { onLayout } = useSection(1);
  return (
    <View onLayout={onLayout} style={s.marqueeWrap}>
      <Ticker reverse rotate={2} bg={colors.surface} fg={colors.textMuted} />
      <Ticker
        rotate={-2.5}
        bg={colors.accent}
        fg={colors.onAccent}
        style={{ marginTop: -40 }}
      />
    </View>
  );
}

function Ticker({
  reverse,
  rotate,
  bg,
  fg,
  style,
}: {
  reverse?: boolean;
  rotate: number;
  bg: string;
  fg: string;
  style?: object;
}) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (!w) return;
    x.value = 0;
    x.value = withRepeat(
      withTiming(-w, { duration: w * 22, easing: Easing.linear }),
      -1,
    );
  }, [w, x]);
  const a = useAnimatedStyle(() => ({
    transform: [{ translateX: reverse ? -w - x.value : x.value }],
  }));
  const row = (
    <View
      style={s.tickRow}
      onLayout={(e) => !w && setW(e.nativeEvent.layout.width)}
    >
      {TICKER.map((t) => (
        <Text key={t} style={[s.tickText, { color: fg }]}>
          {t} <Text style={{ opacity: 0.5 }}>✦</Text>
        </Text>
      ))}
    </View>
  );
  return (
    <View
      style={[
        s.ticker,
        { backgroundColor: bg, transform: [{ rotate: `${rotate}deg` }] },
        style,
      ]}
    >
      <Animated.View style={[{ flexDirection: "row" }, a]}>
        {row}
        {/* duplicate for a seamless loop */}
        <View style={s.tickRow}>
          {TICKER.map((t) => (
            <Text key={`b-${t}`} style={[s.tickText, { color: fg }]}>
              {t} <Text style={{ opacity: 0.5 }}>✦</Text>
            </Text>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

// ── 3. Pinned story: xTan stays on screen and narrates each feature ──────────

type Chapter = {
  id: LineId;
  kicker: string;
  title: string;
  note: string;
  demo: () => ReactNode;
  icon: IconName;
};

const CHAPTERS: Chapter[] = [
  {
    id: "ch-calls",
    kicker: "PHONE CALLS",
    icon: "call",
    title: "She calls them, so you don't have to.",
    note: "no hold music. ever.",
    demo: () => <CallDemo />,
  },
  {
    id: "ch-meetings",
    kicker: "MEETINGS",
    icon: "calendar",
    title: "Meetings, scheduled and confirmed.",
    note: "even the late ones",
    demo: () => <MeetingDemo />,
  },
  {
    id: "ch-search",
    kicker: "WEB SEARCH",
    icon: "search",
    title: "Ask anything. Get real answers.",
    note: "with phone numbers too",
    demo: () => <SearchDemo />,
  },
  {
    id: "ch-voice",
    kicker: "VOICE",
    icon: "mic",
    title: "Just talk. She listens.",
    note: "English & Hinglish 🇮🇳",
    demo: () => <VoiceDemo />,
  },
  {
    id: "ch-alarms",
    kicker: "ALARMS",
    icon: "alarm",
    title: "An alarm that actually calls you.",
    note: "snooze-proof ☀️",
    demo: () => <AlarmDemo />,
  },
];

export function StoryChapters() {
  const { scrollY, vh, vw } = useScroll();
  const { y, h, onLayout } = useSection(2);
  const wide = vw >= 900;
  const tiny = vw < 380; // 320px phones: smaller bust so the bubble isn't one word per line
  const n = CHAPTERS.length;

  const pinH = wide ? vh - NAV_H : Math.min(230, vh * 0.34);
  const CH = wide ? vh * 0.9 : Math.max(380, vh - NAV_H - pinH);

  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(0);
  useAnimatedReaction(
    () => {
      const raw = Math.floor(
        (scrollY.value - y.value + NAV_H + (wide ? vh * 0.5 : CH * 0.45)) / CH,
      );
      return Math.max(0, Math.min(n - 1, raw));
    },
    (i, prev) => {
      if (i !== prev) runOnJS(setActive)(i);
    },
    [CH, vh, wide],
  );
  useEffect(() => setReached((r) => Math.max(r, active)), [active]);
  const sectionSeen = useInView(y, 0.6);

  const chapter = CHAPTERS[active]!;
  useEffect(() => narrator.setChapter(chapter.id), [chapter.id]);

  // Pin: hold the narrator in place while the section scrolls past.
  // Web: CSS sticky — the browser pins it on the compositor thread, so it can't lag behind
  // the scroll. (A JS-driven transform runs a frame late on web and visibly jitters.)
  // Native: scroll handlers run on the UI thread, so the transform is frame-perfect there.
  const pin = useAnimatedStyle(() => {
    if (WEB || y.value > 1e8) return {};
    const max = Math.max(0, h.value - pinH);
    return {
      transform: [
        {
          translateY: Math.min(
            max,
            Math.max(0, scrollY.value + NAV_H - y.value),
          ),
        },
      ],
    };
  });

  const narratorView = (
    <Animated.View
      style={[
        wide ? s.pinWide : s.pinNarrow,
        { height: pinH },
        WEB && STICKY,
        pin,
      ]}
    >
      {wide ? (
        <>
          <LineBubble
            id={chapter.id}
            show={sectionSeen}
            tail="bottom"
            style={s.pinBubbleWide}
          />
          <View style={{ alignItems: "center" }}>
            <View
              style={[s.spot, { width: 300, height: 300, borderRadius: 150 }]}
            />
            <LineCharacter
              id={chapter.id}
              show={sectionSeen}
              size={Math.min(300, vh * 0.42)}
            />
          </View>
          <Dots n={n} active={active} />
        </>
      ) : (
        <View style={s.pinNarrowRow}>
          <View style={[s.bustFrame, tiny && { width: 92, height: 100, borderRadius: 22 }]}>
            <LineCharacter
              id={chapter.id}
              show={sectionSeen}
              size={tiny ? 92 : 140}
              variant="bust"
            />
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <LineBubble
              id={chapter.id}
              show={sectionSeen}
              tail="left"
              small={tiny}
              style={s.pinBubbleNarrow}
            />
            <Dots n={n} active={active} horizontal />
          </View>
        </View>
      )}
    </Animated.View>
  );

  return (
    <View onLayout={onLayout} style={[s.story, wide ? s.storyWide : null]}>
      {wide ? <View style={s.storyLeft}>{narratorView}</View> : narratorView}
      <View style={wide ? s.storyRight : null}>
        {CHAPTERS.map((c, i) => (
          <ChapterBlock
            key={c.kicker}
            chapter={c}
            index={i}
            height={CH}
            isActive={i === active}
            mounted={i <= reached}
            wide={wide}
          />
        ))}
      </View>
    </View>
  );
}

/** Chapter navigator under the narrator: icon pill on desktop, segmented bar on phones. */
function Dots({
  active,
  horizontal,
}: {
  n: number;
  active: number;
  horizontal?: boolean;
}) {
  const current = CHAPTERS[active] ?? CHAPTERS[0]!;
  const count = `${String(active + 1).padStart(2, "0")} / ${String(CHAPTERS.length).padStart(2, "0")}`;

  if (horizontal) {
    return (
      <View style={s.navNarrow}>
        <View style={s.segments}>
          {CHAPTERS.map((c, i) => (
            <View key={c.id} style={s.segTrack}>
              <Animated.View
                layout={LinearTransition.duration(450)}
                style={[s.segFill, { width: i <= active ? "100%" : "0%", opacity: i === active ? 1 : 0.45 }]}
              />
            </View>
          ))}
        </View>
        <Text style={s.navLabel} numberOfLines={1}>
          <Text style={s.navCount}>{count}</Text>  {current.kicker}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.navWide}>
      <View style={s.navPill}>
        {CHAPTERS.map((c, i) => {
          const on = i === active;
          return (
            <Animated.View
              key={c.id}
              layout={LinearTransition.duration(450)}
              style={[s.navItem, on && s.navItemOn, i < active && s.navItemDone]}
            >
              <Ionicons
                name={c.icon}
                size={on ? 16 : 14}
                color={on ? colors.onAccent : i < active ? colors.accent : colors.textSubtle}
              />
              {on ? (
                <Animated.Text entering={FadeIn.duration(350)} style={s.navItemText} numberOfLines={1}>
                  {c.kicker}
                </Animated.Text>
              ) : null}
            </Animated.View>
          );
        })}
      </View>
      <Text style={s.navCount}>{count}</Text>
    </View>
  );
}

function ChapterBlock({
  chapter,
  index,
  height,
  isActive,
  mounted,
  wide,
}: {
  chapter: Chapter;
  index: number;
  height: number;
  isActive: boolean;
  mounted: boolean;
  wide: boolean;
}) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(isActive ? 1 : 0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [isActive, v]);
  const a = useAnimatedStyle(() => ({
    opacity: 0.25 + v.value * 0.75,
    transform: [{ scale: 0.96 + v.value * 0.04 }],
  }));
  const titleSize = wide ? 54 : 34;

  return (
    <Animated.View style={[s.chapter, { minHeight: height }, a]}>
      <View style={s.chapterKickerRow}>
        <View style={s.chapterIcon}>
          <Ionicons name={chapter.icon} size={16} color={colors.accent} />
        </View>
        <Text style={s.kicker}>
          {String(index + 1).padStart(2, "0")} · {chapter.kicker}
        </Text>
      </View>
      <RevealWords
        text={chapter.title}
        show={mounted}
        style={[
          s.display,
          { fontSize: titleSize, lineHeight: titleSize * 1.05 },
        ]}
      />
      <View style={s.demoSlot}>{mounted ? chapter.demo() : null}</View>
      <Note
        rotate={index % 2 ? 4 : -4}
        style={{ alignSelf: index % 2 ? "flex-end" : "flex-start" }}
      >
        {chapter.note}
      </Note>
    </Animated.View>
  );
}

// ── 4. How it works: cards fan out on scroll ─────────────────────────────────

const STEPS: {
  n: string;
  title: string;
  body: string;
  icon: IconName;
  bg: string;
  fg: string;
}[] = [
  {
    n: "01",
    title: "Just ask",
    body: "Type or talk — “Book me a dentist for Friday evening.”",
    icon: "chatbubbles",
    bg: "#FBBF24",
    fg: "#0a0a0a",
  },
  {
    n: "02",
    title: "xTan takes over",
    body: "She finds the number, makes the call and handles the conversation for you.",
    icon: "call",
    bg: "#818cf8",
    fg: "#0a0a0a",
  },
  {
    n: "03",
    title: "You get the result",
    body: "A summary lands in your app — who she spoke to and what was agreed.",
    icon: "checkmark-done",
    bg: "#4ade80",
    fg: "#0a0a0a",
  },
];

export function HowItWorks() {
  const { scrollY, vh, vw } = useScroll();
  const { y, onLayout } = useSection(3);
  const wide = vw >= 900;
  const seen = useInView(y, 0.75);
  const cardW = wide ? 300 : Math.min(320, vw - 56);

  return (
    <View onLayout={onLayout} style={s.section}>
      <View style={s.sectionHead}>
        <RevealWords
          text="How it works"
          show={seen}
          style={[
            s.display,
            { fontSize: wide ? 72 : 44, lineHeight: wide ? 76 : 48 },
          ]}
          center
        />
        <Note rotate={-3}>it's honestly that easy</Note>
      </View>
      <View
        style={[
          s.fan,
          wide ? { flexDirection: "row", height: 380 } : { gap: 18 },
        ]}
      >
        {STEPS.map((st, i) => (
          <FanCard
            key={st.n}
            step={st}
            i={i}
            y={y}
            scrollY={scrollY}
            vh={vh}
            wide={wide}
            width={cardW}
          />
        ))}
      </View>
    </View>
  );
}

function FanCard({
  step,
  i,
  y,
  scrollY,
  vh,
  wide,
  width,
}: {
  step: (typeof STEPS)[number];
  i: number;
  y: SharedValue<number>;
  scrollY: SharedValue<number>;
  vh: number;
  wide: boolean;
  width: number;
}) {
  const a = useAnimatedStyle(() => {
    if (y.value > 1e8) return { opacity: 0 };
    if (wide) {
      // Stacked in the middle → fanned out as the section scrolls up.
      const p = progressFor(scrollY.value, y.value, vh, 0.85, 0.15);
      const offset = (i - 1) * (width + 24);
      return {
        opacity: interpolate(p, [0, 0.25], [0, 1], Extrapolation.CLAMP),
        transform: [
          { translateX: mix(-offset, 0, p) },
          { translateY: mix(60, [18, -14, 18][i]!, p) },
          { rotate: `${mix([-4, 2, 7][i]!, [-7, 0, 7][i]!, p)}deg` },
        ],
      };
    }
    const p = progressFor(
      scrollY.value,
      y.value + 160 + i * 220,
      vh,
      0.95,
      0.55,
    );
    return {
      opacity: p,
      transform: [
        { translateX: mix(i % 2 ? 80 : -80, 0, p) },
        { rotate: `${mix(i % 2 ? 8 : -8, i % 2 ? 2 : -2, p)}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        s.fanCard,
        { width, backgroundColor: step.bg, zIndex: i === 1 ? 3 : 1 },
        wide && { marginHorizontal: 12 },
        a,
      ]}
    >
      <Text style={[s.fanNum, { color: step.fg }]}>{step.n}</Text>
      <View style={s.fanIcon}>
        <Ionicons name={step.icon} size={30} color={step.fg} />
      </View>
      <Text style={[s.fanTitle, { color: step.fg }]}>{step.title}</Text>
      <Text style={[s.fanBody, { color: step.fg }]}>{step.body}</Text>
    </Animated.View>
  );
}

// ── 5. "Who can she call?" — giant list lit by scroll position ───────────────

const CALLEES = [
  "Your dentist.",
  "That new café.",
  "Your salon.",
  "The whole team.",
  "Customer care.",
  "Even you, at 7 AM.",
];

export function CallAnyone() {
  const { scrollY, vh, vw } = useScroll();
  const { y, onLayout } = useSection(4);
  const wide = vw >= 900;
  const seen = useInView(y, 0.8);
  const listTop = useSharedValue(0);
  // Each line must fit on one row so the scroll highlight lines up with it.
  const size = wide ? 92 : Math.min(52, Math.floor((vw - 40) / 10.5));
  const lineH = size * 1.12;

  return (
    <View onLayout={onLayout} style={[s.section, s.callSection]}>
      <Rise show={seen}>
        <Text style={[s.kicker, { textAlign: "center" }]}>
          WHO CAN XTAN CALL FOR YOU?
        </Text>
      </Rise>
      <View
        onLayout={(e) => (listTop.value = e.nativeEvent.layout.y)}
        style={{ marginTop: 20 }}
      >
        {CALLEES.map((t, i) => (
          <CalleeLine
            key={t}
            text={t}
            i={i}
            y={y}
            listTop={listTop}
            lineH={lineH}
            size={size}
            scrollY={scrollY}
            vh={vh}
          />
        ))}
      </View>
      <Note rotate={3} style={{ alignSelf: "center", marginTop: 18 }}>
        …basically anyone with a phone number
      </Note>
    </View>
  );
}

function CalleeLine({
  text,
  i,
  y,
  listTop,
  lineH,
  size,
  scrollY,
  vh,
}: {
  text: string;
  i: number;
  y: SharedValue<number>;
  listTop: SharedValue<number>;
  lineH: number;
  size: number;
  scrollY: SharedValue<number>;
  vh: number;
}) {
  const a = useAnimatedStyle(() => {
    const center = y.value + listTop.value + i * lineH + lineH / 2;
    const d = Math.abs(scrollY.value + vh * 0.5 - center);
    const t = interpolate(d, [0, vh * 0.32], [1, 0], Extrapolation.CLAMP);
    return {
      color: interpolateColor(t, [0, 1], ["#262b36", colors.accent]),
      transform: [
        { scale: 0.92 + t * 0.08 },
        { translateX: (1 - t) * (i % 2 ? 18 : -18) },
      ],
    };
  });
  return (
    <Animated.Text style={[s.callee, { fontSize: size, lineHeight: lineH }, a]}>
      {text}
    </Animated.Text>
  );
}

// ── 6. Stats with count-up ───────────────────────────────────────────────────

const STATS = [
  { to: 10, suffix: "+", label: "tools she can use" },
  { to: 24, suffix: "/7", label: "always on duty" },
  { to: 2, suffix: "", label: "languages: English & Hinglish" },
  { to: 0, prefix: "₹", suffix: "", label: "to get started" },
];

export function Stats() {
  const { vw } = useScroll();
  const { y, onLayout } = useSection(5);
  const seen = useInView(y, 0.85);
  const wide = vw >= 900;
  return (
    <View
      onLayout={onLayout}
      style={[s.section, s.statsRow, !wide && { flexWrap: "wrap" }]}
    >
      {STATS.map((st, i) => (
        <Rise
          key={st.label}
          show={seen}
          delay={i * 120}
          style={[s.stat, !wide && { width: "46%" }]}
        >
          <Text style={s.statValue}>
            {st.prefix ?? ""}
            <CountUp to={st.to} run={seen} />
            {st.suffix}
          </Text>
          <Text style={s.statLabel}>{st.label}</Text>
        </Rise>
      ))}
    </View>
  );
}

function CountUp({ to, run }: { to: number; run: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run || to === 0) return;
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / 1200);
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [run, to]);
  return <>{n}</>;
}

// ── 7. FAQ ───────────────────────────────────────────────────────────────────

const FAQS = [
  [
    "Is xTan a real person?",
    "Nope — xTan is an AI assistant with a natural voice. When she calls someone, she always says she's an AI calling on your behalf.",
  ],
  [
    "Can she really make phone calls?",
    "Yes. She places real calls, talks to whoever picks up, and sends you a summary of what was agreed.",
  ],
  [
    "Does she understand Hinglish?",
    "Haan, bilkul! Mix English and Hindi however you naturally speak.",
  ],
  [
    "Is my data safe?",
    "Your contacts and conversations stay in your account. We never sell your data.",
  ],
  [
    "What does it cost?",
    "Nothing to get started. Create an account and start chatting in under a minute.",
  ],
];

export function Faq() {
  const { vw } = useScroll();
  const { y, onLayout } = useSection(6);
  const seen = useInView(y, 0.8);
  const [open, setOpen] = useState<number | null>(0);
  const wide = vw >= 900;
  return (
    <View onLayout={onLayout} style={[s.section, { maxWidth: 760 }]}>
      <RevealWords
        text="Common questions"
        show={seen}
        style={[
          s.display,
          { fontSize: wide ? 64 : 40, lineHeight: wide ? 68 : 44 },
        ]}
        center
      />
      <View style={{ marginTop: 24, gap: 10 }}>
        {FAQS.map(([q, a], i) => (
          <Animated.View
            key={q}
            layout={LinearTransition.duration(260)}
            style={s.faq}
          >
            <Pressable
              onPress={() => setOpen(open === i ? null : i)}
              style={s.faqQ}
            >
              <Text style={s.faqQText}>{q}</Text>
              <Ionicons
                name={open === i ? "remove" : "add"}
                size={22}
                color={colors.accent}
              />
            </Pressable>
            {open === i ? (
              <Animated.Text entering={FadeIn.duration(300)} style={s.faqA}>
                {a}
              </Animated.Text>
            ) : null}
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ── 8. Final call to action ──────────────────────────────────────────────────

export function FinalCta({
  onStart,
  onLogin,
}: {
  onStart: () => void;
  onLogin: () => void;
}) {
  const { scrollY, vh, vw } = useScroll();
  const { y, onLayout } = useSection(7);
  const wide = vw >= 900;
  const seen = useInView(y, 0.7);
  const [waving, setWaving] = useState(false);
  useEffect(() => {
    if (!seen) return;
    setWaving(true);
    const t = setTimeout(() => setWaving(false), 2800);
    return () => clearTimeout(t);
  }, [seen]);
  // The block grows into place as it arrives.
  const grow = useAnimatedStyle(() => {
    const p =
      y.value > 1e8 ? 0 : progressFor(scrollY.value, y.value, vh, 1, 0.45);
    return {
      transform: [{ scale: 0.88 + p * 0.12 }],
      borderRadius: 64 - p * 24,
    };
  });
  const title = wide ? 76 : 42;

  return (
    <View onLayout={onLayout} style={{ paddingHorizontal: 16, paddingTop: 40 }}>
      <Animated.View style={[s.final, wide && s.finalWide, grow]}>
        <View style={[{ flex: 1, gap: 16 }, !wide && { alignItems: "center" }]}>
          <RevealWords
            text="Ready when you are."
            show={seen}
            style={[
              s.display,
              {
                color: colors.onAccent,
                fontSize: title,
                lineHeight: title * 1.02,
              },
            ]}
            center={!wide}
          />
          <Text style={[s.finalLead, !wide && { textAlign: "center" }]}>
            Create your free account and say hi to xTan. She's been waiting.
          </Text>
          <View style={[s.ctaRow, !wide && { justifyContent: "center" }]}>
            <Pressable
              onPress={onStart}
              style={({ pressed }) => [s.darkBtn, pressed && s.pressed]}
            >
              <Text style={s.darkText}>Get started</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={onLogin}
              style={({ pressed }) => [s.ghostDark, pressed && s.pressed]}
            >
              <Text style={s.ghostDarkText}>I have an account</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ alignItems: "center", gap: 10 }}>
          <LineBubble
            id="final"
            show={seen}
            tail="bottom"
            dark
            style={{ maxWidth: 300 }}
          />
          <LineCharacter
            id="final"
            show={seen}
            size={wide ? 240 : 200}
            wave={waving}
            dance={seen}
          />
        </View>
      </Animated.View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  words: { flexDirection: "row", flexWrap: "wrap" },
  hearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  hearCompact: { paddingHorizontal: 14, paddingVertical: 8 },
  hearRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  hearText: { color: colors.onAccent, fontFamily: FONT.bold, fontSize: 15 },
  dock: {
    position: "absolute",
    right: 16,
    bottom: 20,
    zIndex: 60,
    maxWidth: 340,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    borderRadius: 24,
    padding: 10,
    paddingRight: 16,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  dockFace: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    backgroundColor: "#1a1505",
    alignItems: "center",
    justifyContent: "center",
  },
  dockText: {
    flex: 1,
    color: colors.text,
    fontFamily: FONT.semi,
    fontSize: 14,
    lineHeight: 19,
  },
  display: {
    fontFamily: FONT.display,
    color: colors.text,
    letterSpacing: -1.5,
  },
  kicker: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: FONT.bold,
    letterSpacing: 1.8,
  },
  lead: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 28,
    fontFamily: FONT.semi,
    maxWidth: 540,
    marginTop: 6,
  },
  note: { fontFamily: FONT.hand, color: "#c4b5fd", fontSize: 26 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },

  hero: { paddingHorizontal: 20, paddingBottom: 40, overflow: "hidden" },
  heroInner: { width: "100%", maxWidth: MAX_W, alignSelf: "center", gap: 28 },
  heroInnerWide: { flexDirection: "row", alignItems: "center", flex: 1 },
  heroCopy: { gap: 14 },
  heroStage: { alignItems: "center", justifyContent: "center", minHeight: 420 },
  heroBubble: { maxWidth: 320, marginBottom: 6 },
  heroNote: { position: "absolute", left: -40, bottom: "36%" },
  blob: { position: "absolute", borderRadius: 9999 },
  spot: {
    position: "absolute",
    bottom: "6%",
    backgroundColor: "rgba(251,191,36,0.09)",
  },
  ctaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 26,
    paddingVertical: 16,
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  primaryText: { color: colors.onAccent, fontSize: 16, fontFamily: FONT.bold },
  ghostBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghostText: { color: colors.text, fontSize: 16, fontFamily: FONT.bold },
  token: { position: "absolute" },
  tokenCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenTitle: { color: colors.text, fontSize: 13, fontFamily: FONT.bold },
  tokenSub: { color: colors.textMuted, fontSize: 11, fontFamily: FONT.semi },
  cue: { alignItems: "center", marginTop: 12 },
  cueText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: FONT.bold,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  marqueeWrap: { paddingVertical: 50, overflow: "hidden" },
  ticker: { paddingVertical: 16, marginHorizontal: -40 },
  tickRow: { flexDirection: "row" },
  tickText: { fontFamily: FONT.display, fontSize: 26, marginRight: 28 },

  story: {
    paddingHorizontal: 20,
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
  },
  storyWide: { flexDirection: "row", gap: 40 },
  storyLeft: { width: "42%" },
  storyRight: { flex: 1 },
  pinWide: { alignItems: "center", justifyContent: "center", gap: 18 },
  pinBubbleWide: { maxWidth: 380, minHeight: 84, alignSelf: "stretch" },
  pinNarrow: {
    zIndex: 5,
    backgroundColor: colors.bg,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pinNarrowRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pinBubbleNarrow: { paddingVertical: 10, paddingHorizontal: 14 },
  bustFrame: {
    width: 140,
    height: 150,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#1a1505",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
    justifyContent: "flex-end",
  },
  navWide: { alignItems: "center", gap: 10, marginTop: 6 },
  navPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(17,24,39,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    ...(WEB ? ({ backdropFilter: "blur(10px)" } as object) : {}),
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 34,
    minWidth: 34,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  navItemDone: { backgroundColor: "rgba(251,191,36,0.10)" },
  navItemOn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  navItemText: { color: colors.onAccent, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  navCount: { color: colors.textSubtle, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, fontVariant: ["tabular-nums"] },
  navNarrow: { gap: 8 },
  segments: { flexDirection: "row", gap: 5 },
  segTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, overflow: "hidden" },
  segFill: { height: "100%", borderRadius: 2, backgroundColor: colors.accent },
  navLabel: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  chapter: { justifyContent: "center", gap: 18, paddingVertical: 24 },
  chapterKickerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  chapterIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  demoSlot: { minHeight: 170, maxWidth: 460 },

  section: {
    paddingHorizontal: 20,
    paddingVertical: 80,
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
  },
  sectionHead: { alignItems: "center", gap: 6, marginBottom: 40 },
  fan: { alignItems: "center", justifyContent: "center" },
  fanCard: { borderRadius: 28, padding: 24, minHeight: 300, gap: 10 },
  fanNum: { fontFamily: FONT.display, fontSize: 18, opacity: 0.6 },
  fanIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  fanTitle: { fontFamily: FONT.display, fontSize: 30, letterSpacing: -0.8 },
  fanBody: {
    fontFamily: FONT.semi,
    fontSize: 16,
    lineHeight: 23,
    opacity: 0.8,
  },

  callSection: { alignItems: "center" },
  callee: { fontFamily: FONT.display, textAlign: "center", letterSpacing: -2 },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 50,
  },
  stat: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 22,
  },
  statValue: {
    fontFamily: FONT.display,
    fontSize: 52,
    color: colors.accent,
    letterSpacing: -2,
  },
  statLabel: {
    fontFamily: FONT.semi,
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 4,
  },

  faq: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: "hidden",
  },
  faqQ: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 20,
  },
  faqQText: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontFamily: FONT.bold,
  },
  faqA: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FONT.semi,
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginTop: -6,
  },

  final: {
    backgroundColor: colors.accent,
    padding: 32,
    gap: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
  },
  finalWide: { flexDirection: "row", padding: 56 },
  finalLead: {
    color: "rgba(0,0,0,0.7)",
    fontSize: 18,
    lineHeight: 27,
    fontFamily: FONT.semi,
    maxWidth: 460,
  },
  darkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0a0a0a",
    borderRadius: radius.pill,
    paddingHorizontal: 26,
    paddingVertical: 16,
  },
  darkText: { color: colors.accent, fontSize: 16, fontFamily: FONT.bold },
  ghostDark: {
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.35)",
  },
  ghostDarkText: { color: "#0a0a0a", fontSize: 16, fontFamily: FONT.bold },
});
