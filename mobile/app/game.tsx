import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  applyMove,
  canPlaceWall,
  easyOpponentMove,
  getValidMoves,
  goalRow,
  hasPathToRow,
  initialState,
  minimaxOpponentMove,
  randomFirstTurn,
  registerWall,
  smartOpponentMove,
  WALLS_PER_PLAYER,
  type GameState,
  type Move,
  type PlayerId,
  type WallPlacement,
  type WallType,
} from "@barreira/shared";
import { Board } from "../src/components/Board";
import { CountdownOverlay } from "../src/components/CountdownOverlay";
import { GameOverModal, type GameOverReason } from "../src/components/GameOverModal";
import { GameTimer, useGameTimers } from "../src/components/GameTimer";
import { PlayerCard, TurnArrow } from "../src/components/PlayerCard";
import { WallBank } from "../src/components/WallBank";
import { useResponsiveBoard } from "../src/hooks/useResponsiveBoard";
import { useDragOverlay } from "../src/state/dragOverlay";
import { gc } from "../src/gameColors";
import { playButtonSound, useButtonSound } from "../src/hooks/useButtonSound";
import { usePieceMoveSound } from "../src/hooks/usePieceSound";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HUMAN = 1 as const;
const OPPONENT = 2 as const;
const OPPONENT_THINK_MS = 700;
const EMPTY_SET: Set<number> = new Set();

type Difficulty = "easy" | "medium" | "hard";

const pickBot = (
  difficulty: Difficulty,
): ((state: GameState, botId: PlayerId) => Move | null) => {
  switch (difficulty) {
    case "easy":
      return easyOpponentMove;
    case "hard":
      return minimaxOpponentMove;
    case "medium":
    default:
      return smartOpponentMove;
  }
};

const parseDifficulty = (raw: unknown): Difficulty => {
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return "medium";
};

const difficultyLabel = (d: Difficulty): string =>
  d === "easy" ? "Fácil" : d === "hard" ? "Difícil" : "Médio";

export default function GameScreen() {
  useButtonSound(); // preload
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty = parseDifficulty(params.difficulty);
  const botMove = useMemo(() => pickBot(difficulty), [difficulty]);

  const [state, setState] = useState<GameState>(() => initialState(randomFirstTurn()));
  usePieceMoveSound(state.p1, state.p2);
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
  const boardRef = useAnimatedRef<Animated.View>();

  // Fischer-clock timers
  const { p1TimeMs, p2TimeMs, timedOutPlayer, resetTimers } = useGameTimers(
    state.turn,
    state.winner,
    countdownActive,
  );

  // Timeout = loss
  useEffect(() => {
    if (timedOutPlayer !== null && state.winner === null) {
      const winner = timedOutPlayer === 1 ? 2 : 1;
      setGameOverReason("timeout");
      setState((prev) => ({ ...prev, winner }));
    }
  }, [timedOutPlayer, state.winner]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const ghostRef = useRef(ghost);
  ghostRef.current = ghost;
  const dragTypeRef = useRef(dragType);
  dragTypeRef.current = dragType;

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const validMoves = useMemo(() => {
    if (!myTurn || dragType !== null) return EMPTY_SET;
    return new Set(getValidMoves(state, HUMAN));
  }, [state, myTurn, dragType]);

  useEffect(() => {
    if (state.turn !== OPPONENT || state.winner !== null || countdownActive) return;
    const timer = setTimeout(() => {
      const move = botMove(state, OPPONENT);
      if (!move) return;
      const res = applyMove(state, OPPONENT, move);
      if (res.ok) setState(res.state);
    }, OPPONENT_THINK_MS);
    return () => clearTimeout(timer);
  }, [state, botMove, countdownActive]);

  const onSquareTap = (index: number) => {
    if (!myTurn) return;
    const res = applyMove(state, HUMAN, { kind: "piece", to: index });
    if (res.ok) setState(res.state);
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
      const res = applyMove(stateRef.current, HUMAN, { kind: "wall", placement: g });
      if (res.ok) setState(res.state);
    }
    setDragType(null);
    setGhost(null);
    setGhostInvalid(false);
    setShowBlockedToast(false);
    hide();
  };

  const onRestart = () => {
    setState(initialState(randomFirstTurn()));
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

  const confirmLeave = () => {
    playButtonSound();
    Alert.alert("Sair da partida", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => router.back() },
    ]);
  };

  return (
    <LinearGradient
      colors={[gc.bgTop, gc.bgBottom]}
      style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={confirmLeave} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={gc.textDark} />
        </Pressable>
        <View style={styles.difficultyChip}>
          <Text style={styles.difficultyChipText}>{difficultyLabel(difficulty)}</Text>
        </View>
      </View>

      {/* Player cards */}
      <View style={styles.cardsRow}>
        <PlayerCard
          name="Oponente"
          wallsLeft={state.wallsLeft[OPPONENT]}
          totalWalls={WALLS_PER_PLAYER}
          isActive={state.turn === OPPONENT && state.winner === null}
          isPlayer={false}
        />
        <TurnArrow isPlayerTurn={state.turn === HUMAN} />
        <PlayerCard
          name="Você"
          wallsLeft={state.wallsLeft[HUMAN]}
          totalWalls={WALLS_PER_PLAYER}
          isActive={state.turn === HUMAN && state.winner === null}
          isPlayer={true}
        />
      </View>

      {/* Opponent timer */}
      <View style={styles.timerRow}>
        <GameTimer
          timeRemainingMs={p2TimeMs}
          isActive={state.turn === OPPONENT && state.winner === null && !countdownActive}
          isPlayer={false}
        />
      </View>

      {/* Board */}
      <View style={styles.boardArea}>
        <Board
          state={state}
          validMoves={validMoves}
          ghost={ghost}
          ghostInvalid={ghostInvalid}
          showBlockedToast={showBlockedToast}
          onSquareTap={onSquareTap}
          boardRef={boardRef}
        />
      </View>

      {/* Player timer */}
      <View style={styles.timerRow}>
        <GameTimer
          timeRemainingMs={p1TimeMs}
          isActive={state.turn === HUMAN && state.winner === null && !countdownActive}
          isPlayer={true}
        />
      </View>

      {/* Wall bank */}
      <WallBank
        wallsLeft={state.wallsLeft[HUMAN]}
        disabled={!myTurn}
        dragX={dragX}
        dragY={dragY}
        lastInter={lastInter}
        boardRef={boardRef}
        layout={layout}
        onDragStart={onDragStart}
        onIntersectionChange={onIntersectionChange}
        onIntersectionLeave={onIntersectionLeave}
        onDragEnd={onDragEnd}
      />

      {/* Hint */}
      <Text style={styles.hint}>
        Toque para mover · Arraste para colocar parede
      </Text>

      {/* Countdown overlay */}
      {countdownActive && (
        <CountdownOverlay
          startsAt={countdownStartsAt}
          onComplete={() => setCountdownActive(false)}
        />
      )}

      <GameOverModal
        visible={state.winner !== null}
        winner={state.winner}
        reason={gameOverReason}
        onRematch={onRestart}
        onBackToMenu={() => router.back()}
      />

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
  },
  difficultyChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(61,111,255,0.08)",
  },
  difficultyChipText: {
    color: gc.blue,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cardsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "90%",
    gap: 4,
    marginBottom: 6,
  },
  timerRow: {
    width: "88%",
    marginVertical: 3,
  },
  boardArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  hint: {
    color: gc.labelColor,
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
});
