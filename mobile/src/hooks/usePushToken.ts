// === Registro de Expo Push Token ===
//
// Ao logar, pede permissão de notificação e registra o token no server
// (que persiste em push_tokens). Best-effort: falha de permissão/rede não
// derruba nada. Não roda em simulador (Device.isDevice === false).

import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { registerPushToken } from "../net/api";

export const usePushToken = (isLoggedIn: boolean): void => {
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    void (async () => {
      try {
        if (!Device.isDevice) return; // push real só em device físico
        const perm = await Notifications.getPermissionsAsync();
        let granted = perm.granted;
        if (!granted) {
          granted = (await Notifications.requestPermissionsAsync()).granted;
        }
        if (!granted || cancelled) return;

        const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
          ?.eas?.projectId;
        const resp = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (cancelled || !resp?.data) return;

        const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";
        await registerPushToken(resp.data, platform);
      } catch {
        // best-effort — sem permissão/rede, segue sem push.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);
};
