import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { gc } from "../gameColors";

type Props = {
  visible: boolean;
  position: "top" | "bottom";
};

export const BlockedPathToast = ({ visible, position }: Props) => {
  const opacity = useSharedValue(0);
  const slideOffset = useSharedValue(position === "top" ? -10 : 10);

  useEffect(() => {
    if (visible) {
      slideOffset.value = position === "top" ? -10 : 10;
      opacity.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.ease) });
      slideOffset.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.ease) });
    } else {
      opacity.value = withTiming(0, { duration: 120, easing: Easing.in(Easing.ease) });
    }
  }, [visible, position, opacity, slideOffset]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: slideOffset.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        position === "top" ? styles.posTop : styles.posBottom,
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <View style={styles.card}>
        <LinearGradient
          colors={[gc.red, gc.redLight]}
          style={styles.accentBorder}
        />
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>⚠</Text>
          </View>
          <View style={styles.textColumn}>
            <Text style={styles.title}>Caminho bloqueado</Text>
            <Text style={styles.subtitle}>Esta parede isola um jogador</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 8,
    right: 8,
    zIndex: 50,
  },
  posTop: {
    top: 8,
  },
  posBottom: {
    bottom: 8,
  },
  card: {
    backgroundColor: gc.white,
    borderRadius: 12,
    height: 48,
    overflow: "hidden",
    shadowColor: gc.red,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  accentBorder: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 14,
    gap: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: `${gc.red}1a`,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 13,
    color: gc.red,
  },
  textColumn: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A2A4A",
  },
  subtitle: {
    fontSize: 10,
    color: gc.labelColor,
  },
});
