import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  applyMove,
  botMove,
  canPlaceWall,
  getValidMoves,
  goalRow,
  hasPathToRow,
  initialState,
  registerWall,
  WALLS_PER_PLAYER,
  type GameState,
  type WallPlacement,
  type WallType,
} from "@barreira/shared";
import { Board } from "../src/components/Board";
import { GameOverModal, type GameOverReason } from "../src/components/GameOverModal";
import { PlayerCard, TurnArrow } from "../src/components/PlayerCard";
import { WallBank } from "../src/components/WallBank";
import { TutorialOverlay } from "../src/components/TutorialOverlay";
import { useResponsiveBoard } from "../src/hooks/useResponsiveBoard";
import { useDragOverlay } from "../src/state/dragOverlay";
import { gc } from "../src/gameColors";
import { playButtonSound, useButtonSound } from "../src/hooks/useButtonSound";
import { usePieceMoveSound } from "../src/hooks/usePieceSound";
import { useWallPlaceSound } from "../src/hooks/useWallSound";
import { useTutorial } from "../src/state/tutorial";
import {
  TUTORIAL_HUMAN,
  TUTORIAL_OPPONENT,
  TUTORIAL_STEPS,
  allowedTargets,
  scriptedOpponentMove,
} from "../src/tutorial/script";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HUMAN = TUTORIAL_HUMAN; // 1
const OPPONENT = TUTORIAL_OPPONENT; // 2
const EMPTY_SET: Set<number> = new Set();
// Atraso do lance do oponente — igual ao jogo real (game.tsx). Sem isso o bot
// jogava instantâneo logo após o usuário.
const OPPONENT_THINK_MS = 700;

// "guided" = passos com coach-marks (oponente scriptado). "free" = partida livre
// até o fim contra o bot fácil (sem troféu — é local/offline).
type Phase = "guided" | "free";

export default function TutorialScreen() {
  useButtonSound(); // preload
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { markSeen } = useTutorial();

  // O humano SEMPRE começa — roteiro determinístico.
  const [state, setState] = useState<GameState>(() => initialState(HUMAN));
  const [phase, setPhase] = useState<Phase>("guided");
  const [stepIndex, setStepIndex] = useState(0);
  const [gameOverReason] = useState<GameOverReason>("goal");
  const step = phase === "guided" ? TUTORIAL_STEPS[stepIndex] : null;

  usePieceMoveSound(state.p1, state.p2);
  const totalWallsUsed =
    WALLS_PER_PLAYER - state.wallsLeft[1] + (WALLS_PER_PLAYER - state.wallsLeft[2]);
  useWallPlaceSound(totalWallsUsed);

  const [dragType, setDragType] = useState<WallType | null>(null);
  const [ghost, setGhost] = useState<WallPlacement | null>(null);
  const [ghostInvalid, setGhostInvalid] = useState(false);
  const [showBlockedToast, setShowBlockedToast] = useState(false);

  const layout = useResponsiveBoard();
  const { dragX, dragY, lastInter, show, hide } = useDragOverlay();
  const boardRef = useAnimatedRef<Animated.View>();

  const humanTurn = state.turn === HUMAN && state.winner === null;
  const isMoveStep = phase === "guided" && step?.kind === "move";
  const isWallStep = phase === "guided" && step?.kind === "wall";
  // Pode colocar parede agora? No passo de parede (guiado) ou na fase livre,
  // desde que seja a vez do humano.
  const canWallNow = humanTurn && (phase === "free" || isWallStep);

  const validMoves = useMemo(() => {
    if (!humanTurn || dragType !== null) return EMPTY_SET;
    if (phase === "free") return new Set(getValidMoves(state, HUMAN));
    if (step?.kind === "move") return new Set(allowedTargets(state, step));
    return EMPTY_SET;
  }, [state, phase, step, humanTurn, dragType]);

  // Refs pros callbacks de gesto (rodam fora do ciclo de render).
  const stateRef = useRef(state);
  stateRef.current = state;
  const ghostRef = useRef(ghost);
  ghostRef.current = ghost;
  const dragTypeRef = useRef(dragType);
  dragTypeRef.current = dragType;
  const ghostInvalidRef = useRef(ghostInvalid);
  ghostInvalidRef.current = ghostInvalid;

  // Lance do oponente, com atraso (não instantâneo). Guiado = scriptado (anda
  // reto pro objetivo, previsível pros passos); livre = bot fácil de verdade.
  useEffect(() => {
    if (state.turn !== OPPONENT || state.winner !== null) return;
    const timer = setTimeout(() => {
      const s = stateRef.current;
      if (s.turn !== OPPONENT || s.winner !== null) return;
      const move = phase === "free" ? botMove(s, OPPONENT, "easy") : scriptedOpponentMove(s);
      if (!move) return;
      const res = applyMove(s, OPPONENT, move);
      if (res.ok) setState(res.state);
    }, OPPONENT_THINK_MS);
    return () => clearTimeout(timer);
  }, [state, phase]);

  const exitToHome = () => {
    markSeen();
    router.replace("/");
  };

  const advance = () => {
    setStepIndex((i) => Math.min(i + 1, TUTORIAL_STEPS.length - 1));
  };

  const startFreePlay = () => {
    markSeen(); // concluiu a parte guiada — não reaparece sozinho
    setPhase("free");
  };

  // Botão de avanço dos passos "info". No último passo guiado, entra na fase livre.
  const onNext = () => {
    playButtonSound();
    if (stepIndex >= TUTORIAL_STEPS.length - 1) startFreePlay();
    else advance();
  };

  const onSkip = () => {
    playButtonSound();
    exitToHome();
  };

  const onSquareTap = (index: number) => {
    if (!humanTurn) return;
    if (phase === "guided" && step?.kind !== "move") return;
    const res = applyMove(stateRef.current, HUMAN, { kind: "piece", to: index });
    if (res.ok) {
      setState(res.state);
      if (phase === "guided") advance();
    }
  };

  // ─── Arraste de parede (espelha game.tsx) ───
  const onDragStart = (type: WallType) => {
    if (!canWallNow || state.wallsLeft[HUMAN] <= 0) return;
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

  const resetDrag = () => {
    setDragType(null);
    setGhost(null);
    setGhostInvalid(false);
    setShowBlockedToast(false);
    hide();
  };

  const onDragEnd = () => {
    if (dragTypeRef.current === null) return;
    const g = ghostRef.current;
    if (g && !ghostInvalidRef.current) {
      const res = applyMove(stateRef.current, HUMAN, { kind: "wall", placement: g });
      if (res.ok) {
        resetDrag();
        setState(res.state);
        if (phase === "guided") advance();
        return;
      }
    }
    resetDrag();
  };

  const onRematch = () => {
    setState(initialState(HUMAN));
    resetDrag();
  };

  return (
    <LinearGradient
      colors={[gc.bgTop, gc.bgBottom]}
      style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={onSkip}
          accessibilityLabel="Sair do tutorial"
          accessibilityRole="button"
          hitSlop={8}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={gc.textDark} />
        </Pressable>
        <View style={styles.tutorialChip}>
          <Text style={styles.tutorialChipText}>
            {phase === "free" ? "TREINO" : "TUTORIAL"}
          </Text>
        </View>
      </View>

      {/* Coach-mark (só na fase guiada) */}
      {phase === "guided" && step && (
        <TutorialOverlay
          step={step}
          index={stepIndex}
          total={TUTORIAL_STEPS.length}
          onNext={onNext}
          onSkip={onSkip}
        />
      )}

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
          isActive={humanTurn}
          isPlayer={true}
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

      {/* Wall bank — destacado no passo de parede */}
      <View style={[styles.wallBankWrap, isWallStep && styles.wallBankHighlight]}>
        <WallBank
          wallsLeft={state.wallsLeft[HUMAN]}
          disabled={!canWallNow}
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
      </View>

      {/* Dica da fase livre */}
      {phase === "free" && state.winner === null && (
        <Text style={styles.hint}>
          Chegue na linha do topo pra vencer
        </Text>
      )}

      {/* Fim de partida (fase livre) — sem troféu, é local */}
      <GameOverModal
        visible={phase === "free" && state.winner !== null}
        winner={state.winner}
        reason={gameOverReason}
        onRematch={onRematch}
        onBackToMenu={exitToHome}
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
  tutorialChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(61,111,255,0.08)",
  },
  tutorialChipText: {
    color: gc.blue,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  cardsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "90%",
    gap: 4,
    marginTop: 6,
    marginBottom: 6,
  },
  boardArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  wallBankWrap: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 6,
  },
  wallBankHighlight: {
    backgroundColor: "rgba(61,111,255,0.10)",
  },
  hint: {
    color: gc.labelColor,
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
});
