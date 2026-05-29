// === Replay in-memory (mobile) ===
//
// Espelha o ReplayModal da web. Sem banco — os moves vivem no useState da
// tela de jogo e somem ao sair da rota. Cada frame é reconstruído aplicando
// o subset de moves ao initialState(firstTurn), garantido determinístico
// porque applyMove é pura.

import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  useAnimatedRef,
} from "react-native-reanimated";
import {
  applyMove,
  initialState,
  type GameState,
  type Move,
  type PlayerId,
} from "@barreira/shared";
import { Board } from "./Board";

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
} as const;

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
  const boardRef = useAnimatedRef<Animated.View>();
  const trackWidth = useRef(0);

  // Reseta posição ao reabrir
  useEffect(() => {
    if (visible) {
      setIdx(0);
      setPlaying(false);
    }
  }, [visible]);

  // Pré-computa todos os states do replay. Tamanho = moves.length + 1.
  const states: GameState[] = useMemo(() => {
    const arr: GameState[] = [initialState(firstTurn)];
    let cur = arr[0];
    for (const m of moves) {
      const res = applyMove(cur, cur.turn, m);
      if (!res.ok) {
        // Move inválido na reconstrução — para aqui pra não corromper.
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
  // Tap na barra de progresso → busca o frame proporcional.
  const onSeek = (locationX: number) => {
    if (lastIdx <= 0 || trackWidth.current <= 0) return;
    setPlaying(false);
    const ratio = Math.max(0, Math.min(1, locationX / trackWidth.current));
    setIdx(Math.round(ratio * lastIdx));
  };

  const fillPct = lastIdx > 0 ? (Math.min(idx, lastIdx) / lastIdx) * 100 : 0;

  // Renderizado DENTRO do Modal do GameOverModal (overlay absoluto), não como
  // um segundo Modal nativo — o iOS só apresenta um Modal por vez.
  if (!visible) return null;

  return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header: título + close */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Replay</Text>
              <Text style={styles.subtitle}>
                {p1Name} vs {p2Name} · {moves.length}{" "}
                {moves.length === 1 ? "jogada" : "jogadas"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Fechar replay"
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={20} color={L.navy} />
            </Pressable>
          </View>

          {/* Board */}
          <View style={flipped ? { transform: [{ rotate: "180deg" }] } : undefined}>
            <Board
              state={currentState}
              validMoves={EMPTY_MOVES}
              ghost={null}
              flipped={flipped}
              onSquareTap={NOOP}
              boardRef={boardRef}
            />
          </View>

          {/* Barra de progresso (tap pra buscar) */}
          <Pressable
            onLayout={(e) => {
              trackWidth.current = e.nativeEvent.layout.width;
            }}
            onPress={(e) => onSeek(e.nativeEvent.locationX)}
            style={styles.track}
          >
            <View style={styles.trackBg} />
            <View style={[styles.trackFill, { width: `${fillPct}%` }]} />
          </Pressable>
          <View style={styles.labels}>
            <Text style={styles.label}>
              Lance {idx} / {lastIdx}
            </Text>
            <Text style={styles.label}>
              {idx === lastIdx ? "Fim" : `vez de P${currentState.turn}`}
            </Text>
          </View>

          {/* Controles */}
          <View style={styles.controls}>
            <Pressable
              onPress={onPrev}
              disabled={idx === 0}
              accessibilityLabel="Lance anterior"
              style={({ pressed }) => [
                styles.ctrlBtn,
                idx === 0 && styles.ctrlBtnDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="play-skip-back" size={20} color={idx === 0 ? L.muted : L.navy} />
            </Pressable>
            <Pressable
              onPress={onTogglePlay}
              accessibilityLabel={playing ? "Pausar" : "Tocar"}
              style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
            >
              <Ionicons
                name={playing ? "pause" : "play"}
                size={26}
                color={L.white}
                style={playing ? undefined : { marginLeft: 2 }}
              />
            </Pressable>
            <Pressable
              onPress={onNext}
              disabled={idx >= lastIdx}
              accessibilityLabel="Próximo lance"
              style={({ pressed }) => [
                styles.ctrlBtn,
                idx >= lastIdx && styles.ctrlBtnDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="play-skip-forward" size={20} color={idx >= lastIdx ? L.muted : L.navy} />
            </Pressable>
          </View>
        </View>
      </Animated.View>
  );
};

// Constantes estáveis pra não recriar a cada render (evita re-render do Board).
const EMPTY_MOVES = new Set<number>();
const NOOP = () => {};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26, 42, 74, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: L.white,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: L.border,
    alignItems: "center",
    shadowColor: L.navy,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
    gap: 8,
  },
  title: {
    color: L.navy,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: L.muted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: L.white,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    width: "100%",
    height: 18,
    marginTop: 14,
    justifyContent: "center",
  },
  trackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: L.cellBg,
  },
  trackFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: L.blue,
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 2,
  },
  label: {
    color: L.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  controls: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: L.white,
    borderWidth: 1,
    borderColor: L.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnDisabled: {
    opacity: 0.5,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: L.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
