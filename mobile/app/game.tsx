import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { initialState } from "../src/game/board";
import { applyMove } from "../src/game/engine";
import { getValidMoves } from "../src/game/moves";
import { easyOpponentMove } from "../src/game/easyOpponent";
import { smartOpponentMove } from "../src/game/smartOpponent";
import { minimaxOpponentMove } from "../src/game/minimaxOpponent";
import type { GameState, Move, PlayerId, WallPlacement, WallType } from "../src/game/types";
import { canPlaceWall } from "../src/game/walls";
import { Board } from "../src/components/Board";
import { GameOverModal } from "../src/components/GameOverModal";
import { TurnIndicator } from "../src/components/TurnIndicator";
import { WallBank } from "../src/components/WallBank";
import { useResponsiveBoard } from "../src/hooks/useResponsiveBoard";
import { useDragOverlay } from "../src/state/dragOverlay";
import { theme } from "../src/theme";
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
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty = parseDifficulty(params.difficulty);
  const botMove = useMemo(() => pickBot(difficulty), [difficulty]);

  const [state, setState] = useState<GameState>(() => initialState());
  const [dragType, setDragType] = useState<WallType | null>(null);
  const [ghost, setGhost] = useState<WallPlacement | null>(null);

  const layout = useResponsiveBoard();
  const myTurn = state.turn === HUMAN && state.winner === null;

  const { dragX, dragY, lastInter, show, hide } = useDragOverlay();

  // useAnimatedRef: ref especial do Reanimated que pode ser lida por
  // measure() dentro de worklets (UI thread). Substitui o esquema antigo
  // de boardOrigin medido com setTimeout / setState.
  const boardRef = useAnimatedRef<Animated.View>();

  const stateRef = useRef(state);
  stateRef.current = state;
  const ghostRef = useRef(ghost);
  ghostRef.current = ghost;
  const dragTypeRef = useRef(dragType);
  dragTypeRef.current = dragType;

  // Hooks para navegação e cálculo da barra de status
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const validMoves = useMemo(() => {
    if (!myTurn || dragType !== null) return EMPTY_SET;
    return new Set(getValidMoves(state, HUMAN));
  }, [state, myTurn, dragType]);

  useEffect(() => {
    if (state.turn !== OPPONENT || state.winner !== null) return;
    const timer = setTimeout(() => {
      const move = botMove(state, OPPONENT);
      if (!move) return;
      const res = applyMove(state, OPPONENT, move);
      if (res.ok) setState(res.state);
    }, OPPONENT_THINK_MS);
    return () => clearTimeout(timer);
  }, [state, botMove]);

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
    if (canPlaceWall(stateRef.current.walls, placement)) {
      setGhost(placement);
    } else {
      setGhost(null);
    }
  };

  const onIntersectionLeave = () => setGhost(null);

  const onDragEnd = () => {
    if (dragTypeRef.current === null) return;
    const g = ghostRef.current;
    if (g) {
      const res = applyMove(stateRef.current, HUMAN, { kind: "wall", placement: g });
      if (res.ok) setState(res.state);
    }
    setDragType(null);
    setGhost(null);
    hide();
  };

  const onRestart = () => {
    setState(initialState());
    setDragType(null);
    setGhost(null);
    hide();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom }]}>
      
      {/* TOPO CUSTOMIZADO: Seta de voltar e TurnIndicator na mesma linha */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
        </Pressable>
        
        <View style={styles.turnWrapper}>
          <TurnIndicator turn={state.turn} winner={state.winner} />
        </View>
        
        {/* Chip de dificuldade — também serve pra equilibrar o flex */}
        <View style={styles.difficultyChip}>
          <Text style={styles.difficultyChipText}>{difficultyLabel(difficulty)}</Text>
        </View>
      </View>

      <Board
        state={state}
        validMoves={validMoves}
        ghost={ghost}
        onSquareTap={onSquareTap}
        boardRef={boardRef}
      />

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

      <GameOverModal
        visible={state.winner !== null}
        winner={state.winner}
        onRematch={onRestart}
        onBackToMenu={() => router.back()}
      />

      <Text style={styles.hint}>
        Toque numa casa verde pra mover. Arraste uma parede do banco até uma intersecção.
      </Text>

      {/* ESPAÇO RESERVADO PARA O BANNER DE ANÚNCIO (AdMob) */}
      <View style={styles.adContainer}>
        <Text style={{ color: "#555", fontSize: 12 }}>Espaço para Anúncio (320x50)</Text>
      </View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between", // Distribui o conteúdo para usar bem as bordas (topo/baixo)
    backgroundColor: theme.bg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  turnWrapper: {
    flex: 1,
    alignItems: "center",
  },
  hint: {
    color: theme.textMuted,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  difficultyChip: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#22262e",
    borderWidth: 1,
    borderColor: "#33384a",
    alignItems: "center",
    justifyContent: "center",
  },
  difficultyChipText: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  adContainer: {
    width: 320,
    height: 50,
    backgroundColor: "#1a1a20",
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "auto", // Joga o anúncio pro limite inferior da tela
    marginBottom: 10,
  }
});