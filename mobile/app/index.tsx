import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { DifficultyModal, type Difficulty } from "../src/components/DifficultyModal";
import { ProfileButton } from "../src/components/ProfileButton";
import { theme } from "../src/theme";

type ModeKey = "cpu" | "casual" | "ranked";

type Mode = {
  key: ModeKey;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  available: boolean;
};

const MODES: Mode[] = [
  {
    key: "cpu",
    label: "Usuário x CPU",
    sub: "Treine contra o bot, 3 níveis",
    icon: "hardware-chip-outline",
    available: true,
  },
  {
    key: "casual",
    label: "Casual",
    sub: "Partidas online sem ranking",
    icon: "people-outline",
    available: false,
  },
  {
    key: "ranked",
    label: "Rankeada",
    sub: "Suba no ranking competitivo",
    icon: "trophy-outline",
    available: false,
  },
];

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const [modalOpen, setModalOpen] = useState(false);

  const onModePress = (mode: Mode) => {
    if (!mode.available) {
      Alert.alert(mode.label, "Modo em desenvolvimento 🚧");
      return;
    }
    if (mode.key === "cpu") setModalOpen(true);
  };

  const onConfirmDifficulty = (difficulty: Difficulty) => {
    setModalOpen(false);
    router.push({ pathname: "/game", params: { difficulty } });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      {/* Fundos decorativos: dois círculos sutis pra dar profundidade ao chapado */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ width: 44 }} />
        <View style={{ flex: 1 }} />
        <ProfileButton />
      </View>

      {/* Logo / título */}
      <Animated.View entering={FadeInDown.duration(450).delay(80)} style={styles.brand}>
        <View style={styles.logoBadge}>
          <View style={[styles.wallSample, styles.wallH]} />
          <View style={[styles.wallSample, styles.wallV]} />
        </View>
        <Text style={styles.brandName}>BARREIRA</Text>
        <Text style={styles.brandTag}>Quoridor mobile</Text>
      </Animated.View>

      {/* Lista de modos */}
      <Animated.View entering={FadeIn.duration(500).delay(200)} style={styles.modes}>
        {MODES.map((m, i) => (
          <Animated.View
            key={m.key}
            entering={FadeInUp.duration(450).delay(260 + i * 90)}
          >
            <Pressable
              onPress={() => onModePress(m)}
              style={({ pressed }) => [
                styles.modeCard,
                !m.available && styles.modeDisabled,
                pressed && m.available && styles.modePressed,
              ]}
            >
              <View
                style={[
                  styles.modeIcon,
                  !m.available && { backgroundColor: "#1f1f27" },
                ]}
              >
                <Ionicons
                  name={m.icon}
                  size={24}
                  color={m.available ? theme.player1 : "#555"}
                />
              </View>
              <View style={styles.modeBody}>
                <Text
                  style={[
                    styles.modeLabel,
                    !m.available && styles.modeLabelDisabled,
                  ]}
                >
                  {m.label}
                </Text>
                <Text
                  style={[
                    styles.modeSub,
                    !m.available && { color: "#555" },
                  ]}
                >
                  {m.sub}
                </Text>
              </View>
              {m.available ? (
                <Ionicons name="chevron-forward" size={22} color={theme.textMuted} />
              ) : (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonBadgeText}>EM BREVE</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.Text
        entering={FadeIn.duration(600).delay(700)}
        style={styles.footerHint}
      >
        v0.1 · single-player local
      </Animated.Text>

      <DifficultyModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={onConfirmDifficulty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 20,
  },
  glowTop: {
    position: "absolute",
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: theme.player1,
    opacity: 0.07,
  },
  glowBottom: {
    position: "absolute",
    bottom: -160,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: theme.player2,
    opacity: 0.06,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 36,
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: theme.boardBg,
    borderWidth: 1,
    borderColor: "#2a2a35",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: theme.player1,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  wallSample: {
    position: "absolute",
    backgroundColor: theme.player1,
    borderRadius: 3,
  },
  wallH: {
    width: 56,
    height: 7,
    transform: [{ translateY: -14 }],
  },
  wallV: {
    width: 7,
    height: 56,
    transform: [{ translateX: 14 }],
    backgroundColor: theme.player2,
  },
  brandName: {
    color: theme.textPrimary,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 6,
  },
  brandTag: {
    color: theme.textMuted,
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  modes: {
    gap: 12,
    marginTop: 8,
  },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.boardBg,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#2a2a35",
  },
  modeDisabled: {
    backgroundColor: "#16161c",
    borderColor: "#22222b",
  },
  modePressed: {
    transform: [{ scale: 0.98 }],
    borderColor: theme.player1,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1a1d28",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  modeBody: {
    flex: 1,
  },
  modeLabel: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  modeLabelDisabled: {
    color: "#777",
  },
  modeSub: {
    color: theme.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  soonBadge: {
    backgroundColor: "#1f1f27",
    borderWidth: 1,
    borderColor: "#33384a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  soonBadgeText: {
    color: theme.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  footerHint: {
    marginTop: "auto",
    color: theme.textMuted,
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 1,
    opacity: 0.6,
  },
});
