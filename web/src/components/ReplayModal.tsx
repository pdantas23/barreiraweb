// === Replay in-memory ===
//
// Modal sobreposto ao GameOverModal pra rever a partida que acabou. Sem
// banco — os moves vivem em useState do hook do jogo e somem quando o
// usuário sai da rota. Reconstrói cada frame aplicando o subset de moves
// ao initialState(firstTurn), garantido determinístico.

import { useEffect, useMemo, useState } from "react";
import {
  IoClose,
  IoPlay,
  IoPause,
  IoPlaySkipBack,
  IoPlaySkipForward,
} from "react-icons/io5";
import {
  applyMove,
  initialState,
  type GameState,
  type Move,
  type PlayerId,
} from "@barreira/shared";
import { Board } from "./Board";
import { useResponsiveBoard } from "../hooks/useResponsiveBoard";

const FRAME_MS = 600; // velocidade do play automático

type Props = {
  visible: boolean;
  moves: Move[];
  firstTurn: PlayerId;
  /** Se true, board renderiza rotacionado 180° (perspectiva do P2). */
  flipped?: boolean;
  p1Name: string;
  p2Name: string;
  onClose: () => void;
};

const L = {
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  border: "#DDEAFF",
  cellBg: "#EEF2FF",
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
};

export const ReplayModal = ({
  visible,
  moves,
  firstTurn,
  flipped = false,
  p1Name,
  p2Name,
  onClose,
}: Props) => {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const layout = useResponsiveBoard();

  // Reseta posição ao reabrir
  useEffect(() => {
    if (visible) {
      setIdx(0);
      setPlaying(false);
    }
  }, [visible]);

  // Pré-computa todos os states do replay. Tamanho = moves.length + 1.
  // Determinístico porque applyMove é pura e firstTurn é capturado.
  const states: GameState[] = useMemo(() => {
    const arr: GameState[] = [initialState(firstTurn)];
    let cur = arr[0];
    for (const m of moves) {
      const res = applyMove(cur, cur.turn, m);
      if (!res.ok) {
        // Move inválido durante reconstrução — para aqui pra não corromper.
        // Não devia acontecer: server validou todo move que entrou no array.
        console.warn("[replay] applyMove falhou na reconstrução:", res.error);
        break;
      }
      cur = res.state;
      arr.push(cur);
    }
    return arr;
  }, [moves, firstTurn]);

  const lastIdx = states.length - 1;
  const currentState = states[Math.min(idx, lastIdx)] ?? states[0];

  // Auto-play: avança 1 frame por FRAME_MS. Pausa sozinho no fim.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setIdx((prev) => {
        if (prev >= lastIdx) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [playing, lastIdx]);

  const onPrev = () => {
    setPlaying(false);
    setIdx((i) => Math.max(0, i - 1));
  };
  const onNext = () => {
    setPlaying(false);
    setIdx((i) => Math.min(lastIdx, i + 1));
  };
  const onTogglePlay = () => {
    // Se chegou no fim, rebobina antes de tocar.
    if (idx >= lastIdx) setIdx(0);
    setPlaying((p) => !p);
  };
  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaying(false);
    setIdx(Number(e.target.value));
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(26, 42, 74, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 300, // acima do GameOverModal (200)
        animation: "fadeIn 220ms ease-out",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "92vh",
          backgroundColor: L.white,
          borderRadius: 20,
          padding: "18px 18px 14px",
          border: `1px solid ${L.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: `0 16px 36px ${L.navy}33`,
        }}
      >
        {/* Header: título + close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            marginBottom: 12,
            gap: 8,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ color: L.navy, fontSize: 16, fontWeight: 800, letterSpacing: 0.5 }}>
              Replay
            </div>
            <div style={{ color: L.muted, fontSize: 11, fontWeight: 600, marginTop: 2 }}>
              {p1Name} vs {p2Name} · {moves.length} {moves.length === 1 ? "jogada" : "jogadas"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar replay"
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              border: `1px solid ${L.border}`,
              backgroundColor: L.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <IoClose size={18} color={L.navy} />
          </button>
        </div>

        {/* Board */}
        <div style={flipped ? { transform: "rotate(180deg)" } : undefined}>
          <Board
            state={currentState}
            validMoves={new Set()}
            ghost={null}
            onSquareTap={() => {}}
            boardRef={{ current: null }}
            layout={layout}
            flipped={flipped}
          />
        </div>

        {/* Slider */}
        <div style={{ width: "100%", marginTop: 14 }}>
          <input
            type="range"
            min={0}
            max={lastIdx}
            value={Math.min(idx, lastIdx)}
            onChange={onSeek}
            style={{
              width: "100%",
              accentColor: L.blue,
              cursor: "pointer",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: L.muted,
              fontSize: 11,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              marginTop: 2,
            }}
          >
            <span>Lance {idx} / {lastIdx}</span>
            <span>{idx === lastIdx ? "Fim" : `vez de P${currentState.turn}`}</span>
          </div>
        </div>

        {/* Controles */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button
            onClick={onPrev}
            disabled={idx === 0}
            aria-label="Lance anterior"
            style={ctrlBtnStyle(idx === 0)}
          >
            <IoPlaySkipBack size={20} color={idx === 0 ? L.muted : L.navy} />
          </button>
          <button
            onClick={onTogglePlay}
            aria-label={playing ? "Pausar" : "Tocar"}
            style={{
              ...ctrlBtnStyle(false),
              width: 56,
              height: 56,
              borderRadius: 28,
              background: `linear-gradient(135deg, ${L.blue}, ${L.blueLight})`,
              border: "none",
            }}
          >
            {playing ? (
              <IoPause size={24} color={L.white} />
            ) : (
              <span style={{ marginLeft: 2, display: "flex" }}>
                <IoPlay size={24} color={L.white} />
              </span>
            )}
          </button>
          <button
            onClick={onNext}
            disabled={idx >= lastIdx}
            aria-label="Próximo lance"
            style={ctrlBtnStyle(idx >= lastIdx)}
          >
            <IoPlaySkipForward size={20} color={idx >= lastIdx ? L.muted : L.navy} />
          </button>
        </div>
      </div>
    </div>
  );
};

const ctrlBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: L.white,
  border: `1px solid ${L.border}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
});
