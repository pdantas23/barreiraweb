import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gc } from "../gameColors";

type Props = {
  player: 1 | 2;
  size: number;
};

export const Piece = ({ player, size }: Props) => {
  const colors = player === 1 ? gc.pawnPlayer : gc.pawnOpponent;
  const d = size * 0.72;
  const reflectD = d * 0.28;

  return (
    <View style={[styles.outer, { width: d, height: d, borderRadius: d / 2 }]}>
      <LinearGradient
        colors={[colors[0], colors[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.inner, { width: d - 4, height: d - 4, borderRadius: (d - 4) / 2 }]}
      />
      <View
        style={[
          styles.reflect,
          {
            width: reflectD,
            height: reflectD,
            borderRadius: reflectD / 2,
            top: d * 0.12,
            left: d * 0.15,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    backgroundColor: gc.pawnOuter,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  inner: {
    position: "absolute",
  },
  reflect: {
    position: "absolute",
    backgroundColor: gc.pawnReflect,
  },
});
