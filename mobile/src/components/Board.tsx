import { ReactElement, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedRef,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  BOARD_SIZE,
  TOTAL_SQUARES,
  col,
  row,
  type GameState,
  type PlayerId,
  type WallPlacement,
} from "@barreira/shared";
import { BlockedPathToast } from "./BlockedPathToast";
import { Piece } from "./Piece";
import { Square } from "./Square";
import { Wall } from "./Wall";
import { useResponsiveBoard, type BoardLayout } from "../hooks/useResponsiveBoard";
import { gc } from "../gameColors";

// Duração/curva da animação do peão — IGUAL à web (Board.tsx web usa
// `transition: left 200ms ease-out, top 200ms ease-out`). A bezier abaixo é a
// CSS `ease-out` (cubic-bezier(0, 0, 0.58, 1)).
const PAWN_ANIM_MS = 200;
const PAWN_EASING = Easing.bezier(0, 0, 0.58, 1);

// Peão como overlay absoluto ANIMADO (igual à web): em vez de re-renderizar o
// peão dentro da casa nova (teletransporte), ele desliza suavemente da posição
// anterior até a nova quando `index` muda. A caixa do peão (squareSize) coincide
// com a casa, então seu canto = padding + coluna/linha * cellSize.
const AnimatedPawn = ({
  player,
  index,
  layout,
}: {
  player: PlayerId;
  index: number;
  layout: BoardLayout;
}) => {
  const cellSize = layout.squareSize + layout.gap;
  const targetX = layout.padding + col(index) * cellSize;
  const targetY = layout.padding + row(index) * cellSize;

  const x = useSharedValue(targetX);
  const y = useSharedValue(targetY);

  // Anima ao mudar de casa (lance) ou ao recalcular o layout (resize). No
  // primeiro render o shared value já nasce na posição certa (sem glide).
  useEffect(() => {
    x.value = withTiming(targetX, { duration: PAWN_ANIM_MS, easing: PAWN_EASING });
    y.value = withTiming(targetY, { duration: PAWN_ANIM_MS, easing: PAWN_EASING });
  }, [targetX, targetY, x, y]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pawn, { width: layout.squareSize, height: layout.squareSize }, animStyle]}
    >
      <Piece player={player} size={layout.squareSize} />
    </Animated.View>
  );
};

type Props = {
  state: GameState;
  validMoves: Set<number>;
  ghost: WallPlacement | null;
  ghostInvalid?: boolean;
  showBlockedToast?: boolean;
  /** Board pai rotacionado 180° (P2/guest online). Passa pro toast contra-rotacionar. */
  flipped?: boolean;
  onSquareTap: (index: number) => void;
  boardRef: AnimatedRef<Animated.View>;
};

export const Board = ({
  state,
  validMoves,
  ghost,
  ghostInvalid = false,
  showBlockedToast = false,
  flipped = false,
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

    // Os peões NÃO ficam mais dentro da casa — são overlays animados (abaixo),
    // pra deslizar entre as casas em vez de teletransportar.
    squares.push(
      <Square
        key={i}
        index={i}
        size={layout.squareSize}
        isAlt={isAlt}
        isHighlighted={isValidMove}
        onPress={isValidMove ? onSquareTap : undefined}
      />,
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

          {/* Peões — overlays absolutos animados, acima das paredes (z-index 15,
              igual à web). Deslizam suavemente ao mudar de casa. */}
          <AnimatedPawn player={1} index={state.p1} layout={layout} />
          <AnimatedPawn player={2} index={state.p2} layout={layout} />

          <BlockedPathToast
            visible={showBlockedToast}
            position={ghost && ghost.interRow < 4 ? "bottom" : "top"}
            flipped={flipped}
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
  pawn: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
  },
});
