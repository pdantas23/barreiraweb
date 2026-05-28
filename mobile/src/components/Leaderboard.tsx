// Leaderboard nativo do lobby — espelha web/src/components/Leaderboard.tsx.
//
// Lê top 10 de profiles via Supabase (RLS permite leitura anônima). Quando
// o user não tem conta (anônimo no app), mostra o ranking borrado com CTA
// "Entrar pra ver" — clique abre o site no in-app browser pro fluxo de
// cadastro/login (mesmo deep link da TopBar).

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { supabase } from "../net/supabase";
import { useAuth } from "../state/auth";
import { playButtonSound } from "../hooks/useButtonSound";

const C = {
  blue: "#3D6FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  border: "#DDEAFF",
  borderSoft: "#F0F4FF",
  gold: "#F4B619",
  goldBg: "#FFF6D6",
  silverBg: "#EEF2F6",
  silver: "#7B8794",
  bronzeBg: "#FBE7D8",
  bronze: "#A65A2C",
  red: "#FF3D6F",
  meBg: "rgba(61,111,255,0.08)",
} as const;

const TOP_LIMIT = 10;

type Entry = { username: string; trofeus_casual: number };

export const Leaderboard = () => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, username: myUsername } = useAuth();
  const isLogged = !!user;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, trofeus_casual")
        .order("trofeus_casual", { ascending: false })
        .order("username", { ascending: true })
        .limit(TOP_LIMIT);

      if (cancelled) return;
      if (error) {
        console.warn("[leaderboard]", error.message);
        setError("Não foi possível carregar o ranking.");
        setEntries([]);
      } else {
        setEntries((data ?? []) as Entry[]);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openSiteForLogin = async () => {
    playButtonSound();
    const base =
      (Constants.expoConfig?.extra?.serverUrl as string | undefined) ??
      "https://barreirajogo.com";
    const redirect = Linking.createURL("/auth");
    const url = `${base}/login?from=app&redirect=${encodeURIComponent(redirect)}`;
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: C.white,
        controlsColor: C.blue,
        dismissButtonStyle: "done",
      });
    } catch {
      /* ignora — fallback silencioso */
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy" size={14} color={C.gold} />
          <Text style={styles.headerTitle}>LEADERBOARD</Text>
        </View>
        <Text style={styles.headerHint}>Top {TOP_LIMIT}</Text>
      </View>

      {/* Body */}
      <View>
        {loading ? (
          <View style={styles.statePad}>
            <ActivityIndicator size="small" color={C.muted} />
          </View>
        ) : error ? (
          <View style={styles.statePad}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.statePad}>
            <Text style={styles.emptyTitle}>Nenhum jogador ainda.</Text>
            <Text style={styles.emptySub}>Cadastre uma conta pra aparecer aqui.</Text>
          </View>
        ) : (
          entries.map((e, i) => {
            const rank = i + 1;
            const isMe =
              !!myUsername &&
              e.username.toLowerCase() === myUsername.toLowerCase();
            return (
              <View
                key={`${e.username}-${rank}`}
                style={[
                  styles.row,
                  i < entries.length - 1 && styles.rowDivider,
                  isMe && styles.rowMe,
                ]}
              >
                <RankBadge rank={rank} />
                <Text
                  numberOfLines={1}
                  style={[styles.username, isMe && styles.usernameMe]}
                >
                  {e.username}
                  {isMe && <Text style={styles.usernameYou}> (você)</Text>}
                </Text>
                <View style={styles.trophyChip}>
                  <Ionicons name="trophy" size={10} color={C.gold} />
                  <Text style={styles.trophyText}>{e.trofeus_casual}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Gate pra anônimos: blur sobre o conteúdo + CTA pra criar conta */}
      {!isLogged && !loading && !error && entries.length > 0 && (
        <BlurView intensity={18} tint="light" style={styles.gate}>
          <View style={styles.gateContent}>
            <Ionicons name="lock-closed" size={22} color={C.blue} />
            <Text style={styles.gateTitle}>Crie uma conta pra competir</Text>
            <Text style={styles.gateSub}>
              Pontuação e ranking aparecem só pra contas cadastradas.
            </Text>
            <Pressable
              onPress={openSiteForLogin}
              style={({ pressed }) => [
                styles.gateBtn,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.gateBtnText}>Entrar pra ver</Text>
              <Ionicons name="arrow-forward" size={14} color={C.white} />
            </Pressable>
          </View>
        </BlurView>
      )}
    </View>
  );
};

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) {
    return (
      <View style={[styles.medal, { backgroundColor: C.goldBg }]}>
        <Ionicons name="trophy" size={11} color={"#C49000"} />
      </View>
    );
  }
  if (rank === 2) {
    return (
      <View style={[styles.medal, { backgroundColor: C.silverBg }]}>
        <Ionicons name="trophy" size={11} color={C.silver} />
      </View>
    );
  }
  if (rank === 3) {
    return (
      <View style={[styles.medal, { backgroundColor: C.bronzeBg }]}>
        <Ionicons name="trophy" size={11} color={C.bronze} />
      </View>
    );
  }
  return (
    <View style={styles.rankPlain}>
      <Text style={styles.rankPlainText}>{rank}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: C.blue,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: "#F5F8FF",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: C.navy,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  headerHint: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statePad: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  errorText: {
    color: C.red,
    fontSize: 12,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 13,
    fontWeight: "700",
  },
  emptySub: {
    color: C.muted,
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.borderSoft,
  },
  rowMe: {
    backgroundColor: C.meBg,
  },
  username: {
    flex: 1,
    marginLeft: 10,
    color: C.navy,
    fontSize: 13,
    fontWeight: "600",
  },
  usernameMe: {
    color: C.blue,
    fontWeight: "800",
  },
  usernameYou: {
    color: C.muted,
    fontWeight: "400",
    fontSize: 10,
  },
  trophyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trophyText: {
    color: C.blue,
    fontSize: 13,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  medal: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rankPlain: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  rankPlainText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  gate: {
    position: "absolute",
    top: 38, // pula o header
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    // bg sutil pra reforçar o gate sem cobrir o blur
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  gateContent: {
    alignItems: "center",
  },
  gateTitle: {
    color: C.navy,
    fontWeight: "800",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  gateSub: {
    color: C.muted,
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
    marginBottom: 14,
  },
  gateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: C.blue,
  },
  gateBtnText: {
    color: C.white,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
