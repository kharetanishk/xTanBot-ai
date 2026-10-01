import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../../theme";

/** Reveal `text` character by character. Restarts when the text changes; can pause. */
export function useTypewriter(text: string, msPerChar = 32, startDelay = 0, paused = false) {
  const [count, setCount] = useState(0);
  // Array.from splits by code point, so emoji like 💛 appear whole instead of as "�".
  const chars = useMemo(() => Array.from(text), [text]);
  const [ready, setReady] = useState(startDelay === 0);

  useEffect(() => {
    setCount(0);
    if (startDelay === 0) return setReady(true);
    setReady(false);
    const t = setTimeout(() => setReady(true), startDelay);
    return () => clearTimeout(t);
  }, [text, startDelay]);

  useEffect(() => {
    if (!ready || paused) return;
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= chars.length) {
          clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, msPerChar);
    return () => clearInterval(id);
  }, [chars, msPerChar, ready, paused]);

  return { shown: chars.slice(0, count).join(""), done: count >= chars.length };
}

/** Comic-style bubble with a tail pointing at the character. */
export function SpeechBubble({
  text,
  fullText,
  typing,
  small,
  tail = "left",
  dark,
  style,
}: {
  text: string;
  /** The finished line: reserves the bubble's final size so typing never shifts the layout. */
  fullText?: string;
  typing?: boolean;
  /** Compact text for very narrow screens. */
  small?: boolean;
  tail?: "left" | "bottom" | "none";
  /** Dark bubble for light/amber backgrounds. */
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = dark ? "#0a0a0a" : colors.text;
  return (
    <View style={[s.bubble, { backgroundColor: bg }, style]}>
      {fullText ? (
        <View>
          <Text style={[s.text, small && s.small, s.ghost]} aria-hidden>
            {fullText}
          </Text>
          <Text style={[s.text, small && s.small, s.overlay, dark && { color: colors.text }]}>
            {text}
            {typing ? <Text style={s.caret}>▍</Text> : null}
          </Text>
        </View>
      ) : (
        <Text style={[s.text, small && s.small, dark && { color: colors.text }]}>
          {text}
          {typing ? <Text style={s.caret}>▍</Text> : null}
        </Text>
      )}
      {tail === "left" ? <View style={[s.tail, s.tailLeft, { backgroundColor: bg }]} /> : null}
      {tail === "bottom" ? <View style={[s.tail, s.tailBottom, { backgroundColor: bg }]} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  bubble: {
    backgroundColor: colors.text,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  text: { color: "#111827", fontSize: 17, lineHeight: 24, fontWeight: "600" },
  caret: { color: colors.accent },
  small: { fontSize: 14, lineHeight: 19 },
  ghost: { opacity: 0 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0 },
  tail: { position: "absolute", width: 18, height: 18, backgroundColor: colors.text, transform: [{ rotate: "45deg" }] },
  tailLeft: { left: -7, top: 22 },
  tailBottom: { bottom: -7, left: 40 },
});
