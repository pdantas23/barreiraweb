import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  measure,
  runOnJS,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { BOARD_SIZE, WALLS_PER_PLAYER, type WallType } from "@barreira/shared";
import { gc } from "../gameColors";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

type Props = {
  wallsLeft: number;
  disabled?: boolean;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  lastInter: SharedValue<string>;
  boardRef: AnimatedRef<Animated.View>;
  layout: BoardLayout;
  flipped?: boolean;
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
  flipped,
  onDragStart,
  onIntersectionChange,
  onIntersectionLeave,
  onDragEnd,
}: Props) => {
  const dim = !!disabled || wallsLeft <= 0;

  const { squareSize, gap, padding, wallThickness } = layout;
  const cellSize = squareSize + gap;

  const makePan = (type: WallType) =>
    Gesture.Pan()
      .enabled(!dim)
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

        const innerSize = BOARD_SIZE * cellSize;
        const adjX = flipped ? innerSize - localX : localX;
        const adjY = flipped ? innerSize - localY : localY;

        let key: string;
        let ir = 0;
        let ic = 0;
        if (outside) {
          key = "OUT";
        } else {
          ic = Math.max(
            0,
            Math.min(BOARD_SIZE - 2, Math.round((adjX + gap / 2) / cellSize) - 1),
          );
          ir = Math.max(
            0,
            Math.min(BOARD_SIZE - 2, Math.round((adjY + gap / 2) / cellSize) - 1),
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

  // Match exact board wall dimensions
  const wallLen = squareSize * 2 + gap;
  const wallThick = wallThickness;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>SUAS PAREDES</Text>

      <View style={styles.bankRow}>
        {/* Counter card */}
        <View style={styles.counterCard}>
          <Text style={styles.counterNumber}>{wallsLeft}</Text>
        </View>

        {/* Two template pieces: H and V — always visible, always reusable */}
        <View style={styles.templatesColumn}>
          <GestureDetector gesture={panH}>
            <View collapsable={false} style={styles.templateHitbox}>
              <View
                style={[
                  { width: wallLen, height: wallThick, borderRadius: 3, backgroundColor: gc.wallActive },
                  dim && styles.dimPiece,
                ]}
              />
              <Text style={styles.templateLabel}>H</Text>
            </View>
          </GestureDetector>

          <GestureDetector gesture={panV}>
            <View collapsable={false} style={styles.templateHitbox}>
              <View
                style={[
                  { width: wallThick, height: wallLen, borderRadius: 3, backgroundColor: gc.wallActive },
                  dim && styles.dimPiece,
                ]}
              />
              <Text style={styles.templateLabel}>V</Text>
            </View>
          </GestureDetector>
        </View>
      </View>
    </View>
  );
};

// Opponent HUD — read-only pills
type OpponentWallBankProps = {
  wallsLeft: number;
};

export const OpponentWallBank = ({ wallsLeft }: OpponentWallBankProps) => {
  return (
    <View style={styles.opponentContainer}>
      <Text style={styles.opponentLabel}>PAREDES OPONENTE</Text>
      <View style={styles.opponentPills}>
        {Array.from({ length: WALLS_PER_PLAYER }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.opponentPill,
              {
                backgroundColor:
                  i < wallsLeft
                    ? `${gc.red}d9`
                    : `${gc.red}1a`,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "90%",
    backgroundColor: gc.hudBg,
    borderTopWidth: 1,
    borderTopColor: gc.hudDivider,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: gc.labelColor,
    letterSpacing: 2,
  },
  bankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  counterCard: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: `${gc.blue}66`,
    backgroundColor: gc.cell,
    alignItems: "center",
    justifyContent: "center",
  },
  counterNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: gc.blue,
  },
  templatesColumn: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  templateHitbox: {
    padding: 6,
    alignItems: "center",
    gap: 3,
  },
  dimPiece: {
    opacity: 0.1,
  },
  templateLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: gc.labelColor,
    letterSpacing: 1,
  },
  // Opponent
  opponentContainer: {
    width: "90%",
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: gc.hudBg,
    borderWidth: 1,
    borderColor: gc.hudDivider,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  opponentLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: gc.labelColor,
    letterSpacing: 1.5,
  },
  opponentPills: {
    flexDirection: "row",
    gap: 3,
  },
  opponentPill: {
    width: 14,
    height: 5,
    borderRadius: 3,
  },
});
