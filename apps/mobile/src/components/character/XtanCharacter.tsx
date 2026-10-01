import { memo, useEffect, useId, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * xTanBot's character, hand-traced from the reference art (coordinates are in the
 * original 1254×1254 image space, so `viewBox` crops give full body / bust / face).
 *
 * Animated pieces:
 *  - mouth: `talking` (procedural lip-flap) or `level` (0..1 audio volume → real lip-sync)
 *  - eyes: random natural blinks
 *  - body: idle breathing + gentle sway (UI-thread via reanimated)
 *  - right arm: `wave`
 */

const C = {
  outline: "#1b1311",
  skin: "#c4703c",
  skinLight: "#d4824b",
  skinShade: "#a2532a",
  blush: "#e0643a",
  hair: "#2b1f1d",
  hairMid: "#40302d",
  hairHi: "#705951",
  top: "#fdebc7",
  topDot: "#e3c79a",
  pants: "#3c2f2f",
  pantsShade: "#2a2020",
  gold: "#f9a423",
  goldHi: "#fdd57a",
  goldDark: "#d97f12",
  iris: "#5b2d14",
  pupil: "#120b0a",
  brow: "#371f10",
  lip: "#7b2411",
  mouthIn: "#4a120a",
  tongue: "#d8584a",
};

const VIEWBOX = {
  full: "250 80 720 1110",
  bust: "300 85 620 640",
  face: "360 150 500 500",
} as const;

export type CharacterVariant = keyof typeof VIEWBOX;

type Props = {
  size?: number;
  variant?: CharacterVariant;
  /** Procedural lip-flap while true (e.g. while text streams / captions type). */
  talking?: boolean;
  /** Live audio level 0..1; when provided it drives the mouth instead of `talking`. */
  level?: number;
  /** Raise the right arm and wave. */
  wave?: boolean;
  /** Happy dance: hop to a beat with squash, hip sway and a pumping arm. */
  dance?: boolean;
  /** Disable idle breathing/sway (e.g. tiny inline avatars). */
  still?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function XtanCharacter({
  size = 240,
  variant = "full",
  talking = false,
  level,
  wave = false,
  dance = false,
  still = false,
  style,
}: Props) {
  // Gradient ids must be unique per instance: on web all inline SVGs share one id namespace,
  // so a shared "face" gradient can resolve to a hidden copy (e.g. an inactive tab) → black face.
  const uid = "x" + useId().replace(/[^a-zA-Z0-9]/g, "");

  const [, , w, h] = VIEWBOX[variant].split(" ").map(Number) as [number, number, number, number];
  const height = (size * h) / w;

  // Idle life: slow breathing bob + tiny sway, all on the UI thread.
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [still, t]);

  // Dance: one loop = two beats (left, right). Each beat is a hop that squashes on landing.
  const beat = useSharedValue(0);
  useEffect(() => {
    if (!dance) {
      beat.value = 0;
      return;
    }
    beat.value = 0;
    beat.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1);
  }, [dance, beat]);
  // One animated style for both modes: swapping style objects on the wrapper made React's
  // dev prop-diff walk into reanimated styles and throw.
  const motion = useAnimatedStyle(() => {
    if (!dance) {
      return {
        transform: [
          { translateX: 0 },
          { translateY: -t.value * (variant === "full" ? 6 : 3) },
          { rotate: `${(t.value - 0.5) * 2}deg` },
          { scaleX: 1 },
          { scaleY: 1 },
        ],
      };
    }
    const phase = beat.value * 2;
    const side = phase < 1 ? 1 : -1;
    const hop = Math.sin((phase % 1) * Math.PI); // 0 on the floor → 1 at the top
    return {
      transform: [
        { translateX: side * 9 * hop },
        { translateY: -size * 0.07 * hop },
        { rotate: `${side * 7 * hop}deg` },
        { scaleX: 1.04 - 0.04 * hop },
        { scaleY: 0.95 + 0.05 * hop },
      ],
    };
  });

  return (
    <Animated.View
      style={[{ width: size, height }, motion, style]}
      accessibilityRole="image"
      accessibilityLabel="xTanBot"
    >
      <Figure
        uid={uid}
        size={size}
        height={height}
        viewBox={VIEWBOX[variant]}
        talking={talking}
        level={level}
        wave={wave || dance}
        pump={dance}
      />
    </Animated.View>
  );
}

/**
 * The fast-changing state (mouth flap, blinks, waving arm — updates every ~40ms) lives
 * here so it re-renders only the SVG. If it lived in XtanCharacter, the animated wrapper
 * would re-render too, and React's dev prop-diff throws when it walks into a reanimated
 * style ("animated style to a non-animated component"), freezing the whole page.
 */
const Figure = memo(function Figure({
  uid,
  size,
  height,
  viewBox,
  talking,
  level,
  wave,
  pump,
}: {
  uid: string;
  size: number;
  height: number;
  viewBox: string;
  talking: boolean;
  level?: number;
  wave: boolean;
  pump: boolean;
}) {
  const mouth = useMouth(talking, level);
  const blinking = useBlink();
  const armAngle = useWave(wave, pump);
  return (
    <Svg width={size} height={height} viewBox={viewBox}>
      <CharacterArt uid={uid} mouth={mouth} blinking={blinking} armAngle={armAngle} />
    </Svg>
  );
});

// ── Animation hooks ──────────────────────────────────────────────────────────

/** Mouth openness 0..1. Audio level wins; otherwise a natural-looking syllable flap. */
function useMouth(talking: boolean, level?: number): number {
  const [open, setOpen] = useState(0);
  const cur = useRef(0);
  const levelRef = useRef(level);
  levelRef.current = level;

  const audioDriven = level !== undefined;
  useEffect(() => {
    if (!audioDriven && !talking) {
      cur.current = 0;
      setOpen(0);
      return;
    }
    let target = 0;
    let ticks = 0;
    const id = setInterval(() => {
      if (audioDriven) {
        // LiveKit volume is small (≈0–0.35); scale up and gate the noise floor.
        target = Math.min(1, Math.max(0, ((levelRef.current ?? 0) - 0.015) * 4.5));
      } else if (++ticks % 2 === 0) {
        // New "syllable" every ~140ms; occasional closed beats read as word gaps.
        target = Math.random() < 0.2 ? 0.04 : 0.3 + Math.random() * 0.7;
      }
      cur.current += (target - cur.current) * 0.55;
      setOpen(Math.round(cur.current * 20) / 20); // quantise → fewer re-renders
    }, 70);
    return () => clearInterval(id);
  }, [talking, audioDriven]);

  return open;
}

/** Natural blink every 2.5–5.5s (sometimes a double-blink). */
function useBlink(): boolean {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const blink = (thenDouble: boolean) => {
      setClosed(true);
      timer = setTimeout(() => {
        if (!alive) return;
        setClosed(false);
        timer = thenDouble ? setTimeout(() => alive && blink(false), 180) : schedule();
      }, 120);
    };
    const schedule = () => (timer = setTimeout(() => alive && blink(Math.random() < 0.2), 2500 + Math.random() * 3000));
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  return closed;
}

/** Right-arm rotation (deg) around the shoulder; 0 = resting. */
function useWave(wave: boolean, pump = false): number {
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    if (!wave) {
      setAngle(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const s = (Date.now() - start) / 1000;
      const raise = Math.min(1, s / 0.35); // lift the arm first, then wave
      // pump: big up-down cheer in time with the dance beat (one pump per hop).
      setAngle(
        Math.round(
          pump
            ? raise * (-95 + Math.sin(s * ((2 * Math.PI) / 0.55)) * 40)
            : raise * -112 + raise * Math.sin(s * 11) * 14,
        ),
      );
    }, 40);
    return () => clearInterval(id);
  }, [wave]);
  return angle;
}

// ── Artwork ──────────────────────────────────────────────────────────────────

const stroke = { stroke: C.outline, strokeWidth: 5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const CharacterArt = memo(function CharacterArt({
  uid,
  mouth,
  blinking,
  armAngle,
}: {
  uid: string;
  mouth: number;
  blinking: boolean;
  armAngle: number;
}) {
  // Small head nod that follows speech.
  const headTilt = -1.5 + mouth * 2.5;

  return (
    <>
      <Defs>
        <RadialGradient id={`${uid}-face`} cx="50%" cy="40%" r="65%">
          <Stop offset="0" stopColor={C.skinLight} />
          <Stop offset="0.7" stopColor={C.skin} />
          <Stop offset="1" stopColor={C.skinShade} />
        </RadialGradient>
        <RadialGradient id={`${uid}-iris`} cx="50%" cy="45%" r="60%">
          <Stop offset="0" stopColor={C.pupil} />
          <Stop offset="0.55" stopColor="#2a160d" />
          <Stop offset="1" stopColor={C.iris} />
        </RadialGradient>
        <LinearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.goldHi} />
          <Stop offset="0.45" stopColor={C.gold} />
          <Stop offset="1" stopColor={C.goldDark} />
        </LinearGradient>
        <LinearGradient id={`${uid}-hair`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.hairMid} />
          <Stop offset="1" stopColor={C.hair} />
        </LinearGradient>
        <LinearGradient id={`${uid}-pants`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={C.pants} />
          <Stop offset="0.6" stopColor={C.pants} />
          <Stop offset="1" stopColor={C.pantsShade} />
        </LinearGradient>
      </Defs>

      {/* Ground shadow */}
      <Ellipse cx={632} cy={1152} rx={200} ry={20} fill="#000" opacity={0.35} />

      {/* Back hair (behind head and shoulders) */}
      <Path
        d="M600 105 C470 100 360 170 318 290 C290 370 300 450 292 520 C285 580 300 630 330 660 C360 690 410 680 440 660 L770 660 C820 680 880 690 915 650 C945 610 940 540 930 470 C922 380 905 280 850 210 C790 135 700 105 600 105 Z"
        fill={`url(#${uid}-hair)`}
        {...stroke}
      />
      <Path d="M335 520 C330 580 345 625 370 650 M890 500 C900 560 895 610 875 640" stroke={C.hairHi} strokeWidth={5} opacity={0.35} fill="none" strokeLinecap="round" />

      {/* Neck */}
      <Path d="M572 588 L662 588 L666 668 C640 682 598 682 570 668 Z" fill={C.skinShade} {...stroke} />

      {/* Left arm (static) */}
      <Path d="M552 662 C520 682 505 732 492 790 C486 820 478 842 470 862 L514 870 C522 832 534 792 546 760 L560 700 Z" fill={C.skin} {...stroke} />
      <Ellipse cx={482} cy={888} rx={31} ry={30} fill={C.skin} {...stroke} />
      <Path d="M468 902 L466 914 M482 906 L481 918 M496 902 L498 912" stroke={C.outline} strokeWidth={3} strokeLinecap="round" />
      <G transform="rotate(16 486 832)">
        <Rect x={454} y={816} width={64} height={30} rx={11} fill={`url(#${uid}-gold)`} {...stroke} strokeWidth={4} />
        <Rect x={462} y={822} width={48} height={6} rx={3} fill={C.goldHi} opacity={0.8} />
      </G>

      {/* Pants */}
      <Path
        d="M530 790 L745 795 C760 900 780 1000 795 1090 L668 1098 C660 1010 648 930 636 880 C624 930 612 1010 606 1095 L482 1092 C495 1000 515 890 530 790 Z"
        fill={`url(#${uid}-pants)`}
        {...stroke}
      />
      <Path d="M637 805 L636 880" stroke={C.outline} strokeWidth={4} opacity={0.6} />
      <Path d="M560 830 C552 920 540 1000 528 1080 M715 840 C728 930 740 1010 752 1080" stroke={C.pantsShade} strokeWidth={6} opacity={0.5} fill="none" strokeLinecap="round" />

      {/* Shoes */}
      {[
        "M468 1112 C468 1084 520 1076 565 1078 C612 1080 642 1094 642 1114 C642 1138 602 1150 555 1150 C504 1150 468 1138 468 1112 Z",
        "M650 1118 C650 1090 700 1084 736 1086 C774 1088 794 1100 794 1120 C794 1143 760 1154 722 1154 C680 1154 650 1143 650 1118 Z",
      ].map((d) => (
        <Path key={d} d={d} fill={`url(#${uid}-gold)`} {...stroke} />
      ))}
      <Path d="M476 1124 C520 1140 600 1142 638 1124 M656 1130 C700 1146 760 1146 790 1130" stroke={C.goldDark} strokeWidth={5} fill="none" strokeLinecap="round" />
      <Path d="M500 1092 C530 1086 560 1086 590 1090 M680 1098 C710 1093 740 1093 765 1098" stroke={C.goldHi} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.9} />

      {/* Chest skin + tank top */}
      <Path d="M552 650 L714 650 L716 706 L550 708 Z" fill={C.skin} />
      <Path d="M592 668 C602 674 616 674 626 668 M640 668 C652 674 664 674 674 668" stroke={C.skinShade} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M552 650 L566 650 L568 706 L552 706 Z M700 650 L714 650 L716 704 L702 704 Z" fill={C.top} {...stroke} strokeWidth={4} />
      <Path d="M538 702 L722 700 C720 740 716 776 718 806 L534 810 C538 776 540 740 538 702 Z" fill={C.top} {...stroke} />
      {[722, 750, 778].flatMap((y, r) =>
        [556, 596, 636, 676].map((x) => (
          <Rect key={`${x}-${y}`} x={x + (r % 2) * 18} y={y} width={14} height={11} rx={2} fill={C.topDot} />
        )),
      )}

      {/* ── Head ── */}
      <G transform={`rotate(${headTilt} 605 600)`}>
        {/* Right ear + earring */}
        <Ellipse cx={852} cy={456} rx={32} ry={50} fill={C.skin} {...stroke} />
        <Path d="M848 428 C866 440 866 470 850 484" stroke={C.skinShade} strokeWidth={4} fill="none" strokeLinecap="round" />

        {/* Face */}
        <Path
          d="M405 430 C400 310 480 255 600 252 C725 250 805 305 808 425 C812 540 735 618 605 622 C478 624 408 545 405 430 Z"
          fill={`url(#${uid}-face)`}
          {...stroke}
        />

        {/* Blush */}
        <Ellipse cx={458} cy={552} rx={38} ry={18} fill={C.blush} opacity={0.42} />
        <Ellipse cx={722} cy={540} rx={34} ry={16} fill={C.blush} opacity={0.42} />

        {/* Brows */}
        <Path d="M425 392 Q458 368 494 378" stroke={C.brow} strokeWidth={7} fill="none" strokeLinecap="round" />
        <Path d="M628 362 Q664 344 702 360" stroke={C.brow} strokeWidth={7} fill="none" strokeLinecap="round" />

        <Eye uid={uid} cx={465} cy={472} flick="left" closed={blinking} />
        <Eye uid={uid} cx={668} cy={462} flick="right" closed={blinking} />

        {/* Nose */}
        <Path d="M555 512 Q563 522 574 514" stroke="#8a3d1c" strokeWidth={4} fill="none" strokeLinecap="round" />

        <Mouth open={mouth} />

        {/* Front hair: crown + parted bangs + face-framing locks */}
        <Path
          d="M325 335 C335 200 458 112 600 110 C742 110 866 190 884 335 C846 272 778 232 708 214 C656 200 622 176 592 150 C560 180 520 205 470 226 C410 252 360 288 325 335 Z"
          fill={`url(#${uid}-hair)`}
          {...stroke}
        />
        <Path d="M590 150 C545 210 495 280 455 360 C446 380 440 396 432 412 C420 330 442 250 500 190 C530 160 560 146 590 150 Z" fill={C.hair} {...stroke} />
        <Path d="M590 150 C642 176 702 222 746 282 C772 318 790 362 800 412 C816 362 816 290 780 230 C740 165 662 134 590 150 Z" fill={C.hair} {...stroke} />
        <Path d="M432 300 C410 380 404 460 410 540 C412 590 420 622 442 652 C400 642 372 600 362 540 C350 450 370 362 432 300 Z" fill={C.hair} {...stroke} />
        <Path d="M792 300 C816 370 822 440 814 510 C810 546 800 572 790 592 C832 572 852 522 852 452 C852 390 832 330 792 300 Z" fill={C.hair} {...stroke} />
        {/* Hair shine */}
        <Path d="M470 200 C515 162 560 146 592 140 M640 146 C710 160 780 205 826 262" stroke={C.hairHi} strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.7} />
        <Path d="M512 214 C490 250 474 290 462 330 M690 222 C720 252 744 290 758 330" stroke={C.hairHi} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.45} />

        {/* Earrings (over the hair, like the reference) */}
        <Rect x={808} y={400} width={36} height={96} rx={16} fill={`url(#${uid}-gold)`} {...stroke} strokeWidth={4} />
        <Rect x={816} y={410} width={8} height={70} rx={4} fill={C.goldHi} opacity={0.9} />
        <G transform="rotate(-8 372 535)">
          <Rect x={355} y={494} width={34} height={82} rx={15} fill={`url(#${uid}-gold)`} {...stroke} strokeWidth={4} />
          <Rect x={362} y={504} width={7} height={58} rx={3} fill={C.goldHi} opacity={0.9} />
        </G>
      </G>

      {/* Right arm — drawn after the head so a raised (waving) arm sits in front of the hair */}
      <G transform={`rotate(${armAngle} 706 668)`}>
        <Path d="M708 662 C742 684 756 740 765 800 C769 830 776 852 782 870 L740 876 C736 840 728 800 716 765 L700 700 Z" fill={C.skin} {...stroke} />
        <Ellipse cx={772} cy={896} rx={31} ry={30} fill={C.skin} {...stroke} />
        <Path d="M760 912 L759 923 M774 914 L775 925 M788 909 L791 919" stroke={C.outline} strokeWidth={3} strokeLinecap="round" />
        <G transform="rotate(-12 770 846)">
          <Rect x={738} y={830} width={64} height={30} rx={11} fill={`url(#${uid}-gold)`} {...stroke} strokeWidth={4} />
          <Rect x={746} y={836} width={48} height={6} rx={3} fill={C.goldHi} opacity={0.8} />
        </G>
      </G>
    </>
  );
});

function Eye({ uid, cx, cy, flick, closed }: { uid: string; cx: number; cy: number; flick: "left" | "right"; closed: boolean }) {
  const dir = flick === "left" ? -1 : 1;
  if (closed) {
    // Happy closed-eye arc with the lash flick kept.
    return (
      <G>
        <Path d={`M${cx - 48} ${cy + 2} Q${cx} ${cy + 26} ${cx + 48} ${cy + 2}`} stroke={C.pupil} strokeWidth={8} fill="none" strokeLinecap="round" />
        <Path d={`M${cx + dir * 46} ${cy + 4} L${cx + dir * 64} ${cy - 6}`} stroke={C.pupil} strokeWidth={6} strokeLinecap="round" />
      </G>
    );
  }
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx={46} ry={50} fill="#fff" />
      <Ellipse cx={cx + 4} cy={cy + 6} rx={37} ry={43} fill={`url(#${uid}-iris)`} />
      <Ellipse cx={cx + 4} cy={cy + 8} rx={19} ry={23} fill={C.pupil} />
      <Circle cx={cx + 19} cy={cy - 13} r={12} fill="#fff" />
      <Circle cx={cx - 11} cy={cy + 22} r={6} fill="#fff" opacity={0.95} />
      {/* Upper lash line + outer flick */}
      <Path d={`M${cx - 52} ${cy - 6} C${cx - 40} ${cy - 60} ${cx + 38} ${cy - 62} ${cx + 52} ${cy - 16}`} stroke={C.pupil} strokeWidth={10} fill="none" strokeLinecap="round" />
      <Path d={`M${cx + dir * 50} ${cy - (dir > 0 ? 20 : 10)} L${cx + dir * 68} ${cy - (dir > 0 ? 34 : 26)}`} stroke={C.pupil} strokeWidth={6} strokeLinecap="round" />
      <Path d={`M${cx - 30} ${cy + 46} Q${cx} ${cy + 56} ${cx + 30} ${cy + 46}`} stroke="#3b2416" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
    </G>
  );
}

/** Smile when closed; opens into a rounded "speaking" mouth with teeth + tongue. */
function Mouth({ open }: { open: number }) {
  if (open < 0.08) {
    return <Path d="M556 548 Q588 576 622 544" stroke={C.lip} strokeWidth={5} fill="none" strokeLinecap="round" />;
  }
  const o = open;
  const top = 550 - o * 3;
  const bottom = 556 + o * 44;
  const left = 560 - o * 4;
  const right = 618 + o * 4;
  const d = `M${left} ${top + 2} Q589 ${top - 6} ${right} ${top} Q${right - 4} ${bottom} 589 ${bottom} Q${left + 4} ${bottom} ${left} ${top + 2} Z`;
  return (
    <G>
      <Path d={d} fill={C.mouthIn} />
      {o > 0.3 ? <Ellipse cx={589} cy={bottom - 9 * o} rx={11 + 9 * o} ry={6 + 6 * o} fill={C.tongue} /> : null}
      {o > 0.35 ? <Path d={`M${left + 8} ${top + 3} Q589 ${top - 2} ${right - 8} ${top + 1} L${right - 10} ${top + 7} Q589 ${top + 10} ${left + 10} ${top + 9} Z`} fill="#fff" /> : null}
      <Path d={d} stroke={C.lip} strokeWidth={4} fill="none" strokeLinejoin="round" />
    </G>
  );
}
