import { useEffect, useState } from "react";
import { IoTrophy, IoCloseCircle, IoTimerOutline, IoRefresh, IoExitOutline, IoTimeOutline, IoGameController, IoCheckmark, IoClose, IoHomeOutline, IoCloseCircleOutline, IoPlayCircleOutline } from "react-icons/io5";
import type { PlayerId } from "@barreira/shared";
import { useGameResultSound } from "../hooks/useGameResultSound";
import { useAudioSettings } from "../state/audioSettings";

const ACCENT = {
  blue: "#3D6FFF",
  red: "#FF3D6F",
} as const;

type RematchStatus = "idle" | "requesting" | "requested" | "declined" | "expired" | "unavailable";

export type GameOverReason = "goal" | "timeout" | "abandon";

type Props = {
  visible: boolean;
  winner: PlayerId | null;
  reason?: GameOverReason;
  onRematch: () => void;
  onBackToMenu: () => void;
  online?: boolean;
  rematchStatus?: RematchStatus;
  rematchExpiresAt?: number;
  rematchRequesterName?: string;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
  onLeave?: () => void;
  /** Habilita botão "Ver replay" — true quando há ao menos 1 move gravado. */
  replayAvailable?: boolean;
  onWatchReplay?: () => void;
};

const useCountdown = (expiresAt: number, active: boolean) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active || !expiresAt) {
      setSeconds(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSeconds(remaining);
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [expiresAt, active]);
  return seconds;
};

const L = {
  navy: "#1A2A4A",
  textSecondary: "#5C6F8F",
  muted: "#9AAACA",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
  cellBg: "#EEF2FF",
};

const btnBase: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: 8,
  padding: "13px 0",
  borderRadius: 12,
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  border: "none",
  fontSize: 14,
  fontWeight: 700,
};

export const GameOverModal = ({
  visible,
  winner,
  reason = "goal",
  onRematch,
  onBackToMenu,
  online = false,
  rematchStatus = "idle",
  rematchExpiresAt = 0,
  rematchRequesterName = "",
  onAcceptRematch,
  onDeclineRematch,
  onLeave,
  replayAvailable = false,
  onWatchReplay,
}: Props) => {
  const isVictory = winner === 1;
  const isTimeout = reason === "timeout";
  const isAbandon = reason === "abandon";
  const { sfxEnabled } = useAudioSettings();
  useGameResultSound(visible, isVictory, sfxEnabled);

  const title = isAbandon
    ? isVictory ? "Vitoria por W.O.!" : "Voce abandonou"
    : isVictory
      ? isTimeout ? "Tempo esgotado!" : "Vitoria!"
      : isTimeout ? "Tempo esgotado!" : "Derrota";
  const subtitle = isAbandon
    ? isVictory
      ? "O oponente abandonou a partida."
      : "Voce abandonou e o oponente venceu."
    : isVictory
      ? isTimeout
        ? "O adversario ficou sem tempo."
        : "Voce chegou na linha de cima."
      : isTimeout
        ? "Seu tempo acabou."
        : "O adversario cruzou a linha primeiro.";
  const accent = isVictory ? ACCENT.blue : ACCENT.red;

  const countdown = useCountdown(
    rematchExpiresAt,
    online && (rematchStatus === "requesting" || rematchStatus === "requested"),
  );

  const IconComp = isAbandon
    ? isVictory ? IoTrophy : IoCloseCircle
    : isVictory
      ? isTimeout ? IoTimerOutline : IoTrophy
      : isTimeout ? IoTimerOutline : IoCloseCircle;

  const renderActions = () => {
    if (!online) {
      return (
        <div style={{ display: "flex", flexDirection: "row", gap: 10, width: "100%" }}>
          <button
            onClick={onBackToMenu}
            style={{ ...btnBase, flex: 1, backgroundColor: L.white, border: `1px solid ${L.border}`, color: L.navy }}
          >
            <IoHomeOutline size={18} /> Menu
          </button>
          <button
            onClick={onRematch}
            style={{ ...btnBase, flex: 1.4, backgroundColor: accent, color: "#0b1014", fontWeight: 900, fontSize: 15 }}
          >
            <IoRefresh size={18} /> Revanche
          </button>
        </div>
      );
    }

    switch (rematchStatus) {
      case "idle":
        return (
          <div style={{ display: "flex", flexDirection: "row", gap: 10, width: "100%" }}>
            <button
              onClick={onLeave}
              style={{ ...btnBase, flex: 1, backgroundColor: L.white, border: `1px solid ${L.border}`, color: L.navy }}
            >
              <IoExitOutline size={18} /> Sair
            </button>
            <button
              onClick={onRematch}
              style={{ ...btnBase, flex: 1.4, backgroundColor: accent, color: "#0b1014", fontWeight: 900, fontSize: 15 }}
            >
              <IoRefresh size={18} /> Revanche
            </button>
          </div>
        );

      case "requesting":
        return (
          <div style={{ display: "flex", flexDirection: "row", gap: 10, width: "100%" }}>
            <button
              onClick={onLeave}
              style={{ ...btnBase, flex: 1, backgroundColor: L.white, border: `1px solid ${L.border}`, color: L.navy }}
            >
              <IoExitOutline size={18} /> Sair
            </button>
            <div
              style={{ ...btnBase, flex: 1.4, backgroundColor: L.cellBg, border: `1px solid ${L.border}`, color: L.muted }}
            >
              <IoTimeOutline size={18} color="#666" />
              Aguardando resposta... {countdown}s
            </div>
          </div>
        );

      case "requested":
        return (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: `${ACCENT.blue}1a`,
                borderRadius: 10,
                padding: "10px 14px",
                width: "100%",
                border: `1px solid ${ACCENT.blue}55`,
              }}
            >
              <IoGameController size={20} color={ACCENT.blue} />
              <span style={{ color: L.navy, fontSize: 13, fontWeight: 700, flex: 1 }}>
                {rematchRequesterName} quer uma revanche!
              </span>
              <span style={{ color: ACCENT.blue, fontSize: 15, fontWeight: 900, minWidth: 30, textAlign: "right" }}>
                {countdown}s
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "row", gap: 10, width: "100%" }}>
              <button
                onClick={onDeclineRematch}
                style={{ ...btnBase, flex: 1, backgroundColor: L.white, border: `1px solid ${L.border}`, color: ACCENT.red }}
              >
                <IoClose size={18} /> Recusar
              </button>
              <button
                onClick={onAcceptRematch}
                style={{ ...btnBase, flex: 1.4, backgroundColor: ACCENT.blue, color: "#0b1014", fontWeight: 900 }}
              >
                <IoCheckmark size={18} /> Aceitar
              </button>
            </div>
            <button
              onClick={onLeave}
              style={{ background: "none", border: "none", padding: "8px 20px", color: L.muted, fontSize: 12, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}
            >
              Sair
            </button>
          </div>
        );

      case "declined":
      case "expired":
      case "unavailable": {
        const message =
          rematchStatus === "declined"
            ? "Revanche recusada"
            : rematchStatus === "expired"
              ? "Tempo esgotado"
              : "Adversario saiu — revanche indisponivel";
        return (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "11px 14px",
                borderRadius: 12,
                backgroundColor: L.cellBg,
                border: `1px solid ${L.border}`,
                color: L.muted,
                fontSize: 13,
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              <IoCloseCircleOutline size={18} color="#666" />
              {message}
            </div>
            <button
              onClick={onLeave}
              style={{ ...btnBase, width: "100%", backgroundColor: L.white, border: `1px solid ${L.border}`, color: L.navy }}
            >
              <IoExitOutline size={18} /> Sair
            </button>
          </div>
        );
      }
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(26, 42, 74, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 200,
        animation: "fadeIn 220ms ease-out",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          backgroundColor: L.cardBg,
          borderRadius: 20,
          padding: "28px 22px",
          border: `1px solid ${L.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: `0 12px 24px ${L.navy}33`,
          animation: "slideUp 360ms ease-out",
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            border: `2px solid ${accent}`,
            backgroundColor: `${accent}1f`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <IconComp size={44} color={accent} />
        </div>

        <span
          style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 6,
            color: accent,
          }}
        >
          {title}
        </span>
        <span
          style={{
            color: L.textSecondary,
            fontSize: 13,
            textAlign: "center",
            marginBottom: 22,
            padding: "0 8px",
          }}
        >
          {subtitle}
        </span>

        {renderActions()}

        {/* Link "Ver replay" — sutil, abaixo das ações principais. Só aparece
            se houve moves (W.O. instantâneo, por ex., não tem replay). */}
        {replayAvailable && onWatchReplay && (
          <button
            onClick={onWatchReplay}
            style={{
              marginTop: 14,
              padding: "8px 16px",
              background: "none",
              border: "none",
              color: L.muted,
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            <IoPlayCircleOutline size={16} />
            Ver replay desta partida
          </button>
        )}
      </div>
    </div>
  );
};
