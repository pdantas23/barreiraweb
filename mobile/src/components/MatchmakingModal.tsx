// === Tela de matchmaking (Partida Rápida) — mobile ===
//
// Modal full-screen escuro com animação contínua (radar pulsante via
// Reanimated). Entra na fila no open (joinMatchmaking) e escuta `matchFound`
// → navega pra partida (gameStart já vem cacheado). Cancelar / fechar chama
// leaveMatchmaking. Contador "enganoso": rápido nas pontas, lento no meio.

import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { MatchFoundPayload, MatchmakingStatusPayload } from "@barreira/shared";
import { joinMatchmaking, leaveMatchmaking } from "../net/api";
import { getSocket } from "../net/socket";
import { errorInfo } from "../net/errors";
import { playButtonSound } from "../hooks/useButtonSound";
import { Alert } from "react-native";

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  white: "#FFFFFF",
} as const;

const Ring = ({ delay }: { delay: number }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }), -1, false),
    );
  }, [delay, p]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.4 + p.value * 2 }],
    opacity: 0.7 * (1 - p.value),
  }));
  return <Animated.View style={[styles.ring, style]} />;
};

export function MatchmakingModal({
  visible,
  onCancel,
}: {
  visible: boolean;
  onCancel: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [found, setFound] = useState(false);
  const matchedRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);

  const pulse = useSharedValue(1);
  const rot = useSharedValue(0);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  useEffect(() => {
    if (!visible) return;
    matchedRef.current = false;
    deadlineRef.current = null;
    setRemaining(null);
    setFound(false);
    pulse.value = withRepeat(withTiming(1.08, { duration: 700 }), -1, true);
    rot.value = withRepeat(withTiming(360, { duration: 1600, easing: Easing.linear }), -1, false);

    const socket = getSocket();

    const onMatchFound = (payload: MatchFoundPayload) => {
      matchedRef.current = true;
      setFound(true);
      setTimeout(() => {
        router.push({ pathname: "/online-game" as never, params: { code: payload.roomCode } });
      }, 650);
    };
    const onStatus = (p: MatchmakingStatusPayload) => {
      deadlineRef.current = Date.now() + Math.max(0, p.estimatedMs - p.waitTime);
    };
    socket.on("matchFound", onMatchFound);
    socket.on("matchmakingStatus", onStatus);

    void joinMatchmaking().then((res) => {
      // already-in-queue = já estamos buscando (StrictMode) → ignora.
      if (!res.ok && res.error !== "already-in-queue") {
        const info = errorInfo(res.error);
        Alert.alert(info.title, res.message ?? info.message);
        onCancel();
      }
    });

    const timer = setInterval(() => {
      if (deadlineRef.current === null) return;
      const ms = Math.max(0, deadlineRef.current - Date.now());
      setRemaining(Math.ceil(ms / 1000));
    }, 100);

    return () => {
      clearInterval(timer);
      socket.off("matchFound", onMatchFound);
      socket.off("matchmakingStatus", onStatus);
      if (!matchedRef.current) void leaveMatchmaking();
    };
  }, [visible, onCancel, pulse, rot]);

  const counterText =
    remaining === null ? "…" : remaining > 0 ? `~${remaining}s` : "Quase lá...";

  const handleCancel = () => {
    playButtonSound();
    void leaveMatchmaking();
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleCancel}>
      <View style={styles.root}>
        <View style={styles.radar}>
          <Ring delay={0} />
          <Ring delay={800} />
          <Ring delay={1600} />
          <Animated.View style={[styles.sweep, sweepStyle]} />
          <Animated.View style={[styles.core, pulseStyle]}>
            <Ionicons name="flash" size={38} color={C.white} />
          </Animated.View>
        </View>

        <Text style={styles.title}>
          {found ? "Adversário encontrado!" : "Procurando adversário..."}
        </Text>
        {!found && <Text style={styles.estLabel}>tempo estimado</Text>}
        <Text style={styles.counter}>{found ? "🎉" : counterText}</Text>

        {!found && (
          <Pressable
            onPress={handleCancel}
            accessibilityLabel="Cancelar busca"
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="close" size={18} color={C.white} />
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0e1525",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  radar: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: C.blue,
  },
  sweep: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: "transparent",
    borderTopColor: "rgba(107,159,255,0.85)",
  },
  core: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.blue,
    shadowOpacity: 0.8,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  title: { marginTop: 36, color: C.white, fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  estLabel: { marginTop: 6, color: "rgba(255,255,255,0.55)", fontSize: 12, letterSpacing: 0.4 },
  counter: {
    marginTop: 8,
    color: C.blueLight,
    fontSize: 32,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  cancelBtn: {
    marginTop: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: { color: C.white, fontWeight: "800", fontSize: 14 },
});
