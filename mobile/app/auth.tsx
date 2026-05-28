// Tela-ponte do deep link de auth.
//
// Quando o site redireciona pro app via `exp://.../--/auth?access_token=...
// &refresh_token=...` (Expo Go) ou `barreira://auth?...` (standalone), o
// Expo Router monta esta tela com os tokens em search params. Hidratamos
// a sessão Supabase, fechamos o in-app browser e navegamos pra /perfil.
//
// Por que tela própria (e não handler global em _layout):
//   - O Expo Router roteia qualquer URL do scheme do app — se não houver
//     `app/auth.tsx`, mostra "Unmatched Route" mesmo que tenhamos um
//     listener via Linking.addEventListener.
//   - Aqui o roteamento é nativo: a tela monta com os params na URL.

import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../src/state/auth";

export default function AuthCallback() {
  const params = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
  }>();
  const { setSessionFromTokens } = useAuth();
  // Guarda pra não processar duas vezes (em strict mode / re-mounts)
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;

    const access_token = params.access_token ?? "";
    const refresh_token = params.refresh_token ?? "";

    if (!access_token || !refresh_token) {
      console.warn("[auth-callback] sem tokens, voltando pra home");
      router.replace("/");
      return;
    }

    processed.current = true;
    (async () => {
      console.log("[auth-callback] hidratando sessão");
      const res = await setSessionFromTokens({ access_token, refresh_token });

      // Fecha o in-app browser que ficou aberto (idempotente)
      try {
        await WebBrowser.dismissBrowser();
      } catch {
        /* sem browser aberto, ok */
      }

      router.replace(res.ok ? "/perfil" : "/");
    })();
  }, [params.access_token, params.refresh_token, setSessionFromTokens]);

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
