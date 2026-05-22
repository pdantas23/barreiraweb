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

export const SplashOverlay = () => {
  const opacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.ease) }),
      withDelay(
        HOLD_MS,
        withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.ease) }, () => {
          runOnJS(setDone)(true);
        }),
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  if (done) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={[styles.logoWrap, animStyle]}>
        <Image
          source={require("../../assets/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
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
