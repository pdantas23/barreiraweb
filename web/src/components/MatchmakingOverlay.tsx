// === Tela de matchmaking (Partida Rápida) ===
//
// Overlay full-screen escuro com animação contínua (radar pulsante) enquanto
// busca adversário. Entra na fila no mount (joinMatchmaking) e escuta
// `matchFound` → navega pra partida (o gameStart já vem cacheado pelo socket).
// O contador é REGRESSIVO (estilo Clash Royale): mostra o tempo estimado pra
// achar partida, vindo do `matchmakingStatus`, e conta pra baixo.
//
// `already-in-queue` NÃO é tratado como erro: significa que já estamos na fila
// (acontece no StrictMode do dev, que monta o efeito 2×) — é ignorado.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoFlash, IoClose } from "react-icons/io5";
import type { MatchFoundPayload, MatchmakingStatusPayload } from "@barreira/shared";
import { getSocket } from "../net/socket";
import { joinMatchmaking, leaveMatchmaking } from "../net/api";
import { playButtonSound } from "../hooks/useButtonSound";

export function MatchmakingOverlay({
  visible,
  onCancel,
  onError,
}: {
  visible: boolean;
  onCancel: () => void;
  onError: (res: { error: string; message?: string }) => void;
}) {
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [found, setFound] = useState(false);
  const matchedRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);
  // Fator aplicado uma vez ao tempo estimado pra o número exibido NÃO ser
  // exatamente o prazo do bot (um pouco a mais ou a menos) — parece natural.
  const jitterRef = useRef(1);

  useEffect(() => {
    if (!visible) return;
    matchedRef.current = false;
    deadlineRef.current = null;
    jitterRef.current = 0.8 + Math.random() * 0.5; // 0.8x .. 1.3x
    setRemaining(null);
    setFound(false);
    const socket = getSocket();

    const onMatchFound = (payload: MatchFoundPayload) => {
      matchedRef.current = true;
      setFound(true);
      // Respiro curto pra mostrar "Adversário encontrado!" antes de entrar.
      setTimeout(() => {
        navigate(`/online-game?code=${encodeURIComponent(payload.roomCode)}`);
      }, 650);
    };
    const onStatus = (p: MatchmakingStatusPayload) => {
      // Fixa o prazo exibido só na 1ª vez (com jitter) — evita o contador
      // pular a cada status e desacopla o número do tempo real do bot.
      if (deadlineRef.current === null) {
        deadlineRef.current =
          Date.now() + Math.max(0, p.estimatedMs * jitterRef.current - p.waitTime);
      }
    };
    socket.on("matchFound", onMatchFound);
    socket.on("matchmakingStatus", onStatus);

    void joinMatchmaking().then((res) => {
      // already-in-queue = já estamos buscando (StrictMode) → ignora.
      if (!res.ok && res.error !== "already-in-queue") {
        onError(res);
        onCancel();
      }
    });

    const timer = setInterval(() => {
      if (deadlineRef.current === null) return;
      const ms = Math.max(0, deadlineRef.current - Date.now());
      setRemaining(Math.ceil(ms / 1000));
    }, 100);

    return () => {
      clearInterval(timer);
      socket.off("matchFound", onMatchFound);
      socket.off("matchmakingStatus", onStatus);
      // Saiu sem casar → sai da fila. Se já casou, é no-op no server.
      if (!matchedRef.current) void leaveMatchmaking();
    };
  }, [visible, navigate, onCancel, onError]);

  if (!visible) return null;

  const handleCancel = () => {
    playButtonSound();
    void leaveMatchmaking();
    onCancel();
  };

  // Texto do contador: regressivo. Antes do 1º status mostra "…"; ao chegar a 0
  // segue buscando ("Quase lá...").
  const counterText =
    remaining === null ? "…" : remaining > 0 ? `${remaining}s` : "Quase lá...";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "radial-gradient(circle at 50% 38%, #1c2b52 0%, #0e1525 70%, #080b14 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "fadeIn 200ms ease-out",
      }}
    >
      <style>{`
        @keyframes mmRadar {
          0%   { transform: scale(0.4); opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes mmPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @keyframes mmSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ position: "relative", width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              width: 140,
              height: 140,
              borderRadius: "50%",
              border: "2px solid #3D6FFF",
              animation: `mmRadar 2.4s ease-out ${i * 0.8}s infinite`,
            }}
          />
        ))}
        <span
          style={{
            position: "absolute",
            width: 170,
            height: 170,
            borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: "rgba(107,159,255,0.8)",
            animation: "mmSpin 1.6s linear infinite",
          }}
        />
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            background: "linear-gradient(120deg, #3D6FFF, #6B9FFF)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 30px rgba(61,111,255,0.6)",
            animation: "mmPulse 1.4s ease-in-out infinite",
          }}
        >
          <IoFlash size={40} color="#FFFFFF" />
        </div>
      </div>

      <div style={{ marginTop: 36, color: "#FFFFFF", fontSize: 19, fontWeight: 800, letterSpacing: 0.3 }}>
        {found ? "Adversário encontrado!" : "Procurando adversário..."}
      </div>
      {!found && (
        <div style={{ marginTop: 6, color: "rgba(255,255,255,0.55)", fontSize: 12, letterSpacing: 0.4 }}>
          tempo estimado
        </div>
      )}
      <div
        style={{
          marginTop: 8,
          color: "#6B9FFF",
          fontSize: 34,
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
          minWidth: 60,
          textAlign: "center",
        }}
      >
        {found ? "🎉" : counterText}
      </div>

      {!found && (
        <button
          onClick={handleCancel}
          style={{
            marginTop: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#FFFFFF",
            borderRadius: 12,
            padding: "12px 26px",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <IoClose size={18} /> Cancelar
        </button>
      )}
    </div>
  );
}
