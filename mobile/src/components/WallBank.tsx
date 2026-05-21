import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  measure,
  runOnJS,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { BOARD_SIZE, type WallType } from "@barreira/shared";
import { theme } from "../theme";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

type Props = {
  wallsLeft: number;
  disabled?: boolean;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  lastInter: SharedValue<string>;
  boardRef: AnimatedRef<Animated.View>;
  layout: BoardLayout;
  onDragStart: (type: WallType) => void;
  onIntersectionChange: (ir: number, ic: number, type: WallType) => void;
  onIntersectionLeave: () => void;
  onDragEnd: () => void;
};

export const WallBank = ({
  wallsLeft,
  disabled,
  dragX,
  dragY,
  lastInter,
  boardRef,
  layout,
  onDragStart,
  onIntersectionChange,
  onIntersectionLeave,
  onDragEnd,
}: Props) => {
  const dim = !!disabled || wallsLeft <= 0;

  // Calcula o tamanho real da peça usando as métricas do tabuleiro
  const { squareSize, gap, padding, wallThickness } = layout;
  const cellSize = squareSize + gap;
  const wallLength = squareSize * 2 + gap;
  const thick = wallThickness;

  const makePan = (type: WallType) =>
    Gesture.Pan()
      .enabled(!dim)
      // Reconhece o toque imediatamente, sem precisar arrastar o dedo antes
      .minDistance(0)
      .onStart((e) => {
        dragX.value = e.absoluteX;
        dragY.value = e.absoluteY;
        lastInter.value = "__none__";
        runOnJS(onDragStart)(type);
      })
      .onUpdate((e) => {
        dragX.value = e.absoluteX;
        dragY.value = e.absoluteY;

        const m = measure(boardRef);
        if (!m) return;

        const localX = e.absoluteX - m.pageX - padding;
        const localY = e.absoluteY - m.pageY - padding;

        const outside =
          localX < -cellSize ||
          localY < -cellSize ||
          localX > BOARD_SIZE * cellSize ||
          localY > BOARD_SIZE * cellSize;

        let key: string;
        let ir = 0;
        let ic = 0;
        if (outside) {
          key = "OUT";
        } else {
          ic = Math.max(
            0,
            Math.min(BOARD_SIZE - 2, Math.round((localX + gap / 2) / cellSize) - 1),
          );
          ir = Math.max(
            0,
            Math.min(BOARD_SIZE - 2, Math.round((localY + gap / 2) / cellSize) - 1),
          );
          key = `${ir}-${ic}`;
        }

        if (key !== lastInter.value) {
          lastInter.value = key;
          if (outside) runOnJS(onIntersectionLeave)();
          else runOnJS(onIntersectionChange)(ir, ic, type);
        }
      })
      .onEnd(() => runOnJS(onDragEnd)())
      .onFinalize(() => runOnJS(onDragEnd)());

  const panH = makePan("h");
  const panV = makePan("v");

  return (
    <View style={styles.row}>
      <View style={styles.counter}>
        <Text style={styles.counterText}>{wallsLeft}</Text>
        <Text style={styles.counterLabel}>paredes</Text>
      </View>
      
      <GestureDetector gesture={panH}>
        {/* Hitbox: Uma área transparente gigante para os dedos */}
        <View collapsable={false} style={styles.hitbox}>
          <View style={[styles.gen, { width: wallLength, height: thick }, dim && styles.dim]} />
        </View>
      </GestureDetector>

      <GestureDetector gesture={panV}>
        {/* Hitbox: Uma área transparente gigante para os dedos */}
        <View collapsable={false} style={styles.hitbox}>
          <View style={[styles.gen, { width: thick, height: wallLength }, dim && styles.dim]} />
        </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 16, // DIMINUÍDO (era 32)
    alignItems: "center",
    paddingVertical: 10, // DIMINUÍDO (era 18)
    paddingHorizontal: 16, // DIMINUÍDO (era 24)
    backgroundColor: theme.boardBg,
    borderRadius: 12, // Um pouco menos redondo para combinar com a caixa menor
    borderColor: "#333",
    borderWidth: 1,
  },
  counter: { 
    alignItems: "center", 
    marginRight: 4 // DIMINUÍDO
  },
  counterText: { 
    color: theme.textPrimary, 
    fontSize: 18, // DIMINUÍDO (era 22)
    fontWeight: "700" 
  },
  counterLabel: { 
    color: theme.textMuted, 
    fontSize: 10 // DIMINUÍDO
  },
  hitbox: {
    padding: 14, // Diminuído um pouquinho pra não empurrar a caixa pra fora
    justifyContent: "center",
    alignItems: "center",
  },
  gen: { 
    backgroundColor: theme.player1, 
    borderRadius: 4 
  },
  dim: { 
    opacity: 0.35 
  },
});