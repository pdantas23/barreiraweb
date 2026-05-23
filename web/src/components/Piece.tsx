import { gc } from "../gameColors";

type Props = {
  player: 1 | 2;
  size: number;
};

export const Piece = ({ player, size }: Props) => {
  const colors = player === 1 ? gc.pawnPlayer : gc.pawnOpponent;
  const d = size * 0.72;
  const reflectD = d * 0.28;

  return (
    <div
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: gc.pawnOuter,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxShadow: "0 3px 6px rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          width: d - 4,
          height: d - 4,
          borderRadius: (d - 4) / 2,
          background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
          position: "absolute",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: reflectD,
          height: reflectD,
          borderRadius: reflectD / 2,
          backgroundColor: gc.pawnReflect,
          top: d * 0.12,
          left: d * 0.15,
        }}
      />
    </div>
  );
};
