import { ReactElement } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { type AnimatedRef } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  BOARD_SIZE,
  TOTAL_SQUARES,
  col,
  row,
  type GameState,
  type WallPlacement,
} from "@barreira/shared";
import { BlockedPathToast } from "./BlockedPathToast";
import { Piece } from "./Piece";
import { Square } from "./Square";
import { Wall } from "./Wall";
import { useResponsiveBoard, type BoardLayout } from "../hooks/useResponsiveBoard";
import { gc } from "../gameColors";

type Props = {
  state: GameState;
  validMoves: Set<number>;
  ghost: WallPlacement | null;
  ghostInvalid?: boolean;
  showBlockedToast?: boolean;
  onSquareTap: (index: number) => void;
  boardRef: AnimatedRef<Animated.View>;
};

export const Board = ({
  state,
  validMoves,
  ghost,
  ghostInvalid = false,
  showBlockedToast = false,
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

  const goalHeight = 10;

  return (
    <View style={styles.cardWrapper}>
      <LinearGradient
        colors={[gc.boardBg, gc.boardBgEnd]}
        style={[
          styles.card,
          {
            width: layout.boardSize + 12,
            height: layout.boardSize + 12,
            borderRadius: gc.boardRadius,
          },
        ]}
      >
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
          {/* Goal zone — opponent (top row) */}
          <LinearGradient
            colors={[`${gc.goalOpponent[0]}33`, `${gc.goalOpponent[1]}33`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.goalZone,
              {
                top: layout.padding,
                left: layout.padding,
                right: layout.padding,
                height: goalHeight,
                borderTopLeftRadius: gc.cellRadius,
                borderTopRightRadius: gc.cellRadius,
              },
            ]}
          />

          {/* Goal zone — player (bottom row) */}
          <LinearGradient
            colors={[`${gc.goalPlayer[0]}33`, `${gc.goalPlayer[1]}33`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.goalZone,
              {
                bottom: layout.padding,
                left: layout.padding,
                right: layout.padding,
                height: goalHeight,
                borderBottomLeftRadius: gc.cellRadius,
                borderBottomRightRadius: gc.cellRadius,
              },
            ]}
          />

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
          {ghost && <Wall placement={ghost} layout={layout} ghost ghostInvalid={ghostInvalid} />}

          <BlockedPathToast
            visible={showBlockedToast}
            position={ghost && ghost.interRow < 4 ? "bottom" : "top"}
          />
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    shadowColor: gc.boardShadow,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  card: {
    alignItems: "center",
    justifyContent: "center",
  },
  board: {
    position: "relative",
  },
  grid: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    flex: 1,
  },
  goalZone: {
    position: "absolute",
    zIndex: 5,
    pointerEvents: "none",
  },
});
