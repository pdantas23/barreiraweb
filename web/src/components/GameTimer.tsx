import { useEffect, useRef, useState } from "react";
import { GAME_TIME_TOTAL_MS } from "@barreira/shared";
import { gc } from "../gameColors";

const DANGER_THRESHOLD_MS = 30_000;

type Props = {
  timeRemainingMs: number;
  isActive: boolean;
  isPlayer: boolean;
  /** Tempo total da partida em ms. Server manda no gameStart; default = constante shared. */
  timeTotalMs?: number;
};

const formatTime = (ms: number): string => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

export const GameTimer = ({ timeRemainingMs, isActive, isPlayer, timeTotalMs = GAME_TIME_TOTAL_MS }: Props) => {
  const fraction = Math.max(0, Math.min(1, timeRemainingMs / timeTotalMs));
  const isDanger = timeRemainingMs <= DANGER_THRESHOLD_MS;
  const baseColor = isPlayer ? gc.blue : gc.red;
  const baseGradient: readonly [string, string] = isPlayer ? gc.timerBarFill : [gc.red, gc.redLight];
  const barColor = isDanger ? gc.timerBarDanger : baseColor;
  const gradientColors = isDanger
    ? [gc.timerBarDanger, gc.redLight]
    : baseGradient;

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, width: "100%" }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: gc.labelColor,
          letterSpacing: 1,
          width: 42,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {isPlayer ? "TEMPO" : "TEMPO"}
      </span>
      <div style={{ flex: 1, height: 8 }}>
        <div
          style={{
            height: "100%",
            backgroundColor: gc.timerBarBg,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${fraction * 100}%`,
              height: "100%",
              borderRadius: 4,
              opacity: 0.8,
              background: `linear-gradient(to right, ${gradientColors[0]}, ${gradientColors[1]})`,
              transition: "width 0.1s linear",
            }}
          />
        </div>
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: barColor,
          minWidth: 34,
          textAlign: "right",
        }}
      >
        {formatTime(timeRemainingMs)}
      </span>
      {isActive && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: `${barColor}99`,
            animation: isDanger ? "pulseFast 0.5s infinite" : "pulse 1s infinite",
          }}
        />
      )}
    </div>
  );
};

export const useGameTimers = (
  turn: 1 | 2,
  winner: 1 | 2 | null,
  countdownActive: boolean,
  // Tempo total enviado pelo server no gameStart. Caller passa undefined em
  // partidas locais (sem server) — daí cai pra constante shared.
  timeTotalMs?: number,
) => {
  const total = timeTotalMs ?? GAME_TIME_TOTAL_MS;
  // Ref pra resetTimers sempre ler o valor mais recente do server, mesmo
  // que a partida tenha começado com fallback (race do gameStart com mount).
  const totalRef = useRef(total);
  totalRef.current = total;
  const [p1TimeMs, setP1TimeMs] = useState(total);
  const [p2TimeMs, setP2TimeMs] = useState(total);
  const [timedOutPlayer, setTimedOutPlayer] = useState<1 | 2 | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (winner !== null || countdownActive || timedOutPlayer !== null) return;

    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      if (turn === 1) {
        setP1TimeMs((prev) => {
          const next = prev - delta;
          if (next <= 0) {
            setTimedOutPlayer(1);
            return 0;
          }
          return next;
        });
      } else {
        setP2TimeMs((prev) => {
          const next = prev - delta;
          if (next <= 0) {
            setTimedOutPlayer(2);
            return 0;
          }
          return next;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [turn, winner, countdownActive, timedOutPlayer]);

  const resetTimers = () => {
    setP1TimeMs(totalRef.current);
    setP2TimeMs(totalRef.current);
    setTimedOutPlayer(null);
    lastTickRef.current = Date.now();
  };

  return { p1TimeMs, p2TimeMs, timedOutPlayer, resetTimers };
};
