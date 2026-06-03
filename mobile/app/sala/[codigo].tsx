// === Deep link de sala: barreira://sala/CODE e https://barreirajogo.com/sala/CODE ===
//
// Destino dos links compartilhados (WhatsApp). Com o app instalado, os
// Universal Links (iOS) / App Links (Android) configurados no app.json fazem
// o SO rotear o https://barreirajogo.com/sala/CODE direto pra esta tela — o
// Expo Router monta o componente com `codigo` (e `pw` opcional) nos params.
//
// Fluxo: entra na sala como convidado (mesmo joinRoom do lobby) e segue pra
// /online-game. Em erro (sala cheia/inexistente/senha), avisa e cai no lobby.
//
// Por que tela própria (e não handler em _layout): o Expo Router roteia
// qualquer URL do app pelo file-system; sem `app/sala/[codigo].tsx` o link
// cairia em "Unmatched Route". Mesmo padrão do app/auth.tsx.

import { useEffect, useRef } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { joinRoom } from "../../src/net/api";
import { errorInfo } from "../../src/net/errors";
import { clearLastGameStart, connectSocket } from "../../src/net/socket";
import { usePlayerName } from "../../src/state/profile";

export default function SalaDeepLink() {
  const params = useLocalSearchParams<{ codigo?: string; pw?: string }>();
  const playerName = usePlayerName();
  // Evita join duplo em re-mount / strict mode.
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;

    const code = (params.codigo ?? "").toUpperCase().trim();
    const password = params.pw ? String(params.pw) : undefined;

    if (!code) {
      router.replace("/online");
      return;
    }

    processed.current = true;
    // Garante socket vivo e limpa cache de gameStart antigo (mesmo cuidado
    // do lobby), senão a /online-game poderia ler uma partida anterior.
    clearLastGameStart();
    connectSocket();

    (async () => {
      const res = await joinRoom({ code, playerName, password });
      if (!res.ok) {
        const info = errorInfo(res.error);
        Alert.alert(info.title, res.message ?? info.message);
        router.replace("/online");
        return;
      }
      router.replace({
        pathname: "/online-game",
        params: password
          ? { role: "guest", code, password }
          : { role: "guest", code },
      });
    })();
  }, [params.codigo, params.pw, playerName]);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color="#3D6FFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F4FF",
  },
});
