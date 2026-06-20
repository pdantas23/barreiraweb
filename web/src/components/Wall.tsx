import type { WallPlacement } from "@barreira/shared";
import { gc } from "../gameColors";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

type Props = {
  placement: WallPlacement;
  layout: BoardLayout;
  ghost?: boolean;
  ghostInvalid?: boolean;
  /** Skin custom (Replay Builder): substitui a cor padrão da parede do
   *  dono. Ghost preview não é afetado. */
  colorOverride?: string;
};

const colorFor = (placement: WallPlacement) =>
  placement.owner === 2 ? gc.red : gc.blue;

export const Wall = ({ placement, layout, ghost = false, ghostInvalid = false, colorOverride }: Props) => {
  const { interRow: ir, interCol: ic, type } = placement;
  const { squareSize, gap, padding, wallThickness } = layout;
  const cellSize = squareSize + gap;
  const baseColor = ghost
    ? ghostInvalid
      ? gc.red
      : gc.blue
    : colorOverride ?? colorFor(placement);

  const common: React.CSSProperties = {
    position: "absolute",
    backgroundColor: baseColor,
    opacity: ghost ? (ghostInvalid ? 0.7 : 0.6) : 1,
    borderRadius: 3,
    zIndex: 10,
    boxShadow: `0 1px 3px ${gc.boardShadow}40`,
    pointerEvents: "none",
    // Drop-in: pareces "caem" um pouco e dao um pequeno overshoot.
    // So pra paredes reais — ghost preview nao anima.
    animation: ghost ? undefined : "wallDropIn 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
  };

  if (type === "h") {
    return (
      <div
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
    <div
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
