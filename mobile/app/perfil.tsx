// Tela de perfil nativa — espelha web/src/pages/Profile.tsx.
//
// Acessível em /perfil (Expo Router). Mostra avatar (inicial), username,
// email, troféus casual e botão de sair. Anônimos são redirecionados pra
// home (no web vai pra /login, mas no app não temos tela de login — fica
// fora se o usuário não vinculou conta).

import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../src/state/auth";
import { playButtonSound } from "../src/hooks/useButtonSound";

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
  border: "#DDEAFF",
  gold: "#F4B619",
  goldBg: "#FFF6D6",
  trayBg: "#EEF2FF",
} as const;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, username, trofeusCasual, signOut, loading } = useAuth();

  // Anônimos não deveriam chegar aqui (TopBar só leva pra cá quando logado).
  // Mas em casos de logout inesperado / sessão expirada, manda pra home.
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user]);

  const onSignOut = async () => {
    playButtonSound();
    await signOut();
    router.replace("/");
  };

  // Quando o user chega aqui via deep link (cold start ou após auth callback),
  // não tem history — router.back() não consegue voltar. Cai pra replace("/").
  const onBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const initial = (username ?? user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header: voltar + título "PERFIL" */}
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={28} color={C.navy} />
          </Pressable>
          <Text style={styles.title}>PERFIL</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {/* Avatar + identidade */}
          <View style={styles.identityBlock}>
            <LinearGradient
              colors={[C.blue, C.blueLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </LinearGradient>
            <Text style={styles.username}>{username ?? "—"}</Text>
            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={13} color={C.muted} />
              <Text style={styles.email}>{user?.email ?? ""}</Text>
            </View>
          </View>

          {/* Card de troféus */}
          <View style={styles.trophyCard}>
            <View style={styles.trophyIcon}>
              <Ionicons name="trophy" size={28} color={C.gold} />
            </View>
            <View style={styles.trophyInfo}>
              <Text style={styles.trophyLabel}>Troféus Casual</Text>
              <Text style={styles.trophyValue}>{trofeusCasual ?? 0}</Text>
              <Text style={styles.trophyHint}>+1 por vitória em partida online</Text>
            </View>
          </View>

          {/* Placeholder pra estatísticas futuras */}
          <View style={styles.placeholderCard}>
            <Ionicons name="person-circle" size={28} color={C.muted} />
            <Text style={styles.placeholderText}>
              Mais estatísticas em breve (partidas, vitórias, ranking).
            </Text>
          </View>

          <Pressable
            onPress={onSignOut}
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
          >
            <Ionicons name="log-out-outline" size={18} color={C.navy} />
            <Text style={styles.signOutText}>Sair da conta</Text>
          </Pressable>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontFamily: "BebasNeue_400Regular",
    fontSize: 32,
    color: C.blue,
    letterSpacing: 3,
    textAlign: "center",
    fontWeight: "700",
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  identityBlock: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: C.blue,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatarText: {
    fontFamily: "BebasNeue_400Regular",
    color: C.white,
    fontSize: 48,
    letterSpacing: 1,
    fontWeight: "700",
  },
  username: {
    color: C.navy,
    fontSize: 22,
    fontWeight: "800",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  email: {
    color: C.muted,
    fontSize: 12,
  },
  trophyCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 12,
  },
  trophyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.goldBg,
    alignItems: "center",
    justifyContent: "center",
  },
  trophyInfo: {
    flex: 1,
  },
  trophyLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  trophyValue: {
    color: C.navy,
    fontSize: 28,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    lineHeight: 32,
  },
  trophyHint: {
    color: C.muted,
    fontSize: 11,
    marginTop: 2,
  },
  placeholderCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    opacity: 0.7,
  },
  placeholderText: {
    color: C.muted,
    fontSize: 12,
    flex: 1,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.trayBg,
  },
  signOutText: {
    color: C.navy,
    fontWeight: "800",
    fontSize: 14,
  },
  pressed: {
    opacity: 0.6,
  },
});
