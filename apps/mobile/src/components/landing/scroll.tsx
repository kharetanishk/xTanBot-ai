import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useWindowDimensions, type LayoutChangeEvent } from "react-native";
import {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Scroll-driven animation primitives (the ScrollTrigger idea, built on reanimated so
 * it runs on the UI thread on iOS/Android and on web alike).
 *
 * The page owns one `scrollY` shared value; sections measure their own top (`y`) via
 * onLayout and derive progress, parallax, pinning and in-view triggers from it.
 */
type ScrollCtx = {
  scrollY: SharedValue<number>;
  vh: number;
  vw: number;
  /** Top offset of each section (index = order on the page). */
  offsets: SharedValue<number[]>;
  report: (index: number, height: number) => void;
};

const Ctx = createContext<ScrollCtx | null>(null);

export function ScrollProvider({ scrollY, children }: { scrollY: SharedValue<number>; children: ReactNode }) {
  const { height, width } = useWindowDimensions();
  const heights = useRef<number[]>([]);
  const offsets = useSharedValue<number[]>([]);
  // A section's top = sum of the heights above it. (On web, onLayout only fires on *size*
  // changes, so a section's own y goes stale when content above it grows; heights don't.)
  const report = useCallback(
    (index: number, h: number) => {
      if (heights.current[index] === h) return;
      heights.current[index] = h;
      const next: number[] = [];
      let acc = 0;
      for (let i = 0; i < heights.current.length; i++) {
        next[i] = acc;
        const hi = heights.current[i];
        if (hi === undefined) {
          acc = NaN; // unknown above → positions below are unknown too
        } else {
          acc += hi;
        }
      }
      offsets.value = next;
    },
    [offsets],
  );
  return <Ctx.Provider value={{ scrollY, vh: height, vw: width, offsets, report }}>{children}</Ctx.Provider>;
}

export function useScroll(): ScrollCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScroll must be used inside <ScrollProvider>");
  return v;
}

/**
 * Register a page section by its order `index` (sections must be stacked direct children of
 * the scroll content with no margins between them). Returns its live top `y` and height `h`.
 */
export function useSection(index: number) {
  const { offsets, report } = useScroll();
  const h = useSharedValue(1);
  // Far below the fold until measured, so nothing "triggers" on the first frame.
  const y = useDerivedValue(() => {
    const v = offsets.value[index];
    return v === undefined || Number.isNaN(v) ? 1e9 : v;
  });
  const onLayout = (e: LayoutChangeEvent) => {
    const height = Math.max(1, e.nativeEvent.layout.height);
    h.value = height;
    report(index, height);
  };
  return { y, h, onLayout };
}

/**
 * 0 → 1 as the section travels through the viewport.
 * start/end are viewport fractions: 1 = section top at the bottom edge, 0 = at the top edge.
 */
export function progressFor(scrollY: number, y: number, vh: number, start = 1, end = 0, span?: number) {
  "worklet";
  const from = y - vh * start;
  const to = span !== undefined ? from + span : y - vh * end;
  return interpolate(scrollY, [from, to], [0, 1], Extrapolation.CLAMP);
}

/** Becomes true once the section's top passes `at` of the viewport (default 80%); stays true. */
export function useInView(y: SharedValue<number>, at = 0.8): boolean {
  const { scrollY, vh } = useScroll();
  const [seen, setSeen] = useState(false);
  useAnimatedReaction(
    () => scrollY.value + vh * at > y.value + 1,
    (now, prev) => {
      if (now && !prev) runOnJS(setSeen)(true);
    },
    [vh, at],
  );
  return seen;
}
