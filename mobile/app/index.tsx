import { useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

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
  disabled: "#CCCCCC",
  disabledBg: "#BBBBBB",
  red: "#FF3D6F",
} as const;

type Tab = "offline" | "casual" | "ranked";
type Difficulty = "easy" | "medium" | "hard";

// ─── Component ─────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("casual");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  const onPlay = () => {
    router.push("/online");
  };

  const onTrain = () => {
    router.push({ pathname: "/game", params: { difficulty } });
  };

  return (
    <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: 0 }]}>

        {/* ─── Floating elements ─── */}
        <View style={styles.floatingRow}>
          {/* Trophy chip */}
          <View style={styles.trophyChip}>
            <Text style={styles.trophyEmoji}>🏆</Text>
            {/* TODO: replace hardcoded "0" with actual trophy count */}
            <Text style={styles.trophyCount}>0</Text>
          </View>

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
          {tab === "casual" && (
            <Animated.View
              key="casual"
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              style={styles.tabContent}
            >
              <CasualTab onPlay={onPlay} />
            </Animated.View>
          )}
          {tab === "offline" && (
            <Animated.View
              key="offline"
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              style={styles.tabContent}
            >
              <OfflineTab difficulty={difficulty} setDifficulty={setDifficulty} onTrain={onTrain} />
            </Animated.View>
          )}
          {tab === "ranked" && (
            <Animated.View
              key="ranked"
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              style={styles.tabContent}
            >
              <RankedTab />
            </Animated.View>
          )}
        </View>

        {/* ─── Bottom navbar ─── */}
        <BottomNav tab={tab} setTab={setTab} bottomInset={insets.bottom} />
      </View>
    </LinearGradient>
  );
}

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

const OfflineTab = ({
  difficulty,
  setDifficulty,
  onTrain,
}: {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  onTrain: () => void;
}) => (
  <View style={styles.offlineWrap}>
    {/* Bot icon */}
    <LinearGradient
      colors={[C.blue, C.navy]}
      style={styles.botIcon}
    >
      <Text style={styles.botEmoji}>🤖</Text>
    </LinearGradient>

    <Text style={styles.offlineTitle}>Treino</Text>
    <Text style={styles.offlineSub}>Jogue contra a IA. Sem pressão.</Text>

    {/* Difficulty selector */}
    <Text style={styles.diffLabel}>DIFICULDADE</Text>
    <View style={styles.diffRow}>
      {DIFFICULTIES.map((d) => {
        const active = difficulty === d.key;
        return (
          <Pressable
            key={d.key}
            onPress={() => setDifficulty(d.key)}
            style={[styles.diffPill, active && styles.diffPillActive]}
          >
            <Text style={[styles.diffPillText, active && styles.diffPillTextActive]}>
              {d.label}
            </Text>
          </Pressable>
        );
      })}
    </View>

    {/* Train button */}
    <Pressable
      onPress={onTrain}
      style={({ pressed }) => [styles.trainBtn, pressed && styles.btnPressed]}
    >
      <Text style={styles.trainBtnText}>🤖 TREINAR</Text>
    </Pressable>
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// RANKED TAB (locked)
// ═══════════════════════════════════════════════════════════════════

const RankedTab = () => (
  <View style={styles.rankedWrap}>
    <Text style={styles.rankedEmoji}>🏆</Text>
    <Text style={styles.rankedTitle}>Ranqueado</Text>
    <Text style={styles.rankedSub}>Em breve...</Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// BOTTOM NAV
// ═══════════════════════════════════════════════════════════════════

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
      {/* Offline */}
      <Pressable
        onPress={() => setTab("offline")}
        style={styles.navItem}
      >
        <Ionicons
          name={tab === "offline" ? "game-controller" : "game-controller-outline"}
          size={tab === "offline" ? 28 : 24}
          color={tab === "offline" ? C.blue : C.muted}
        />
        <Text style={[styles.navLabel, tab === "offline" && styles.navLabelActive]}>
          Offline
        </Text>
      </Pressable>

      {/* Casual (center bubble) */}
      <Pressable
        onPress={() => setTab("casual")}
        style={styles.navItemCenter}
      >
        <LinearGradient
          colors={[C.blue, C.blueLight]}
          style={[
            styles.navBubble,
            tab !== "casual" && { opacity: 0.4 },
          ]}
        >
          <Ionicons name="flash" size={26} color={C.white} />
        </LinearGradient>
        <Text style={[styles.navLabel, tab === "casual" && styles.navLabelActive]}>
          Casual
        </Text>
      </Pressable>

      {/* Ranked (disabled) */}
      <View style={styles.navItem}>
        <Ionicons
          name="trophy-outline"
          size={24}
          color={C.disabled}
        />
        <Text style={styles.navLabelDisabled}>Ranqueado</Text>
        <Text style={styles.navSoon}>Em Breve</Text>
      </View>
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
  trophyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.gold,
    shadowColor: C.goldShadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  trophyEmoji: { fontSize: 16 },
  trophyCount: {
    fontSize: 14,
    fontWeight: "800",
    color: C.navy,
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
    flex: 1,
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
  diffLabel: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: 2,
    fontWeight: "600",
  },
  diffRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  diffPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.muted,
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
  // ─── RANKED TAB ───
  rankedWrap: {
    alignItems: "center",
    gap: 8,
  },
  rankedEmoji: {
    fontSize: 64,
    opacity: 0.4,
  },
  rankedTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: C.disabledBg,
  },
  rankedSub: {
    fontSize: 14,
    color: C.disabled,
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
  navItemCenter: {
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    marginTop: -20,
    gap: 2,
  },
  navBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: C.white,
    shadowColor: C.blue,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
  navLabelDisabled: {
    fontSize: 11,
    fontWeight: "600",
    color: C.disabled,
  },
  navSoon: {
    fontSize: 8,
    color: C.disabled,
    fontWeight: "600",
  },
});
