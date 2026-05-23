import { gc } from "../gameColors";

type Props = {
  visible: boolean;
  position: "top" | "bottom";
};

export const BlockedPathToast = ({ visible, position }: Props) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        [position === "top" ? "top" : "bottom"]: 8,
        zIndex: 50,
        pointerEvents: "none",
        animation: "fadeIn 120ms ease-out",
      }}
    >
      <div
        style={{
          backgroundColor: gc.white,
          borderRadius: 12,
          height: 48,
          overflow: "hidden",
          boxShadow: `0 4px 16px ${gc.red}38`,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
            background: `linear-gradient(to bottom, ${gc.red}, ${gc.redLight})`,
          }}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: 14,
            paddingRight: 14,
            gap: 8,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: `${gc.red}1a`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: gc.red,
            }}
          >
            ⚠
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1A2A4A" }}>
              Caminho bloqueado
            </span>
            <span style={{ fontSize: 10, color: gc.labelColor }}>
              Esta parede isola um jogador
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
