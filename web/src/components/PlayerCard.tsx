import { gc } from "../gameColors";

type Props = {
  name: string;
  wallsLeft: number;
  totalWalls: number;
  isActive: boolean;
  isPlayer: boolean;
};

export const PlayerCard = ({
  name,
  wallsLeft,
  totalWalls,
  isActive,
  isPlayer,
}: Props) => {
  const gradientColors = isPlayer ? gc.cardBorderPlayer : gc.cardBorderOpponent;
  const dotColor = isPlayer ? gc.blue : gc.red;

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: isActive ? gc.cardActiveBg : gc.cardBg,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: `0 2px 8px ${gc.boardShadow}14`,
        position: "relative",
      }}
    >
      {!isActive && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: `linear-gradient(to bottom, ${gradientColors[0]}, ${gradientColors[1]})`,
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "8px 10px 8px 12px",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: isActive ? "rgba(255,255,255,0.25)" : `${dotColor}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: isActive ? gc.white : dotColor,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: isActive ? gc.white : gc.textDark,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </span>

          <div style={{ display: "flex", flexDirection: "row", gap: 2.5 }}>
            {Array.from({ length: totalWalls }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor:
                    i < wallsLeft
                      ? isActive
                        ? gc.white
                        : dotColor
                      : isActive
                        ? "rgba(255,255,255,0.15)"
                        : `${dotColor}26`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TurnArrow = ({ isPlayerTurn }: { isPlayerTurn: boolean }) => (
  <span style={{ color: gc.blue, opacity: 0.5, fontSize: 12, margin: "0 4px" }}>
    {isPlayerTurn ? "\u25B6" : "\u25C0"}
  </span>
);
