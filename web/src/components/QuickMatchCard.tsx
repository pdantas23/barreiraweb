// Card "Partida Rápida" (matchmaking online) — fica acima da lista de salas.
// Visual: gradiente azul, ícone de raio, título + subtítulo e botão JOGAR.
// O cronômetro à direita é decorativo (referência do design).

import { IoFlash, IoArrowForward, IoStopwatchOutline } from "react-icons/io5";

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  white: "#FFFFFF",
} as const;

export function QuickMatchCard({
  onPlay,
  disabled = false,
  className,
}: {
  onPlay: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        background: `linear-gradient(120deg, ${C.blue}, ${C.blueLight})`,
        boxShadow: "0 8px 20px rgba(61,111,255,0.30)",
        padding: "18px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      {/* Cronômetro decorativo, esmaecido no canto direito */}
      <IoStopwatchOutline
        size={120}
        color={C.white}
        style={{ position: "absolute", right: -14, top: -6, opacity: 0.14 }}
      />

      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: "rgba(255,255,255,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IoFlash size={26} color={C.white} />
      </div>

      <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
        <div style={{ color: C.white, fontSize: 17, fontWeight: 900, letterSpacing: 0.3 }}>
          Partida Rápida
        </div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>
          Encontre um adversário em segundos
        </div>
      </div>

      <button
        onClick={onPlay}
        disabled={disabled}
        aria-label="Buscar partida rápida"
        style={{
          zIndex: 1,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          backgroundColor: C.white,
          color: C.blue,
          border: "none",
          borderRadius: 12,
          padding: "11px 16px",
          fontWeight: 900,
          fontSize: 14,
          letterSpacing: 0.5,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
          boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
        }}
      >
        JOGAR <IoArrowForward size={16} />
      </button>
    </div>
  );
}
