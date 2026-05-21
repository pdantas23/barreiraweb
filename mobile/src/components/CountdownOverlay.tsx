import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { gc } from "../gameColors";

const COUNTDOWN_DURATION_MS = 3_000;

type Props = {
  startsAt: number; // Unix timestamp ms
  onComplete: () => void;
};

export const CountdownOverlay = ({ startsAt, onComplete }: Props) => {
  const [seconds, setSeconds] = useState(3);
  const [visible, setVisible] = useState(true);

  const onCompleteStable = useCallback(onComplete, [onComplete]);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startsAt;
      const remaining = Math.ceil((COUNTDOWN_DURATION_MS - elapsed) / 1000);
      if (remaining <= 0) {
        setVisible(false);
        onCompleteStable();
        return;
      }
      setSeconds(remaining);
    };

    tick();
    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [startsAt, onCompleteStable]);

  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(200)} style={styles.overlay}>
      <Animated.View key={seconds} entering={ZoomIn.duration(250)} style={styles.circle}>
        <Text style={styles.number}>{seconds}</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(240,244,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(61,111,255,0.08)",
    borderWidth: 3,
    borderColor: gc.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    color: gc.blue,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
