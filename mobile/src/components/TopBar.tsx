// Top bar branca full-width — espelha o header da web (Home.tsx).
// Logo "BARREIRA" (Bebas Neue, azul) à esquerda; perfil + engrenagem à direita.
// Quando o user não tem conta vinculada, mostra "Entrar" ao lado do botão de
// perfil. Quando logado, mostra o nome. (A detecção de "logado" virá depois,
// quando o sistema de vinculação clientId↔conta estiver pronto — por ora
// sempre tratamos como anônimo.)

import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { getClientId } from "../net/clientId";
import { playButtonSound } from "../hooks/useButtonSound";
import { useAuth } from "../state/auth";

const C = {
  blue: "#3D6FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  border: "rgba(61, 111, 255, 0.08)", // brand/8 da web
  cellBg: "#EEF2FF",
} as const;

type Props = {
  onSettingsPress: () => void;
};

export const TopBar = ({ onSettingsPress }: Props) => {
  const { user, username } = useAuth();
  const insets = useSafeAreaInsets();
  const isLogged = !!user;

  const onProfilePress = async () => {
    playButtonSound();
    // Logado: abre tela nativa de perfil. Anônimo: abre site no in-app
    // browser; após login/cadastro o site faz redirect via deep link
    // barreira://auth?... que _layout.tsx captura e hidrata a sessão.
    if (isLogged) {
      router.push("/perfil");
      return;
    }

    const base =
      (Constants.expoConfig?.extra?.serverUrl as string | undefined) ??
      "https://barreirajogo.com";
    // redirect = URL de deep link do app. Em Expo Go vira exp://...; em build
    // standalone vira barreira://auth. O site usa pra redirecionar de volta.
    const redirect = Linking.createURL("/auth");
    const url = `${base}/login?from=app&redirect=${encodeURIComponent(redirect)}`;
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: C.white,
        controlsColor: C.blue,
        dismissButtonStyle: "done",
      });
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert(
          "Não foi possível abrir",
          "Tente acessar barreirajogo.com no navegador pra criar sua conta.",
        );
      }
    }
  };
  // clientId pode ser útil futuro (linkagem manual) — mantém referência
  // pra não quebrar import caso seja removido por linter.
  void getClientId;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 12 }]}>
      {/* Força a status bar com ícones escuros sobre o fundo branco da
          TopBar. backgroundColor só faz efeito no Android — no iOS o
          padding acima já desenha o branco até o topo da safe area. */}
      <StatusBar style="dark" backgroundColor={C.white} translucent={false} />

      {/* Logo */}
      <View style={styles.left}>
        <Text style={styles.logo}>BARREIRA</Text>
      </View>

      {/* Auth + settings */}
      <View style={styles.right}>
        <Pressable
          onPress={onProfilePress}
          style={({ pressed }) => [styles.profileBtn, pressed && styles.btnPressed]}
        >
          <Ionicons name="person" size={14} color={C.blue} />
          <Text style={styles.profileBtnText} numberOfLines={1}>
            {isLogged ? username ?? "Perfil" : "Entrar"}
          </Text>
        </Pressable>

        {isLogged && (
          <Pressable
            accessibilityLabel="Amigos"
            onPress={() => {
              playButtonSound();
              router.push("/amigos" as never);
            }}
            style={({ pressed }) => [styles.settingsBtn, pressed && styles.btnPressed]}
          >
            <Ionicons name="people" size={16} color={C.blue} />
          </Pressable>
        )}

        <Pressable
          onPress={() => {
            playButtonSound();
            onSettingsPress();
          }}
          style={({ pressed }) => [styles.settingsBtn, pressed && styles.btnPressed]}
        >
          <Ionicons name="settings-outline" size={16} color={C.muted} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: 28,
    color: C.blue,
    letterSpacing: 3,
    // Fallback enquanto Bebas Neue carrega — bold ajuda a evitar o flash
    // de uma fonte serifada padrão.
    fontWeight: "700",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(61, 111, 255, 0.10)",
  },
  profileBtnText: {
    color: C.blue,
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 100,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.cellBg,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    opacity: 0.7,
  },
});
