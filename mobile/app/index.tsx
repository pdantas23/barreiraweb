import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
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
import { playButtonSound, useButtonSound, setSfxEnabledForSounds } from "../src/hooks/useButtonSound";
import { setSfxEnabledForPiece } from "../src/hooks/usePieceSound";
import { setSfxEnabledForWall } from "../src/hooks/useWallSound";
import { useMenuMusic } from "../src/hooks/useMenuMusic";
import { useCallback } from "react";
import { useAudioSettings } from "../src/state/audioSettings";

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
  const [showSettings, setShowSettings] = useState(false);
  const { musicEnabled, sfxEnabled, setMusicEnabled, setSfxEnabled } = useAudioSettings();
  useButtonSound(); // preload
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useMenuMusic(musicEnabled && focused);

  // Sync sfx flag to all sound modules
  useEffect(() => {
    setSfxEnabledForSounds(sfxEnabled);
    setSfxEnabledForPiece(sfxEnabled);
    setSfxEnabledForWall(sfxEnabled);
  }, [sfxEnabled]);

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
            onPress={() => { playButtonSound(); setShowSettings(true); }}
            style={({ pressed }) => [styles.settingsBtn, pressed && styles.btnPressed]}
          >
            <Ionicons name="settings-outline" size={20} color={C.muted} />
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
        {/* ─── Settings modal ─── */}
        <Modal transparent visible={showSettings} animationType="fade" statusBarTranslucent>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowSettings(false)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation?.()}>
              <Ionicons name="settings" size={32} color={C.blue} style={{ marginBottom: 8 }} />
              <Text style={styles.modalTitle}>Configurações</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="musical-notes" size={20} color={C.navy} />
                  <Text style={styles.settingLabel}>Música</Text>
                </View>
                <Pressable
                  onPress={() => setMusicEnabled(!musicEnabled)}
                  style={[styles.toggle, musicEnabled && styles.toggleActive]}
                >
                  <View style={[styles.toggleThumb, musicEnabled && styles.toggleThumbActive]} />
                </Pressable>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons name="volume-high" size={20} color={C.navy} />
                  <Text style={styles.settingLabel}>Efeitos sonoros</Text>
                </View>
                <Pressable
                  onPress={() => setSfxEnabled(!sfxEnabled)}
                  style={[styles.toggle, sfxEnabled && styles.toggleActive]}
                >
                  <View style={[styles.toggleThumb, sfxEnabled && styles.toggleThumbActive]} />
                </Pressable>
              </View>

              <Pressable
                onPress={() => { setShowSettings(false); router.push("/privacy" as never); }}
                style={styles.settingRow}
              >
                <View style={styles.settingInfo}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={C.navy} />
                  <Text style={styles.settingLabel}>Política de Privacidade</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </Pressable>

              <Pressable
                onPress={() => setShowSettings(false)}
                style={({ pressed }) => [styles.settingsCloseBtn, pressed && styles.btnPressed]}
              >
                <Text style={styles.settingsCloseBtnText}>Fechar</Text>
              </Pressable>
            </Pressable>
          </Pressable>
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
    <Text style={styles.wordmark}>BARREIRA</Text>

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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const NavTab = ({
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
  const mt = useSharedValue(active ? -12 : 0);
  const h = useSharedValue(active ? 82 : 70);

  useEffect(() => {
    mt.value = withTiming(active ? -12 : 0, ANIM_CFG);
    h.value = withTiming(active ? 82 : 70, ANIM_CFG);
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    marginTop: mt.value,
    height: h.value,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        styles.navTab,
        active && styles.navTabActive,
        animStyle,
      ]}
    >
      <Ionicons
        name={active ? iconActive : iconInactive}
        size={active ? 28 : 22}
        color={active ? C.blue : C.muted}
      />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>
        {label}
      </Text>
    </AnimatedPressable>
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
      <NavTab
        active={tab === "offline"}
        iconActive="game-controller"
        iconInactive="game-controller-outline"
        label="Treino"
        onPress={() => setTab("offline")}
      />
      <NavTab
        active={tab === "casual"}
        iconActive="flash"
        iconInactive="flash-outline"
        label="Casual"
        onPress={() => setTab("casual")}
      />
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
  settingsBtn: {
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
  // ─── SETTINGS MODAL ───
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.cellBg,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: C.navy,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D1D5DB",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: C.blue,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.white,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  settingsCloseBtn: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: C.cellBg,
  },
  settingsCloseBtnText: {
    color: C.muted,
    fontWeight: "700",
    fontSize: 14,
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
    alignItems: "flex-start",
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: "rgba(61,111,255,0.08)",
    height: 70,
    overflow: "visible",
    shadowColor: C.blue,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  navTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  navTabActive: {
    backgroundColor: C.white,
    borderTopWidth: 3,
    borderTopColor: C.blue,
    shadowColor: C.blue,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 4,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: C.muted,
  },
  navLabelActive: {
    fontSize: 11,
    color: C.blue,
    fontWeight: "800",
  },
});
