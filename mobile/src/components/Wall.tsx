import { View } from "react-native";
import type { WallPlacement } from "@barreira/shared";
import { gc } from "../gameColors";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

type Props = {
  placement: WallPlacement;
  layout: BoardLayout;
  ghost?: boolean;
  ghostInvalid?: boolean;
};

const colorFor = (placement: WallPlacement) =>
  placement.owner === 2 ? gc.red : gc.blue;

export const Wall = ({ placement, layout, ghost = false, ghostInvalid = false }: Props) => {
  const { interRow: ir, interCol: ic, type } = placement;
  const { squareSize, gap, padding, wallThickness } = layout;
  const cellSize = squareSize + gap;
  const baseColor = ghost
    ? ghostInvalid
      ? gc.red
      : gc.blue
    : colorFor(placement);

  const common = {
    position: "absolute" as const,
    backgroundColor: baseColor,
    opacity: ghost ? (ghostInvalid ? 0.7 : 0.6) : 1,
    borderRadius: 3,
    zIndex: 10,
    shadowColor: gc.boardShadow,
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  };

  if (type === "h") {
    return (
      <View
        pointerEvents="none"
        style={{
          ...common,
          left: padding + ic * cellSize,
          top: padding + (ir + 1) * cellSize - gap / 2 - wallThickness / 2,
          width: squareSize * 2 + gap,
          height: wallThickness,
        }}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={{
        ...common,
        left: padding + (ic + 1) * cellSize - gap / 2 - wallThickness / 2,
        top: padding + ir * cellSize,
        width: wallThickness,
        height: squareSize * 2 + gap,
      }}
    />
  );
};
