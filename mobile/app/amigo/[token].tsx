// === Deep link de amizade: barreira://amigo/TOKEN e https://barreirajogo.com/amigo/TOKEN ===
//
// Destino do link de convite compartilhado. Com o app instalado, o scheme
// custom (barreira://) ou os Universal/App Links abrem esta tela direto.
//
// Fluxo: resgata o token (cria pedido do DONO do link → este usuário) e mostra
// um Alert nativo "X quer ser seu amigo" — é só aceitar. Em erro (expirado/
// inválido/já amigos), avisa e volta pra home.
//
// Por que tela própria (e não handler em _layout): o Expo Router roteia
// qualquer URL do app pelo file-system; sem `app/amigo/[token].tsx` o link
// cairia em "Unmatched Route". Mesmo padrão do app/sala/[codigo].tsx.

import { useEffect, useRef } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/state/auth";
import { connectSocket } from "../../src/net/socket";
import { acceptFriendRequest, declineFriendRequest, redeemFriendInvite } from "../../src/net/api";

export default function AmigoDeepLink() {
  const params = useLocalSearchParams<{ token?: string }>();
  const { user, loading } = useAuth();
  // Evita resgate duplo em re-mount / strict mode.
  const processed = useRef(false);

  useEffect(() => {
    // Espera a sessão hidratar antes de decidir (cold start via deep link).
    if (loading || processed.current) return;

    const token = (params.token ?? "").trim();
    if (!token) {
      router.replace("/");
      return;
    }

    if (!user) {
      processed.current = true;
      Alert.alert("Entrar", "Faça login para adicionar o amigo.", [
        { text: "OK", onPress: () => router.replace("/perfil") },
      ]);
      return;
    }

    processed.current = true;
    connectSocket();

    (async () => {
      const res = await redeemFriendInvite(token);
      if (!res.ok) {
        const msg =
          res.error === "invite-expired"
            ? "Este link de convite expirou."
            : res.error === "already-friends"
              ? "Vocês já são amigos."
              : res.error === "self-friend"
                ? "Esse é o seu próprio link de convite."
                : res.message ?? "Link de convite inválido.";
        Alert.alert("Convite de amizade", msg, [{ text: "OK", onPress: () => router.replace("/") }]);
        return;
      }
      const from = res.data.fromUsername;
      Alert.alert(
        "Convite de amizade",
        `${from} quer ser seu amigo!`,
        [
          // Recusar: recusa o pedido criado pelo link.
          { text: "Recusar", style: "destructive", onPress: () => { void declineFriendRequest(from); router.replace("/"); } },
          // Fechar sem decidir: o pedido fica em "recebidos" pra aceitar depois.
          { text: "Agora não", style: "cancel", onPress: () => router.replace("/") },
          { text: "Aceitar", onPress: async () => { await acceptFriendRequest(from); router.replace("/"); } },
        ],
        { cancelable: true, onDismiss: () => router.replace("/") },
      );
    })();
  }, [loading, user, params.token]);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color="#3D6FFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F0F4FF" },
});
