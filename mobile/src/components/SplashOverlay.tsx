import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const FADE_IN_MS = 800;
const HOLD_MS = 1200;
const FADE_OUT_MS = 600;

type Props = { onFinish: () => void };

export const SplashOverlay = ({ onFinish }: Props) => {
  const opacity = useSharedValue(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    opacity.value = withSequence(
      // fade in
      withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.ease) }),
      // hold
      withDelay(
        HOLD_MS,
        // fade out
        withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.ease) }, () => {
          runOnJS(setDone)(true);
        }),
      ),
    );
  }, []);

  useEffect(() => {
    if (done) onFinish();
  }, [done]);

  if (done) return null;

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrap, animStyle]}>
        <Image
          source={require("../../assets/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 180,
    height: 180,
    borderRadius: 36,
  },
});
