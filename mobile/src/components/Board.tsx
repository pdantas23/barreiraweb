import { ReactElement } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { type AnimatedRef } from "react-native-reanimated";
import {
  BOARD_SIZE,
  TOTAL_SQUARES,
  col,
  row,
  type GameState,
  type WallPlacement,
} from "@barreira/shared";
import { Piece } from "./Piece";
import { Square } from "./Square";
import { Wall } from "./Wall";
import { useResponsiveBoard, type BoardLayout } from "../hooks/useResponsiveBoard";
import { theme } from "../theme";

type Props = {
  state: GameState;
  validMoves: Set<number>;
  ghost: WallPlacement | null;
  onSquareTap: (index: number) => void;
  // Ref criada com useAnimatedRef no parent. Usada pelo WallBank pra chamar
  // measure() dentro do worklet do gesture — coords sempre síncronas com
  // e.absoluteY, sem mismatch.
  boardRef: AnimatedRef<Animated.View>;
};

export const Board = ({
  state,
  validMoves,
  ghost,
  onSquareTap,
  boardRef,
}: Props) => {
  const layout: BoardLayout = useResponsiveBoard();

  const squares: ReactElement[] = [];
  for (let i = 0; i < TOTAL_SQUARES; i++) {
    const r = row(i);
    const c = col(i);
    const isAlt = (r + c) % 2 === 1;
    const isValidMove = validMoves.has(i);

    const piece =
      i === state.p1 ? (
        <Piece player={1} size={layout.squareSize} />
      ) : i === state.p2 ? (
        <Piece player={2} size={layout.squareSize} />
      ) : null;

    squares.push(
      <Square
        key={i}
        index={i}
        size={layout.squareSize}
        isAlt={isAlt}
        isHighlighted={isValidMove}
        onPress={isValidMove ? onSquareTap : undefined}
      >
        {piece}
      </Square>,
    );
  }

  return (
    <Animated.View
      ref={boardRef}
      style={[
        styles.board,
        {
          width: layout.boardSize,
          height: layout.boardSize,
          padding: layout.padding,
        },
      ]}
    >
      <View style={[styles.grid, { gap: layout.gap }]}>
        {Array.from({ length: BOARD_SIZE }).map((_, r) => (
          <View key={r} style={[styles.row, { gap: layout.gap }]}>
            {squares.slice(r * BOARD_SIZE, (r + 1) * BOARD_SIZE)}
          </View>
        ))}
      </View>
      {state.walls.placements.map((p) => (
        <Wall
          key={`${p.type}-${p.interRow}-${p.interCol}`}
          placement={p}
          layout={layout}
        />
      ))}
      {ghost && <Wall placement={ghost} layout={layout} ghost />}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  board: {
    backgroundColor: theme.boardBg,
    position: "relative",
  },
  grid: { flex: 1 },
  row: { flexDirection: "row", flex: 1 },
});
