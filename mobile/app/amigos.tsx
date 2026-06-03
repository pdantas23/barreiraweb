// === Tela de Amigos (mobile) ===
// Lista de amigos + adicionar, wired ao socket/api. Convidar dispara o convite
// (o banner global do AppGate cuida do convite recebido / resposta).

import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { FriendsData } from "@barreira/shared";
import { useAuth } from "../src/state/auth";
import { connectSocket, getSocket } from "../src/net/socket";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriends,
  removeFriend,
  sendFriendRequest,
  sendGameInvite,
} from "../src/net/api";
import { FriendsList } from "../src/components/FriendsList";
import { AddFriend } from "../src/components/AddFriend";

const C = { blue: "#3D6FFF", navy: "#1A2A4A", bgTop: "#F0F4FF", bgBottom: "#E8EEF8" };
const EMPTY: FriendsData = { friends: [], incomingRequests: [], outgoingRequests: [] };

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { user, username } = useAuth();
  const [data, setData] = useState<FriendsData>(EMPTY);
  const [inviting, setInviting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const res = await getFriends();
    if (res.ok) setData(res.data);
  }, [user]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();
    const onChange = () => void refresh();
    socket.on("friendStatusChanged", onChange);
    socket.on("friendRequestReceived", onChange);
    return () => {
      socket.off("friendStatusChanged", onChange);
      socket.off("friendRequestReceived", onChange);
    };
  }, [user, refresh]);

  const onInvite = async (target: string) => {
    setInviting(target);
    const res = await sendGameInvite(target);
    setInviting(null);
    if (!res.ok) Alert.alert("Convite", res.message ?? "Não foi possível convidar.");
  };

  void getSocket;

  return (
    <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={28} color={C.navy} />
          </Pressable>
          <Text style={styles.title}>Amigos</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <AddFriend
            myUsername={username}
            onAdd={async (u) => {
              const res = await sendFriendRequest(u);
              if (res.ok) void refresh();
              return { ok: res.ok, error: res.ok ? undefined : res.message };
            }}
          />
          <View style={{ height: 12 }} />
          <FriendsList
            friends={data.friends}
            incomingRequests={data.incomingRequests}
            invitingUsername={inviting}
            onInvite={onInvite}
            onAccept={async (u) => { await acceptFriendRequest(u); void refresh(); }}
            onDecline={async (u) => { await declineFriendRequest(u); void refresh(); }}
            onRemove={async (u) => { await removeFriend(u); void refresh(); }}
          />
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  back: { width: 40, height: 40, justifyContent: "center" },
  title: { flex: 1, color: C.navy, fontSize: 18, fontWeight: "800", textAlign: "center" },
  content: { padding: 16 },
});
