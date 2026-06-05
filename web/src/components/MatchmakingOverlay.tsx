// === Tela de matchmaking (Partida Rápida) ===
//
// Overlay full-screen escuro com animação contínua (radar pulsante) enquanto
// busca adversário. Entra na fila no mount (joinMatchmaking) e escuta
// `matchFound` → navega pra partida (o gameStart já vem cacheado pelo socket).
// Cancelar (ou desmontar sem match) chama leaveMatchmaking.
//
// O contador é "enganoso" de propósito: avança rápido no início, desacelera no
// meio e acelera no fim, batendo ~15s (o mesmo timeout do bot no server).

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoFlash, IoClose } from "react-icons/io5";
import type { MatchFoundPayload } from "@barreira/shared";
import { getSocket } from "../net/socket";
import { joinMatchmaking, leaveMatchmaking } from "../net/api";
import { playButtonSound } from "../hooks/useButtonSound";

const MAX_SECONDS = 15;

// Curva fast-slow-fast: derivada alta nas pontas, baixa no meio.
const organicProgress = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  const s = x < 0.5 ? -1 : 1;
  return 0.5 + 0.5 * s * Math.pow(Math.abs(2 * x - 1), 0.7);
};

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
  const [seconds, setSeconds] = useState(0);
  const [found, setFound] = useState(false);
  const matchedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    matchedRef.current = false;
    setSeconds(0);
    setFound(false);
    const startedAt = Date.now();
    const socket = getSocket();

    const onMatchFound = (payload: MatchFoundPayload) => {
      matchedRef.current = true;
      setFound(true);
      // Pequeno respiro pra mostrar "Adversário encontrado!" antes de entrar.
      setTimeout(() => {
        navigate(`/online-game?code=${encodeURIComponent(payload.roomCode)}`);
      }, 650);
    };
    socket.on("matchFound", onMatchFound);

    // Entra na fila. Se falhar (já na fila / sem conexão), reporta e fecha.
    void joinMatchmaking().then((res) => {
      if (!res.ok) {
        onError(res);
        onCancel();
      }
    });

    // Contador orgânico.
    const timer = setInterval(() => {
      const t = (Date.now() - startedAt) / (MAX_SECONDS * 1000);
      setSeconds(Math.min(MAX_SECONDS, Math.round(MAX_SECONDS * organicProgress(t))));
    }, 100);

    return () => {
      clearInterval(timer);
      socket.off("matchFound", onMatchFound);
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

      {/* Radar: anéis pulsando pra fora + núcleo com raio */}
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
        {/* anel varredura girando */}
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
      <div
        style={{
          marginTop: 10,
          color: "#6B9FFF",
          fontSize: 34,
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
          minWidth: 60,
          textAlign: "center",
        }}
      >
        {seconds}s
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
