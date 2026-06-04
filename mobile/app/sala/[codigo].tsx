// === Deep link de sala: https://barreirajogo.com/sala/CODE (Universal/App Links) ===
//
// Destino dos links compartilhados (WhatsApp). Com o app instalado, os
// Universal Links (iOS) / App Links (Android) configurados no app.json fazem
// o SO rotear o https://barreirajogo.com/sala/CODE direto pra esta tela — o
// Expo Router monta o componente com `codigo` (e `pw` opcional) nos params.
//
// NÃO entramos na sala automaticamente (antes a partida começava sozinha).
// Mostramos um card com o botão "Entrar na partida" — só ao tocar é que
// fazemos o join (mesmo joinRoom do lobby) e seguimos pra /online-game.
//
// Por que tela própria (e não handler em _layout): o Expo Router roteia
// qualquer URL do app pelo file-system; sem `app/sala/[codigo].tsx` o link
// cairia em "Unmatched Route". Mesmo padrão do app/auth.tsx.

import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { joinRoom } from "../../src/net/api";
import { errorInfo } from "../../src/net/errors";
import { clearLastGameStart, connectSocket } from "../../src/net/socket";
import { usePlayerName } from "../../src/state/profile";

const C = { blue: "#3D6FFF", navy: "#1A2A4A", muted: "#9AAACA", white: "#FFFFFF", border: "#DDEAFF", bg: "#F0F4FF" };

export default function SalaDeepLink() {
  const params = useLocalSearchParams<{ codigo?: string; pw?: string }>();
  const playerName = usePlayerName();
  const [joining, setJoining] = useState(false);

  const code = (params.codigo ?? "").toUpperCase().trim();
  const password = params.pw ? String(params.pw) : undefined;

  // Garante socket vivo e limpa cache de gameStart antigo (mesmo cuidado do
  // lobby), senão a /online-game poderia ler uma partida anterior.
  useEffect(() => {
    if (!code) {
      router.replace("/online");
      return;
    }
    clearLastGameStart();
    connectSocket();
  }, [code]);

  const enter = async () => {
    if (joining) return;
    setJoining(true);
    const res = await joinRoom({ code, playerName, password });
    if (!res.ok) {
      setJoining(false);
      const info = errorInfo(res.error);
      Alert.alert(info.title, res.message ?? info.message);
      router.replace("/online");
      return;
    }
    router.replace({
      pathname: "/online-game",
      params: password ? { role: "guest", code, password } : { role: "guest", code },
    });
  };

  if (!code) {
    return (
      <View style={styles.root}>
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="game-controller" size={30} color={C.blue} />
        </View>
        <Text style={styles.title}>Convite para partida</Text>
        <Text style={styles.sub}>
          Você foi convidado para jogar na sala <Text style={styles.code}>{code}</Text>.
        </Text>
        <Pressable
          accessibilityLabel="Entrar na partida"
          onPress={enter}
          disabled={joining}
          style={({ pressed }) => [styles.enterBtn, (pressed || joining) && { opacity: 0.85 }]}
        >
          {joining ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.enterText}>Entrar na partida</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityLabel="Agora não"
          onPress={() => router.replace("/")}
          disabled={joining}
          style={styles.cancelBtn}
        >
          <Text style={styles.cancelText}>Agora não</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg, padding: 24 },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 28,
    alignItems: "center",
  },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(61,111,255,0.1)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 19, fontWeight: "800", color: C.navy },
  sub: { fontSize: 13, color: C.muted, textAlign: "center", marginTop: 8 },
  code: { color: C.navy, fontWeight: "800", letterSpacing: 1 },
  enterBtn: { marginTop: 24, width: "100%", paddingVertical: 14, borderRadius: 12, backgroundColor: C.blue, alignItems: "center" },
  enterText: { color: C.white, fontSize: 15, fontWeight: "900" },
  cancelBtn: { marginTop: 8, width: "100%", paddingVertical: 10, alignItems: "center" },
  cancelText: { color: C.muted, fontSize: 13, fontWeight: "700" },
});
