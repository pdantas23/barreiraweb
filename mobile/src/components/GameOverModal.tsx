import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import type { PlayerId } from "../game/types";
import { theme } from "../theme";

type Props = {
  visible: boolean;
  winner: PlayerId | null;
  onRematch: () => void;
  onBackToMenu: () => void;
};

export const GameOverModal = ({ visible, winner, onRematch, onBackToMenu }: Props) => {
  const isVictory = winner === 1;
  const title = isVictory ? "Vitória!" : "Derrota";
  const subtitle = isVictory
    ? "Você chegou na linha de cima."
    : "O adversário cruzou a linha primeiro.";
  const accent = isVictory ? theme.player1 : theme.player2;
  const icon = isVictory ? "trophy" : "close-circle";

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

          <View style={styles.actions}>
            <Pressable
              onPress={onBackToMenu}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            >
              <Ionicons name="home-outline" size={18} color={theme.textMuted} />
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
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: theme.boardBg,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: "#2a2a35",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
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
    color: theme.textMuted,
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
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3a3a48",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    color: theme.textMuted,
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
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
