import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

export default function TypingIndicator() {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      );
    const anims = [
      bounce(a, 0),
      bounce(b, 150),
      bounce(c, 300),
    ];
    anims.forEach((anim) => anim.start());
    return () => anims.forEach((anim) => anim.stop());
  }, [a, b, c]);

  const translateA = a.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const translateB = b.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const translateC = c.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <View style={styles.wrap}>
      <View style={styles.bubble}>
        <View style={styles.dots}>
          <Animated.Text style={[styles.dot, { transform: [{ translateY: translateA }] }]}>.</Animated.Text>
          <Animated.Text style={[styles.dot, { transform: [{ translateY: translateB }] }]}>.</Animated.Text>
          <Animated.Text style={[styles.dot, { transform: [{ translateY: translateC }] }]}>.</Animated.Text>
        </View>
        <Text style={styles.label}>xTanBot is thinking...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 12,
  },
  bubble: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#000",
    borderRadius: 0,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowOffset: { width: 3, height: 3 },
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  dots: {
    flexDirection: "row",
    gap: 2,
  },
  dot: {
    fontSize: 18,
    fontWeight: "900",
    color: "#000",
  },
  label: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },
});
