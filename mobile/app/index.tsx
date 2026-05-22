import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { GridBackground } from "../src/components/GridBackground";
import { playButtonSound, useButtonSound } from "../src/hooks/useButtonSound";

const PRIVACY_ACCEPTED_KEY = "privacy_accepted";

// ─── Palette (home-only) ───────────────────────────────────────────
const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
  gold: "rgba(245,166,35,0.3)",
  goldShadow: "rgba(245,166,35,0.18)",
  cellBg: "#EEF2FF",
  red: "#FF3D6F",
} as const;

type Tab = "offline" | "casual";
type Difficulty = "easy" | "medium" | "hard";

// ─── Component ─────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("casual");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [offlineModal, setOfflineModal] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  useButtonSound(); // preload

  useEffect(() => {
    AsyncStorage.getItem(PRIVACY_ACCEPTED_KEY).then((val) => {
      if (!val) setShowPrivacy(true);
    });
  }, []);

  const onAcceptPrivacy = () => {
    AsyncStorage.setItem(PRIVACY_ACCEPTED_KEY, "1");
    setShowPrivacy(false);
  };

  const onPlay = () => {
    playButtonSound();
    router.push("/online");
  };

  const onStartOffline = () => {
    playButtonSound();
    setOfflineModal(false);
    router.push({ pathname: "/game", params: { difficulty } });
  };

  return (
    <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: 0 }]}>

        {/* ─── Floating elements ─── */}
        <View style={styles.floatingRow}>
          <Pressable
            onPress={() => router.push("/privacy" as never)}
            style={({ pressed }) => [styles.privacyBtn, pressed && styles.btnPressed]}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={C.muted} />
          </Pressable>

          {/* Profile button */}
          <Pressable
            onPress={() => {}}
            style={({ pressed }) => [styles.profileBtn, pressed && styles.btnPressed]}
          >
            <Ionicons name="person" size={20} color={C.white} />
          </Pressable>
        </View>

        {/* ─── Tab content ─── */}
        <View style={styles.content}>
          <GridBackground />
          <TabPane visible={tab === "casual"}>
            <CasualTab onPlay={onPlay} />
          </TabPane>
          <TabPane visible={tab === "offline"}>
            <OfflineTab onPlay={() => { playButtonSound(); setOfflineModal(true); }} />
          </TabPane>
        </View>

        {/* ─── Bottom navbar ─── */}
        <BottomNav tab={tab} setTab={(t) => { playButtonSound(); setTab(t); }} bottomInset={insets.bottom} />

        {/* ─── Difficulty modal ─── */}
        <DifficultyPickerModal
          visible={offlineModal}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          onConfirm={onStartOffline}
          onClose={() => setOfflineModal(false)}
        />

        {/* ─── Privacy consent modal (first launch) ─── */}
        <Modal transparent visible={showPrivacy} animationType="fade" statusBarTranslucent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { maxHeight: "80%" }]}>
              <Ionicons name="shield-checkmark" size={36} color={C.blue} style={{ marginBottom: 8 }} />
              <Text style={styles.modalTitle}>Política de Privacidade</Text>

              <ScrollView style={{ maxHeight: 320, width: "100%" }} showsVerticalScrollIndicator={false}>
                <Text style={styles.privacyText}>
                  O Barreira coleta apenas um identificador de sessão aleatório para
                  permitir reconexão durante partidas online. Não coletamos dados
                  pessoais, não usamos analytics nem publicidade.{"\n\n"}
                  Seu nome de exibição é visível aos oponentes durante a partida e
                  não é armazenado permanentemente.{"\n\n"}
                  Ao continuar, você concorda com nossa Política de Privacidade
                  completa, acessível a qualquer momento no menu do app.
                </Text>
              </ScrollView>

              <Pressable
                onPress={onAcceptPrivacy}
                style={({ pressed }) => [{ width: "100%", marginTop: 16 }, pressed && styles.btnPressed]}
              >
                <LinearGradient
                  colors={[C.blue, C.blueLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalBtnConfirm}
                >
                  <Text style={styles.modalBtnConfirmText}>Aceitar e Continuar</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB PANE (opacity + pointerEvents transition)
// ═══════════════════════════════════════════════════════════════════

const TabPane = ({ visible, children }: { visible: boolean; children: React.ReactNode }) => {
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 150 : 120,
      easing: visible ? Easing.out(Easing.ease) : Easing.in(Easing.ease),
    });
  }, [visible, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[styles.tabContent, animStyle]}
      pointerEvents={visible ? "auto" : "none"}
    >
      {children}
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// CASUAL TAB
// ═══════════════════════════════════════════════════════════════════

const CasualTab = ({ onPlay }: { onPlay: () => void }) => (
  <View style={styles.casualWrap}>
    {/* Logo */}
    <View style={styles.logoRow}>
      <View style={styles.logoIcon}>
        <View style={[styles.logoBar, { height: 18, backgroundColor: C.blue }]} />
        <View style={[styles.logoBar, { height: 26, backgroundColor: C.blueLight }]} />
        <View style={[styles.logoBar, { height: 14, backgroundColor: C.blue }]} />
        <View style={[styles.logoBar, { height: 22, backgroundColor: C.blueLight }]} />
      </View>
      <Text style={styles.wordmark}>BARREIRA</Text>
    </View>
    <Text style={styles.logoSub}>Arena de Batalha</Text>

    {/* Arena card placeholder */}
    <View style={styles.arenaOuter}>
      <LinearGradient
        colors={[C.blue, C.blueLight]}
        style={styles.arenaCard}
      >
        {/* TODO: replace placeholder grid with actual arena tier visual & name */}
        {/* 6x6 grid */}
        <View style={styles.arenaGrid}>
          {Array.from({ length: 36 }).map((_, i) => (
            <View key={i} style={styles.arenaCell} />
          ))}
        </View>
        {/* Pawns */}
        <View style={[styles.arenaPawn, styles.arenaPawnRed]} />
        <View style={[styles.arenaPawn, styles.arenaPawnBlue]} />
        {/* Walls */}
        <View style={[styles.arenaWall, styles.arenaWallH]} />
        <View style={[styles.arenaWall, styles.arenaWallV]} />
      </LinearGradient>
    </View>

    {/* Play button */}
    <Pressable
      onPress={onPlay}
      style={({ pressed }) => [pressed && styles.btnPressed]}
    >
      <LinearGradient
        colors={[C.blue, C.blueLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.playBtn}
      >
        <Ionicons name="play" size={20} color={C.white} />
        <Text style={styles.playBtnText}>JOGAR</Text>
      </LinearGradient>
    </Pressable>
    <Text style={styles.playBtnSub}>Encontrar partida casual</Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// OFFLINE TAB
// ═══════════════════════════════════════════════════════════════════

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Fácil" },
  { key: "medium", label: "Médio" },
  { key: "hard", label: "Difícil" },
];

const OfflineTab = ({ onPlay }: { onPlay: () => void }) => (
  <View style={styles.offlineWrap}>
    <LinearGradient
      colors={[C.blue, C.navy]}
      style={styles.botIcon}
    >
      <Ionicons name="hardware-chip-outline" size={52} color={C.white} />
    </LinearGradient>

    <Text style={styles.offlineTitle}>Treino</Text>

    <Pressable
      onPress={onPlay}
      style={({ pressed }) => [styles.trainBtn, pressed && styles.btnPressed]}
    >
      <Text style={styles.trainBtnText}>JOGAR</Text>
    </Pressable>
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// DIFFICULTY PICKER MODAL
// ═══════════════════════════════════════════════════════════════════

const DifficultyPickerModal = ({
  visible,
  difficulty,
  setDifficulty,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
    <Pressable style={styles.modalBackdrop} onPress={onClose}>
      <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation?.()}>
        <Text style={styles.modalTitle}>Escolha a dificuldade</Text>

        <View style={styles.diffRow}>
          {DIFFICULTIES.map((d) => {
            const active = difficulty === d.key;
            return (
              <Pressable
                key={d.key}
                onPress={() => { playButtonSound(); setDifficulty(d.key); }}
                style={[styles.diffPill, active && styles.diffPillActive]}
              >
                <Text style={[styles.diffPillText, active && styles.diffPillTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.modalActions}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.modalBtnCancel, pressed && styles.btnPressed]}
          >
            <Text style={styles.modalBtnCancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => [{ flex: 1 }, pressed && styles.btnPressed]}
          >
            <LinearGradient
              colors={[C.blue, C.blueLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalBtnConfirm}
            >
              <Text style={styles.modalBtnConfirmText}>Jogar</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

// ═══════════════════════════════════════════════════════════════════
// BOTTOM NAV
// ═══════════════════════════════════════════════════════════════════

const ANIM_CFG = { duration: 200, easing: Easing.out(Easing.ease) };

const NavIcon = ({
  active,
  iconActive,
  iconInactive,
  label,
  onPress,
}: {
  active: boolean;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) => {
  const bubbleSize = useSharedValue(active ? 56 : 36);
  const bubbleOpacity = useSharedValue(active ? 1 : 0.4);
  const liftY = useSharedValue(active ? -20 : 0);

  useEffect(() => {
    bubbleSize.value = withTiming(active ? 56 : 36, ANIM_CFG);
    bubbleOpacity.value = withTiming(active ? 1 : 0.4, ANIM_CFG);
    liftY.value = withTiming(active ? -20 : 0, ANIM_CFG);
  }, [active]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: liftY.value }],
  }));

  const sizeStyle = useAnimatedStyle(() => ({
    width: bubbleSize.value,
    height: bubbleSize.value,
    borderRadius: bubbleSize.value / 2,
    opacity: bubbleOpacity.value,
  }));

  return (
    <Pressable onPress={onPress} style={styles.navItem}>
      <Animated.View style={wrapStyle}>
        <Animated.View style={sizeStyle}>
          <LinearGradient
            colors={[C.blue, C.blueLight]}
            style={styles.navBubbleInner}
          >
            <Ionicons
              name={active ? iconActive : iconInactive}
              size={active ? 26 : 18}
              color={C.white}
            />
          </LinearGradient>
        </Animated.View>
      </Animated.View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
};

// Animated bubble for Casual tab — grows/lifts when active
const CasualBubble = ({ active, onPress }: { active: boolean; onPress: () => void }) => {
  const bubbleSize = useSharedValue(active ? 56 : 36);
  const bubbleOpacity = useSharedValue(active ? 1 : 0.4);
  const liftY = useSharedValue(active ? -20 : 0);

  useEffect(() => {
    bubbleSize.value = withTiming(active ? 56 : 36, ANIM_CFG);
    bubbleOpacity.value = withTiming(active ? 1 : 0.4, ANIM_CFG);
    liftY.value = withTiming(active ? -20 : 0, ANIM_CFG);
  }, [active]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: liftY.value }],
  }));

  const sizeStyle = useAnimatedStyle(() => ({
    width: bubbleSize.value,
    height: bubbleSize.value,
    borderRadius: bubbleSize.value / 2,
    opacity: bubbleOpacity.value,
  }));

  return (
    <Pressable onPress={onPress} style={styles.navItem}>
      <Animated.View style={wrapStyle}>
        <Animated.View style={sizeStyle}>
          <LinearGradient
            colors={[C.blue, C.blueLight]}
            style={styles.navBubbleInner}
          >
            <Ionicons name="flash" size={active ? 26 : 18} color={C.white} />
          </LinearGradient>
        </Animated.View>
      </Animated.View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>
        Casual
      </Text>
    </Pressable>
  );
};

const BottomNav = ({
  tab,
  setTab,
  bottomInset,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  bottomInset: number;
}) => {
  return (
    <View style={[styles.navbar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <NavIcon
        active={tab === "offline"}
        iconActive="game-controller"
        iconInactive="game-controller-outline"
        label="Offline"
        onPress={() => setTab("offline")}
      />

      <CasualBubble active={tab === "casual"} onPress={() => setTab("casual")} />
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  // ─── Floating elements ───
  floatingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 4,
    zIndex: 10,
  },
  privacyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.cellBg,
    alignItems: "center",
    justifyContent: "center",
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.blue,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  // ─── Content area ───
  content: {
    flex: 1,
  },
  tabContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  // ─── CASUAL TAB ───
  casualWrap: {
    alignItems: "center",
    gap: 16,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  logoBar: {
    width: 6,
    borderRadius: 3,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: "900",
    color: C.navy,
    letterSpacing: 3,
  },
  logoSub: {
    fontSize: 12,
    color: C.muted,
    marginTop: -10,
  },
  // Arena card
  arenaOuter: {
    shadowColor: C.blue,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    marginVertical: 8,
  },
  arenaCard: {
    width: 280,
    height: 196,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  arenaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 180,
    gap: 6,
  },
  arenaCell: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  arenaPawn: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  arenaPawnRed: {
    backgroundColor: C.red,
    top: 28,
    right: 50,
  },
  arenaPawnBlue: {
    backgroundColor: C.blue,
    bottom: 28,
    left: 50,
  },
  arenaWall: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 3,
  },
  arenaWallH: {
    width: 48,
    height: 6,
    top: 80,
    left: 40,
  },
  arenaWallV: {
    width: 6,
    height: 48,
    bottom: 60,
    right: 60,
  },
  // Play button
  playBtn: {
    width: 280,
    height: 58,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  playBtnText: {
    color: C.white,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  playBtnSub: {
    fontSize: 11,
    color: C.muted,
    marginTop: -8,
  },
  // ─── OFFLINE TAB ───
  offlineWrap: {
    alignItems: "center",
    gap: 10,
  },
  botIcon: {
    width: 120,
    height: 120,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  botEmoji: {
    fontSize: 52,
  },
  offlineTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: C.navy,
  },
  offlineSub: {
    fontSize: 14,
    color: C.muted,
    marginBottom: 10,
  },
  diffRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    width: 280,
  },
  // ─── Modal ───
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: C.blue,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: C.navy,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    width: "100%",
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: C.cellBg,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnCancelText: {
    color: C.muted,
    fontWeight: "700",
    fontSize: 14,
  },
  modalBtnConfirm: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnConfirmText: {
    color: C.white,
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  privacyText: {
    fontSize: 13,
    color: "#4A5C7A",
    lineHeight: 20,
    textAlign: "left",
  },
  diffPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.muted,
    alignItems: "center",
  },
  diffPillActive: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  diffPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.muted,
  },
  diffPillTextActive: {
    color: C.white,
  },
  trainBtn: {
    width: 280,
    height: 58,
    borderRadius: 18,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  trainBtnText: {
    color: C.white,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  // ─── BOTTOM NAV ───
  navbar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: "rgba(61,111,255,0.08)",
    paddingTop: 8,
    height: 100,
    overflow: "visible",
    shadowColor: C.blue,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    gap: 2,
  },
  navBubbleInner: {
    flex: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: C.white,
    shadowColor: C.blue,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: "hidden",
  },
  navLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.muted,
  },
  navLabelActive: {
    color: C.blue,
    fontWeight: "800",
  },
});
