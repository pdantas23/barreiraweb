import { View, StyleSheet } from "react-native";
import { theme } from "../theme";

type Props = {
  player: 1 | 2;
  size: number;
};

export const Piece = ({ player, size }: Props) => {
  const color = player === 1 ? theme.player1 : theme.player2;
  const d = size * 0.72;
  return (
    <View
      style={[
        styles.piece,
        { width: d, height: d, borderRadius: d / 2, backgroundColor: color },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  piece: {
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});
