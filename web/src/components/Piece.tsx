import { gc } from "../gameColors";

type Props = {
  player: 1 | 2;
  size: number;
  /** Skin custom (Replay Builder): URL de bandeira circular que cobre o
   *  peão inteiro. Com bandeira o peão fica maior e sem o anel branco —
   *  a bandeira ocupa o círculo todo. O gradiente padrão fica por baixo
   *  como fallback caso a imagem não carregue. */
  flagUrl?: string;
};

export const Piece = ({ player, size, flagUrl }: Props) => {
  const colors = player === 1 ? gc.pawnPlayer : gc.pawnOpponent;
  const d = size * (flagUrl ? 0.88 : 0.72);
  const innerD = flagUrl ? d : d - 4;
  const reflectD = d * 0.28;

  return (
    <div
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: flagUrl ? "transparent" : gc.pawnOuter,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        boxShadow: "0 3px 6px rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          width: innerD,
          height: innerD,
          borderRadius: innerD / 2,
          background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
          position: "absolute",
        }}
      />
      {flagUrl && (
        <img
          src={flagUrl}
          alt=""
          draggable={false}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
          style={{
            width: d,
            height: d,
            borderRadius: "50%",
            objectFit: "cover",
            position: "absolute",
            userSelect: "none",
          }}
        />
      )}
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
