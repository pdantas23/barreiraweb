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

  // Paredes colocadas viram um elemento descritível ("Parede horizontal do
  // jogador azul"); o ghost (preview de arraste) fica fora do leitor de tela.
  const a11y = ghost
    ? { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const }
    : {
        accessible: true,
        accessibilityRole: "image" as const,
        accessibilityLabel: `Parede ${type === "h" ? "horizontal" : "vertical"} do jogador ${
          placement.owner === 1 ? "azul" : "vermelho"
        }`,
      };

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
        {...a11y}
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
      {...a11y}
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
