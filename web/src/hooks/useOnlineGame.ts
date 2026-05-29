import {
  canPlaceWall,
  deserializeState,
  getValidMoves,
  goalRow,
  hasPathToRow,
  INITIAL_P1,
  INITIAL_P2,
  registerWall,
  WALLS_PER_PLAYER,
  type GameOverPayload,
  type GameStartPayload,
  type GameState,
  type Move,
  type PlayerId,
  type RematchDeclinedPayload,
  type RematchExpiredPayload,
  type RematchRequestedPayload,
  type StateUpdatePayload,
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
import {
  leaveRoom,
  reportTimeout,
  requestRematch as requestRematchRpc,
  respondRematch as respondRematchRpc,
  sendMove,
} from "../net/api";
import { getLastGameStart, getSocket } from "../net/socket";
import { useDragOverlay } from "../state/dragOverlay";
import { usePlayerName } from "../state/profile";
import { useAuth } from "../state/auth";

const EMPTY_SET: Set<number> = new Set();

export type RematchStatus =
  | "idle"
  | "requesting"
  | "requested"
  | "declined"
  | "expired"
  | "unavailable";

export function useOnlineGame() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") ?? "?";
  const isHost = searchParams.get("role") === "host";
  const password = searchParams.get("password") ?? "";

  const navigate = useNavigate();
  useButtonSound();
  const myName = usePlayerName();
  const { refreshTrofeus } = useAuth();

  // Reload protection
  const [showReloadWarning, setShowReloadWarning] = useState(false);
  const [reloadDefeat, setReloadDefeat] = useState(() => {
    const wasActive = sessionStorage.getItem("barreira.online_game_active");
    if (wasActive === "1") {
      sessionStorage.removeItem("barreira.online_game_active");
      return true;
    }
    return false;
  });

  useEffect(() => {
    sessionStorage.setItem("barreira.online_game_active", "1");
    return () => { sessionStorage.removeItem("barreira.online_game_active"); };
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

  // Game state
  const [meta, setMeta] = useState<GameStartPayload | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // Replay capture. moves[] vem populado via stateUpdate (server inclui o
  // Move no payload), firstTurn fica congelado do estado inicial de gameStart.
  const [replayMoves, setReplayMoves] = useState<Move[]>([]);
  const [replayFirstTurn, setReplayFirstTurn] = useState<PlayerId>(1);

  const [countdownStartsAt, setCountdownStartsAt] = useState<number | null>(null);
  const [countdownActive, setCountdownActive] = useState(false);

  const [rematchStatus, setRematchStatus] = useState<RematchStatus>("idle");
  const [rematchExpiresAt, setRematchExpiresAt] = useState(0);
  const [rematchRequesterName, setRematchRequesterName] = useState("");

  usePieceMoveSound(state?.p1 ?? -1, state?.p2 ?? -1);
  const totalWallsUsed = state ? (WALLS_PER_PLAYER - state.wallsLeft[1]) + (WALLS_PER_PLAYER - state.wallsLeft[2]) : 0;
  useWallPlaceSound(totalWallsUsed);

  const myPlayer: PlayerId = meta?.yourEnginePlayer ?? 1;
  const opponentPlayer: PlayerId = myPlayer === 1 ? 2 : 1;

  const { p1TimeMs, p2TimeMs, timedOutPlayer, resetTimers } = useGameTimers(
    state?.turn ?? 1,
    state?.winner ?? null,
    countdownActive,
    meta?.timeTotalMs,
  );

  const [gameOverReason, setGameOverReason] = useState<GameOverReason>("goal");

  useEffect(() => {
    if (timedOutPlayer !== null && state && state.winner === null) {
      const winner = timedOutPlayer === 1 ? 2 : 1;
      setGameOverReason("timeout");
      setState((prev) => prev ? { ...prev, winner } : prev);
      // Avisa o server pra ele encerrar/premiar (o relógio é client-side; sem
      // isso o awardCasualTrophy nunca rodava em vitória por tempo). O server
      // valida com o próprio relógio e emite gameOver/stateUpdate pros dois.
      void reportTimeout();
    }
  }, [timedOutPlayer, state?.winner]);

  // Drag state
  const [dragType, setDragType] = useState<WallType | null>(null);
  const [ghost, setGhost] = useState<WallPlacement | null>(null);
  const [ghostInvalid, setGhostInvalid] = useState(false);
  const [showBlockedToast, setShowBlockedToast] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const layout = useResponsiveBoard();
  const { dragX, dragY, lastInter, show, hide } = useDragOverlay();

  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state;
  const ghostRef = useRef<WallPlacement | null>(null);
  ghostRef.current = ghost;
  const dragTypeRef = useRef<WallType | null>(null);
  dragTypeRef.current = dragType;
  // Refs pra acessar valores atualizados dentro do handler de gameOver
  // (registrado uma vez em useEffect com deps [] e captura closures stale).
  const myPlayerRef = useRef<PlayerId>(myPlayer);
  myPlayerRef.current = myPlayer;
  const refreshTrofeusRef = useRef(refreshTrofeus);
  refreshTrofeusRef.current = refreshTrofeus;
  const resetTimersRef = useRef(resetTimers);
  resetTimersRef.current = resetTimers;

  // Socket events
  useEffect(() => {
    const cached = getLastGameStart();
    if (cached) {
      setMeta(cached);
      setState(deserializeState(cached.state));
      setCountdownStartsAt(cached.countdownStartsAt);
      setCountdownActive(true);
    }

    const socket = getSocket();

    const onGameStart = (payload: GameStartPayload) => {
      const initial = deserializeState(payload.state);
      setMeta(payload);
      setState(initial);
      // Distingue um JOGO NOVO (1ª partida / revanche → estado inicial) de uma
      // REANEXAÇÃO (reconexão no meio/fim da partida, que reenvia o gameStart
      // com o estado ATUAL). Só num jogo novo resetamos replay/rematch/timers.
      // Sem isso, uma reconexão (até depois do fim) apagava os movimentos do
      // replay e o estado do modal antes do usuário fechar — replay vazio.
      const isNewGame =
        initial.winner === null &&
        initial.walls.placements.length === 0 &&
        initial.p1 === INITIAL_P1 &&
        initial.p2 === INITIAL_P2;
      if (isNewGame) {
        setOpponentLeft(false);
        setCountdownStartsAt(payload.countdownStartsAt);
        setCountdownActive(true);
        setRematchStatus("idle");
        setRematchExpiresAt(0);
        setRematchRequesterName("");
        setGameOverReason("goal");
        // Replay reinicia só num jogo novo (inclui revanche).
        setReplayMoves([]);
        setReplayFirstTurn(initial.turn);
        // Zera os timers — sem isso a revanche herda o tempo restante da
        // partida anterior (e o timedOutPlayer ficaria fixo se tivesse estourado).
        resetTimersRef.current();
      }
    };
    const onStateUpdate = (payload: StateUpdatePayload) => {
      setState(deserializeState(payload.state));
      // Server inclui o `move` no payload pra o replay reconstruir o jogo.
      // Pode estar undefined em paths que só atualizam state sem move real
      // (ex: W.O. de timeout marca winner sem aplicar move).
      if (payload.move) {
        setReplayMoves((prev) => [...prev, payload.move as Move]);
      }
    };
    const onGameOver = (payload: GameOverPayload) => {
      // Server manda o motivo (goal/timeout/abandon) — fonte da verdade.
      if (payload.reason) setGameOverReason(payload.reason);
      // Eu venci? Re-busca trofeus_casual pra UI refletir o +1.
      // Se eu nao estou logado, refreshTrofeus eh no-op.
      if (payload.winner === myPlayerRef.current) {
        void refreshTrofeusRef.current();
      }
    };
    const onOpponentLeft = () => {
      setOpponentLeft(true);
      // Se havia revanche em aberto (ou ainda no botão), o oponente saiu →
      // não dá mais pra revanchar. Mostra "indisponível" em vez do botão.
      setRematchStatus((s) =>
        s === "idle" || s === "requesting" || s === "requested" ? "unavailable" : s,
      );
    };

    const onRematchRequested = (payload: RematchRequestedPayload) => {
      setRematchStatus("requested");
      setRematchExpiresAt(payload.expiresAt);
      setRematchRequesterName(payload.fromName);
    };
    const onRematchDeclined = (_payload: RematchDeclinedPayload) => setRematchStatus("declined");
    const onRematchExpired = (_payload: RematchExpiredPayload) => setRematchStatus("expired");

    const onDisconnect = () => setReconnecting(true);
    const onConnect = () => setReconnecting(false);

    socket.on("gameStart", onGameStart);
    socket.on("stateUpdate", onStateUpdate);
    socket.on("gameOver", onGameOver);
    socket.on("opponentLeft", onOpponentLeft);
    socket.on("rematchRequested", onRematchRequested);
    socket.on("rematchDeclined", onRematchDeclined);
    socket.on("rematchExpired", onRematchExpired);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);

    return () => {
      socket.off("gameStart", onGameStart);
      socket.off("stateUpdate", onStateUpdate);
      socket.off("gameOver", onGameOver);
      socket.off("opponentLeft", onOpponentLeft);
      socket.off("rematchRequested", onRematchRequested);
      socket.off("rematchDeclined", onRematchDeclined);
      socket.off("rematchExpired", onRematchExpired);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
    };
  }, []);

  const myTurn = state !== null && state.turn === myPlayer && state.winner === null && !countdownActive;

  const validMoves = useMemo(() => {
    if (!state || !myTurn || dragType !== null) return EMPTY_SET;
    return new Set(getValidMoves(state, myPlayer));
  }, [state, myTurn, myPlayer, dragType]);

  const onSquareTap = async (index: number) => {
    if (!myTurn || !state) return;
    await sendMove({ kind: "piece", to: index });
  };

  const onDragStart = (type: WallType) => {
    if (!myTurn || !state) return;
    if (state.wallsLeft[myPlayer] <= 0) return;
    setDragType(type);
    setGhost(null);
    show(type, layout);
  };

  const onIntersectionChange = (ir: number, ic: number, type: WallType) => {
    const placement: WallPlacement = { type, interRow: ir, interCol: ic };
    const s = stateRef.current;
    if (s && canPlaceWall(s.walls, placement)) {
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
  const sendingWallRef = useRef(false);

  const onDragEnd = async () => {
    if (dragTypeRef.current === null) return;
    const g = ghostRef.current;
    const invalid = ghostInvalidRef.current;
    dragTypeRef.current = null;
    setDragType(null);
    setGhost(null);
    setGhostInvalid(false);
    setShowBlockedToast(false);
    hide();
    if (!g || invalid || sendingWallRef.current) return;
    sendingWallRef.current = true;
    await sendMove({ kind: "wall", placement: g });
    sendingWallRef.current = false;
  };

  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);

  const doLeave = async () => {
    await Promise.race([
      leaveRoom().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
    navigate(-1);
  };

  const onBack = () => {
    playButtonSound();
    if (state && state.winner === null && !opponentLeft) {
      setShowQuitConfirm(true);
    } else {
      doLeave();
    }
  };

  const confirmQuit = () => {
    setShowQuitConfirm(false);
    doLeave();
  };

  const onReportPlayer = () => {
    setShowReportConfirm(true);
  };

  const confirmReport = () => {
    setShowReportConfirm(false);
    const subject = encodeURIComponent("Denuncia de jogador - Barreira");
    const body = encodeURIComponent(`Jogador denunciado: ${meta?.opponentName ?? "?"}\nSala: ${code}\nMotivo: `);
    window.open(`mailto:contato@barreira.app?subject=${subject}&body=${body}`, "_blank");
  };

  const onBackToMenu = () => navigate("/");
  const onBackToLobby = async () => {
    await Promise.race([
      leaveRoom().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
    navigate("/", { replace: true });
  };

  const onRequestRematch = async () => {
    setRematchStatus("requesting");
    setRematchExpiresAt(Date.now() + 15_000);
    const res = await requestRematchRpc();
    if (!res.ok && res.error !== "rematch-already-pending") {
      // Falhou (ex: oponente já saiu → not-in-room). Em vez de voltar pro
      // botão silenciosamente, mostra feedback claro de indisponível.
      setRematchStatus("unavailable");
      setRematchExpiresAt(0);
    }
  };

  const onAcceptRematch = async () => {
    setRematchStatus("idle");
    await respondRematchRpc(true);
  };

  const onDeclineRematch = async () => {
    // Estado terminal: depois de recusar não dá pra pedir revanche de novo
    // (o server também trava). Voltar pra "idle" reexibiria o botão e, contra
    // bot, pedir de novo entregaria que ele só estava esperando pra aceitar.
    setRematchStatus("declined");
    await respondRematchRpc(false);
  };

  const myTimeMs = myPlayer === 1 ? p1TimeMs : p2TimeMs;
  const opTimeMs = myPlayer === 1 ? p2TimeMs : p1TimeMs;

  return {
    // Waiting screen data
    ready: meta !== null && state !== null,
    code,
    isHost,
    password,

    // Game layout props
    state: state!,
    myPlayer,
    opponentPlayer,
    myName,
    opponentName: meta?.opponentName ?? "",
    myTimeMs,
    opTimeMs,
    countdownActive,
    countdownStartsAt,
    validMoves,
    ghost,
    ghostInvalid,
    showBlockedToast,
    boardRef,
    layout,
    flipped: myPlayer === 2,
    dragX,
    dragY,
    lastInter,
    myTurn,
    wallsDisabled: !myTurn || (state?.winner ?? null) !== null || opponentLeft,
    onSquareTap,
    onDragStart,
    onIntersectionChange,
    onIntersectionLeave,
    onDragEnd,
    onBack,

    // Online-specific
    opponentLeft,
    reconnecting,
    gameOverReason,
    showReloadWarning,
    reloadDefeat,
    setShowReloadWarning,
    setCountdownActive,
    confirmReloadDefeat,
    rematchStatus,
    rematchExpiresAt,
    rematchRequesterName,
    onReportPlayer,
    onBackToMenu,
    onBackToLobby,
    onRequestRematch,
    onAcceptRematch,
    replayMoves,
    replayFirstTurn,
    onDeclineRematch,

    // Quit / report confirmation modals
    showQuitConfirm,
    showReportConfirm,
    cancelQuit: () => setShowQuitConfirm(false),
    confirmQuit,
    cancelReport: () => setShowReportConfirm(false),
    confirmReport,
  };
}
