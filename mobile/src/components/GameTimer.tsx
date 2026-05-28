import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { GAME_TIME_TOTAL_MS } from "@barreira/shared";
import { gc } from "../gameColors";

const DANGER_THRESHOLD_MS = 30_000; // 30 seconds

type Props = {
  timeRemainingMs: number;
  isActive: boolean;
  isPlayer: boolean; // true = your timer, false = opponent
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
  const barColor = isDanger ? gc.timerBarDanger : gc.blue;
  const gradientColors = isDanger
    ? ([gc.timerBarDanger, gc.redLight] as const)
    : gc.timerBarFill;

  // Pulsing dot
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      const duration = isDanger ? 500 : 1000;
      scale.value = withRepeat(
        withTiming(1.4, { duration: duration / 2 }),
        -1,
        true,
      );
    } else {
      cancelAnimation(scale);
      scale.value = 1;
    }
  }, [isActive, isDanger, scale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.label} numberOfLines={1}>
        {isPlayer ? "TURNO" : "OPON."}
      </Text>
      <View style={styles.barOuter}>
        <View style={styles.barBg}>
          <LinearGradient
            colors={[gradientColors[0], gradientColors[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.barFill,
              { width: `${fraction * 100}%` },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.time, { color: barColor }]}>
        {formatTime(timeRemainingMs)}
      </Text>
      {isActive && (
        <Animated.View
          style={[
            styles.pulseDot,
            { backgroundColor: `${barColor}99` },
            dotStyle,
          ]}
        />
      )}
    </View>
  );
};

// Hook to manage Fischer-clock timers for both players
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

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    color: gc.labelColor,
    letterSpacing: 1,
    width: 42,
  },
  barOuter: {
    flex: 1,
    height: 8,
  },
  barBg: {
    flex: 1,
    backgroundColor: gc.timerBarBg,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
    opacity: 0.8,
  },
  time: {
    fontSize: 12,
    fontWeight: "700",
    minWidth: 34,
    textAlign: "right",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
