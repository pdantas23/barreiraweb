import {
  applyMove,
  botMove,
  canPlaceWall,
  getValidMoves,
  goalRow,
  hasPathToRow,
  initialState,
  positionHash,
  randomFirstTurn,
  registerWall,
  WALLS_PER_PLAYER,
  type BotDifficulty,
  type GameState,
  type Move,
  type PlayerId,
  type WallPlacement,
  type WallType,
} from "@barreira/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { GameOverReason } from "../components/GameOverModal";
import { useGameTimers } from "../components/GameTimer";
import { playButtonSound, useButtonSound } from "./useButtonSound";
import { usePieceMoveSound } from "./usePieceSound";
import { useResponsiveBoard } from "./useResponsiveBoard";
import { useWallPlaceSound } from "./useWallSound";
import { useDragOverlay } from "../state/dragOverlay";

const HUMAN: PlayerId = 1;
const OPPONENT: PlayerId = 2;
const OPPONENT_THINK_MS = 700;
const EMPTY_SET: Set<number> = new Set();

type Difficulty = BotDifficulty;

const pickBot = (
  difficulty: Difficulty,
): ((state: GameState, botId: PlayerId, recent?: string[]) => Move | null) =>
  (state, botId, recent) => botMove(state, botId, difficulty, recent);

const RECENT_LIMIT = 8; // = HISTORY_LIMIT do bot.ts

const parseDifficulty = (raw: unknown): Difficulty => {
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return "medium";
};

export const difficultyLabel = (d: Difficulty): string =>
  d === "easy" ? "Facil" : d === "hard" ? "Dificil" : "Medio";

export function useLocalGame() {
  useButtonSound();
  const [searchParams] = useSearchParams();
  const difficulty = parseDifficulty(searchParams.get("difficulty"));
  const botMove = useMemo(() => pickBot(difficulty), [difficulty]);
  const navigate = useNavigate();

  // Reload protection
  const [showReloadWarning, setShowReloadWarning] = useState(false);
  const [reloadDefeat, setReloadDefeat] = useState(() => {
    const wasActive = sessionStorage.getItem("barreira.game_active");
    if (wasActive === "1") {
      sessionStorage.removeItem("barreira.game_active");
      return true;
    }
    return false;
  });

  useEffect(() => {
    sessionStorage.setItem("barreira.game_active", "1");
    return () => { sessionStorage.removeItem("barreira.game_active"); };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key === "r")) {
        e.preventDefault();
        setShowReloadWarning(true);
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const confirmReloadDefeat = () => {
    setShowReloadWarning(false);
    setReloadDefeat(true);
  };

  // Game state. firstTurn salvo separado: pro replay reconstruir do início.
  const [state, setState] = useState<GameState>(() => initialState(randomFirstTurn()));
  const [replayMoves, setReplayMoves] = useState<Move[]>([]);
  const [replayFirstTurn, setReplayFirstTurn] = useState<PlayerId>(() => state.turn);
  usePieceMoveSound(state.p1, state.p2);
  const totalWallsUsed = (WALLS_PER_PLAYER - state.wallsLeft[1]) + (WALLS_PER_PLAYER - state.wallsLeft[2]);
  useWallPlaceSound(totalWallsUsed);

  const [dragType, setDragType] = useState<WallType | null>(null);
  const [ghost, setGhost] = useState<WallPlacement | null>(null);
  const [ghostInvalid, setGhostInvalid] = useState(false);
  const [showBlockedToast, setShowBlockedToast] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<GameOverReason>("goal");
  const [countdownStartsAt, setCountdownStartsAt] = useState(() => Date.now());
  const [countdownActive, setCountdownActive] = useState(true);

  const layout = useResponsiveBoard();
  const myTurn = state.turn === HUMAN && state.winner === null && !countdownActive;

  const { dragX, dragY, lastInter, show, hide } = useDragOverlay();
  const boardRef = useRef<HTMLDivElement>(null);

  const { p1TimeMs, p2TimeMs, timedOutPlayer, resetTimers } = useGameTimers(
    state.turn,
    state.winner,
    countdownActive,
  );

  useEffect(() => {
    if (timedOutPlayer !== null && state.winner === null) {
      const winner = timedOutPlayer === 1 ? 2 : 1;
      setGameOverReason("timeout");
      setState((prev) => ({ ...prev, winner }));
    }
  }, [timedOutPlayer, state.winner]);

  const stateRef = useRef(state);
  stateRef.current = state;
  // Memória cross-turn do bot (Correção 1): últimas posições REAIS da partida
  // (mesmo formato do positionHash). Passada ao botMove pra detectar ciclos
  // entre turnos e ativar o anti-shuffle no treino offline. Reset no restart.
  const recentRef = useRef<string[]>([positionHash(state)]);
  const ghostRef = useRef(ghost);
  ghostRef.current = ghost;
  const dragTypeRef = useRef(dragType);
  dragTypeRef.current = dragType;

  const validMoves = useMemo(() => {
    if (!myTurn || dragType !== null) return EMPTY_SET;
    return new Set(getValidMoves(state, HUMAN));
  }, [state, myTurn, dragType]);

  // Registra cada posição real (humano, bot e início) na memória cross-turn.
  useEffect(() => {
    const hash = positionHash(state);
    const list = recentRef.current;
    if (list[list.length - 1] === hash) return; // não duplica a mesma posição
    list.push(hash);
    if (list.length > RECENT_LIMIT) list.shift();
  }, [state]);

  // Bot turn
  useEffect(() => {
    if (state.turn !== OPPONENT || state.winner !== null || countdownActive) return;
    const timer = setTimeout(() => {
      const move = botMove(state, OPPONENT, recentRef.current);
      if (!move) return;
      const res = applyMove(state, OPPONENT, move);
      if (res.ok) {
        setState(res.state);
        setReplayMoves((prev) => [...prev, move]);
      }
    }, OPPONENT_THINK_MS);
    return () => clearTimeout(timer);
  }, [state, botMove, countdownActive]);

  const onSquareTap = (index: number) => {
    if (!myTurn) return;
    const move: Move = { kind: "piece", to: index };
    const res = applyMove(state, HUMAN, move);
    if (res.ok) {
      setState(res.state);
      setReplayMoves((prev) => [...prev, move]);
    }
  };

  const onDragStart = (type: WallType) => {
    if (!myTurn || state.wallsLeft[HUMAN] <= 0) return;
    setDragType(type);
    setGhost(null);
    show(type, layout);
  };

  const onIntersectionChange = (ir: number, ic: number, type: WallType) => {
    const placement: WallPlacement = { type, interRow: ir, interCol: ic };
    const s = stateRef.current;
    if (canPlaceWall(s.walls, placement)) {
      const nextWalls = registerWall(s.walls, placement);
      const blocksPath =
        !hasPathToRow(nextWalls, s.p1, goalRow(1)) ||
        !hasPathToRow(nextWalls, s.p2, goalRow(2));
      setGhost(placement);
      setGhostInvalid(blocksPath);
      setShowBlockedToast(blocksPath);
    } else {
      setGhost(null);
      setGhostInvalid(false);
      setShowBlockedToast(false);
    }
  };

  const onIntersectionLeave = () => {
    setGhost(null);
    setGhostInvalid(false);
    setShowBlockedToast(false);
  };

  const ghostInvalidRef = useRef(ghostInvalid);
  ghostInvalidRef.current = ghostInvalid;

  const onDragEnd = () => {
    if (dragTypeRef.current === null) return;
    const g = ghostRef.current;
    if (g && !ghostInvalidRef.current) {
      const move: Move = { kind: "wall", placement: g };
      const res = applyMove(stateRef.current, HUMAN, move);
      if (res.ok) {
        setState(res.state);
        setReplayMoves((prev) => [...prev, move]);
      }
    }
    setDragType(null);
    setGhost(null);
    setGhostInvalid(false);
    setShowBlockedToast(false);
    hide();
  };

  const onRestart = () => {
    const fresh = initialState(randomFirstTurn());
    recentRef.current = [positionHash(fresh)]; // reset da memória cross-turn
    setState(fresh);
    setReplayMoves([]);
    setReplayFirstTurn(fresh.turn);
    setDragType(null);
    setGhost(null);
    setGhostInvalid(false);
    setShowBlockedToast(false);
    setGameOverReason("goal");
    hide();
    setCountdownStartsAt(Date.now());
    setCountdownActive(true);
    resetTimers();
  };

  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const onBack = () => {
    playButtonSound();
    if (state.winner !== null) {
      navigate(-1);
      return;
    }
    setShowQuitConfirm(true);
  };

  const confirmQuit = () => {
    setShowQuitConfirm(false);
    navigate(-1);
  };

  return {
    state,
    myPlayer: HUMAN,
    opponentPlayer: OPPONENT,
    myName: "Você",
    opponentName: "Oponente",
    myTimeMs: p1TimeMs,
    opTimeMs: p2TimeMs,
    countdownActive,
    countdownStartsAt,
    validMoves,
    ghost,
    ghostInvalid,
    showBlockedToast,
    boardRef,
    layout,
    flipped: false,
    dragX,
    dragY,
    lastInter,
    myTurn,
    wallsDisabled: !myTurn,
    onSquareTap,
    onDragStart,
    onIntersectionChange,
    onIntersectionLeave,
    onDragEnd,
    onBack,
    onRestart,
    difficulty,
    gameOverReason,
    showReloadWarning,
    reloadDefeat,
    setShowReloadWarning,
    setCountdownActive,
    confirmReloadDefeat,
    showQuitConfirm,
    cancelQuit: () => setShowQuitConfirm(false),
    confirmQuit,
    // Replay data — descartado quando o hook desmonta (sai da rota).
    replayMoves,
    replayFirstTurn,
  };
}
