// === AppGate (container global, mobile) ===
//
// Cola três coisas ao app, montado uma vez no _layout (dentro dos providers):
//  - registro de push token ao logar (usePushToken);
//  - VersionGate (modal min_version / banner latest_version) lendo app_config;
//  - FriendInviteBanner global (convite de partida via socket) + accept/decline.

import { useEffect, useState } from "react";
import { Linking, Platform, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useAuth } from "../state/auth";
import { usePlayerName } from "../state/profile";
import { supabase } from "../net/supabase";
import { connectSocket, getSocket } from "../net/socket";
import { joinRoom, respondGameInvite } from "../net/api";
import { usePushToken } from "../hooks/usePushToken";
import { versionStatus, type VersionStatus } from "../version";
import { VersionGate } from "./VersionGate";
import { FriendInviteBanner, type GameInvite } from "./FriendInviteBanner";

const STORE_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/br/app/barreira/id6772620765"
    : "https://play.google.com/store/apps/details?id=com.barreira.app";

export const AppGate = () => {
  const { user } = useAuth();
  const playerName = usePlayerName();
  const isLoggedIn = !!user;
  usePushToken(isLoggedIn);

  const [version, setVersion] = useState<VersionStatus>("ok");
  const [invite, setInvite] = useState<GameInvite | null>(null);

  // Checagem de versão (app_config).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("app_config").select("key, value");
      if (cancelled || !data) return;
      const cfg = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]));
      const current = (Constants.expoConfig?.version as string | undefined) ?? "0.0";
      setVersion(versionStatus(current, cfg.min_version, cfg.latest_version));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Convites de partida (só faz sentido logado).
  useEffect(() => {
    if (!isLoggedIn) return;
    const socket = connectSocket();
    const onInvite = (p: GameInvite) => setInvite(p);
    const onExpired = () => setInvite(null);
    const onResponse = (p: { fromUsername: string; accept: boolean; code?: string; password?: string | null }) => {
      if (p.accept && p.code) {
        const params: Record<string, string> = { role: "host", code: p.code };
        if (p.password) params.password = p.password;
        router.push({ pathname: "/online-game" as never, params });
      }
    };
    socket.on("gameInviteReceived", onInvite);
    socket.on("gameInviteExpired", onExpired);
    socket.on("gameInviteResponse", onResponse);
    return () => {
      socket.off("gameInviteReceived", onInvite);
      socket.off("gameInviteExpired", onExpired);
      socket.off("gameInviteResponse", onResponse);
    };
  }, [isLoggedIn]);

  const onAccept = async (from: string) => {
    setInvite(null);
    const res = await respondGameInvite(from, true);
    if (res.ok && res.data) {
      const joined = await joinRoom({ code: res.data.code, playerName, password: res.data.password ?? undefined });
      if (joined.ok) {
        router.push({ pathname: "/online-game" as never, params: { role: "guest", code: res.data.code } });
      }
    }
  };
  const onDecline = async (from: string) => {
    setInvite(null);
    await respondGameInvite(from, false);
  };

  void getSocket; // mantém import usado caso o lint reclame

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 500 }}>
      <FriendInviteBanner invite={invite} onAccept={onAccept} onDecline={onDecline} onExpire={() => setInvite(null)} />
      <VersionGate status={version} onUpdate={() => void Linking.openURL(STORE_URL)} />
    </View>
  );
};
