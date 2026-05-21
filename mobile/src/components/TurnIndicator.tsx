import { Text, View, StyleSheet } from "react-native";
import type { PlayerId } from "../game/types";
import { theme } from "../theme";

type Props = {
  turn: PlayerId;
  winner: PlayerId | null;
};

export const TurnIndicator = ({ turn, winner }: Props) => {
  if (winner !== null) {
    const text = winner === 1 ? "Você venceu!" : "Adversário venceu";
    const color = winner === 1 ? theme.player1 : theme.player2;
    return (
      <View style={styles.row}>
        <Text style={[styles.text, { color }]}>{text}</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.dot,
          { backgroundColor: turn === 1 ? theme.player1 : theme.player2 },
        ]}
      />
      <Text style={styles.text}>{turn === 1 ? "Sua vez" : "Vez do adversário"}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  text: { color: theme.textPrimary, fontSize: 16, fontWeight: "600" },
});
