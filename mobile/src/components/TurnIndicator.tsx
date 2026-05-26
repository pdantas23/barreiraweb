import { Text, View, StyleSheet } from "react-native";
import type { PlayerId } from "@barreira/shared";
import { theme } from "../theme";

type Props = {
  turn: PlayerId;
  winner: PlayerId | null;
  // Quem é "você" — default 1 (modo CPU local sempre é P1). No online,
  // se o jogador foi escalado como engine player 2, passa 2.
  myPlayer?: PlayerId;
};

export const TurnIndicator = ({ turn, winner, myPlayer = 1 }: Props) => {
  const myColor = myPlayer === 1 ? theme.player1 : theme.player2;
  const opponentColor = myPlayer === 1 ? theme.player2 : theme.player1;

  if (winner !== null) {
    const youWon = winner === myPlayer;
    return (
      <View style={styles.row}>
        <Text style={[styles.text, { color: youWon ? myColor : opponentColor }]}>
          {youWon ? "Você venceu!" : "Adversário venceu"}
        </Text>
      </View>
    );
  }
  const myTurn = turn === myPlayer;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: myTurn ? myColor : opponentColor }]} />
      <Text style={styles.text}>{myTurn ? "Sua vez" : "Vez do adversário"}</Text>
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
