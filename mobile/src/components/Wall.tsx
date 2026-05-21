import { View } from "react-native";
import type { WallPlacement } from "../game/types";
import { theme } from "../theme";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

type Props = {
  placement: WallPlacement;
  layout: BoardLayout;
  ghost?: boolean;
};

// Cor: mesma da peça do dono. P1 (humano) → ciano, P2 (adversário) → vermelho.
const colorFor = (placement: WallPlacement) =>
  placement.owner === 2 ? theme.player2 : theme.player1;

export const Wall = ({ placement, layout, ghost = false }: Props) => {
  const { interRow: ir, interCol: ic, type } = placement;
  const { squareSize, gap, padding, wallThickness } = layout;
  const cellSize = squareSize + gap;
  const baseColor = colorFor(placement);

  const common = {
    position: "absolute" as const,
    backgroundColor: baseColor,
    opacity: ghost ? 0.45 : 1,
    borderRadius: 3,
    zIndex: 10,
    // Sombrinha sutil pra parede parecer "em cima" do tabuleiro
    shadowColor: "#000",
    shadowOpacity: 0.4,
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
