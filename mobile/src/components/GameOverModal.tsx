import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import type { PlayerId } from "@barreira/shared";
import { theme } from "../theme";

type RematchStatus = "idle" | "requesting" | "requested" | "declined" | "expired";

export type GameOverReason = "goal" | "timeout";

type Props = {
  visible: boolean;
  winner: PlayerId | null;
  reason?: GameOverReason;
  onRematch: () => void;
  onBackToMenu: () => void;
  // Online rematch props (optional — omit for local/bot games)
  online?: boolean;
  rematchStatus?: RematchStatus;
  rematchExpiresAt?: number;
  rematchRequesterName?: string;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
  onLeave?: () => void;
};

const useCountdown = (expiresAt: number, active: boolean) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active || !expiresAt) {
      setSeconds(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSeconds(remaining);
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [expiresAt, active]);
  return seconds;
};

export const GameOverModal = ({
  visible,
  winner,
  reason = "goal",
  onRematch,
  onBackToMenu,
  online = false,
  rematchStatus = "idle",
  rematchExpiresAt = 0,
  rematchRequesterName = "",
  onAcceptRematch,
  onDeclineRematch,
  onLeave,
}: Props) => {
  const isVictory = winner === 1;
  const isTimeout = reason === "timeout";

  const title = isVictory
    ? isTimeout ? "Tempo esgotado!" : "Vitória!"
    : isTimeout ? "Tempo esgotado!" : "Derrota";
  const subtitle = isVictory
    ? isTimeout
      ? "O adversário ficou sem tempo."
      : "Você chegou na linha de cima."
    : isTimeout
      ? "Seu tempo acabou."
      : "O adversário cruzou a linha primeiro.";
  const accent = isVictory ? theme.player1 : theme.player2;
  const icon = isVictory
    ? isTimeout ? "timer-outline" : "trophy"
    : isTimeout ? "timer-outline" : "close-circle";

  const countdown = useCountdown(
    rematchExpiresAt,
    online && (rematchStatus === "requesting" || rematchStatus === "requested"),
  );

  // === Render buttons based on mode + status ===
  const renderActions = () => {
    if (!online) {
      // Local mode: simple Menu + Revanche
      return (
        <View style={styles.actions}>
          <Pressable
            onPress={onBackToMenu}
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
          >
            <Ionicons name="home-outline" size={18} color="#1A2A4A" />
            <Text style={styles.btnSecondaryText}>Menu</Text>
          </Pressable>
          <Pressable
            onPress={onRematch}
            style={({ pressed }) => [
              styles.btnPrimary,
              { backgroundColor: accent },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="refresh" size={18} color="#0b1014" />
            <Text style={styles.btnPrimaryText}>Revanche</Text>
          </Pressable>
        </View>
      );
    }

    // Online mode
    switch (rematchStatus) {
      case "idle":
        return (
          <View style={styles.actions}>
            <Pressable
              onPress={onLeave}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            >
              <Ionicons name="exit-outline" size={18} color="#1A2A4A" />
              <Text style={styles.btnSecondaryText}>Sair</Text>
            </Pressable>
            <Pressable
              onPress={onRematch}
              style={({ pressed }) => [
                styles.btnPrimary,
                { backgroundColor: accent },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="refresh" size={18} color="#0b1014" />
              <Text style={styles.btnPrimaryText}>Revanche</Text>
            </Pressable>
          </View>
        );

      case "requesting":
        return (
          <View style={styles.actions}>
            <Pressable
              onPress={onLeave}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            >
              <Ionicons name="exit-outline" size={18} color="#1A2A4A" />
              <Text style={styles.btnSecondaryText}>Sair</Text>
            </Pressable>
            <View style={[styles.btnDisabled]}>
              <Ionicons name="time-outline" size={18} color="#666" />
              <Text style={styles.btnDisabledText}>
                Aguardando... {countdown}s
              </Text>
            </View>
          </View>
        );

      case "requested":
        return (
          <View style={styles.requestedSection}>
            <View style={styles.requestBanner}>
              <Ionicons name="game-controller" size={20} color={theme.player1} />
              <Text style={styles.requestText}>
                {rematchRequesterName} quer uma revanche!
              </Text>
              <Text style={styles.requestCountdown}>{countdown}s</Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={onDeclineRematch}
                style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={18} color={theme.player2} />
                <Text style={[styles.btnSecondaryText, { color: theme.player2 }]}>
                  Recusar
                </Text>
              </Pressable>
              <Pressable
                onPress={onAcceptRematch}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  { backgroundColor: theme.player1 },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="checkmark" size={18} color="#0b1014" />
                <Text style={styles.btnPrimaryText}>Aceitar</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={onLeave}
              style={({ pressed }) => [styles.btnLeaveSmall, pressed && styles.pressed]}
            >
              <Text style={styles.btnLeaveSmallText}>Sair</Text>
            </Pressable>
          </View>
        );

      case "declined":
      case "expired":
        return (
          <View style={styles.actions}>
            <Pressable
              onPress={onLeave}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            >
              <Ionicons name="exit-outline" size={18} color="#1A2A4A" />
              <Text style={styles.btnSecondaryText}>Sair</Text>
            </Pressable>
            <View style={styles.btnDisabled}>
              <Ionicons name="close-circle-outline" size={18} color="#666" />
              <Text style={styles.btnDisabledText}>Pedido recusado</Text>
            </View>
          </View>
        );
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(220)} style={styles.backdrop}>
        <Animated.View
          entering={FadeInDown.duration(360).delay(60)}
          style={styles.card}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: `${accent}1f`, borderColor: accent },
            ]}
          >
            <Ionicons name={icon} size={44} color={accent} />
          </View>

          <Text style={[styles.title, { color: accent }]}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {renderActions()}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// Paleta clara — espelha a do online.tsx pra consistência visual.
const L = {
  navy: "#1A2A4A",
  textSecondary: "#5C6F8F",
  muted: "#9AAACA",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
  cellBg: "#EEF2FF",
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26, 42, 74, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: L.cardBg,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: L.border,
    alignItems: "center",
    shadowColor: L.navy,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  subtitle: {
    color: L.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  btnSecondary: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: L.white,
    borderWidth: 1,
    borderColor: L.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    color: L.navy,
    fontWeight: "700",
    fontSize: 14,
  },
  btnPrimary: {
    flex: 1.4,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: "#0b1014",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  btnDisabled: {
    flex: 1.4,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: L.cellBg,
    borderWidth: 1,
    borderColor: L.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabledText: {
    color: L.muted,
    fontWeight: "700",
    fontSize: 13,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  // === Rematch received section ===
  requestedSection: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  requestBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${theme.player1}1a`,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: "100%",
    borderWidth: 1,
    borderColor: `${theme.player1}55`,
  },
  requestText: {
    color: L.navy,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  requestCountdown: {
    color: theme.player1,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 30,
    textAlign: "right",
  },
  btnLeaveSmall: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  btnLeaveSmallText: {
    color: L.muted,
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
