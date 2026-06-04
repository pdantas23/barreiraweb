// === FriendsButton (mobile) ===
//
// Ícone de amigos + modal (espelha o FriendsHub da web): card centralizado
// com altura fixa, lista de amigos scrollável e dois botões fixos no rodapé
// ("Adicionar amigo" abre sub-modal de username; "Compartilhar link" usa o
// Share nativo). Confirmação nativa ao remover. Usado na home e no lobby.
//
// Só aparece pra usuário logado. O convite RECEBIDO é tratado globalmente
// pelo AppGate (banner); aqui só ENVIAMOS convite ("Convidar").

import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { FriendsData } from "@barreira/shared";
import { useAuth } from "../state/auth";
import { connectSocket, getSocket } from "../net/socket";
import {
  acceptFriendRequest,
  createFriendInviteLink,
  declineFriendRequest,
  getFriends,
  removeFriend,
  sendFriendRequest,
  sendGameInvite,
} from "../net/api";
import { FriendsList } from "./FriendsList";
import { AddFriend } from "./AddFriend";

const C = {
  blue: "#3D6FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  border: "#DDEAFF",
  red: "#FF3D6F",
} as const;

const EMPTY: FriendsData = { friends: [], incomingRequests: [], outgoingRequests: [] };
const SHARE_BASE = "https://barreirajogo.com";

type Props = {
  // cor do ícone (pra combinar com a barra onde está)
  color?: string;
};

export const FriendsButton = ({ color = C.blue }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [data, setData] = useState<FriendsData>(EMPTY);
  const [inviting, setInviting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const res = await getFriends();
    if (res.ok) setData(res.data);
  }, [user]);

  // Mantém o badge de pedidos atualizado mesmo com o modal fechado.
  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();
    void refresh();
    const onChange = () => void refresh();
    socket.on("friendStatusChanged", onChange);
    socket.on("friendRequestReceived", onChange);
    return () => {
      socket.off("friendStatusChanged", onChange);
      socket.off("friendRequestReceived", onChange);
    };
  }, [user, refresh]);

  void getSocket;

  const onInvite = async (target: string) => {
    setInviting(target);
    const res = await sendGameInvite(target);
    setInviting(null);
    if (!res.ok) Alert.alert("Convite", res.message ?? "Não foi possível convidar.");
    else Alert.alert("Convite enviado", `Convite enviado para ${target}.`);
  };

  const onRemove = (target: string) => {
    Alert.alert("Remover amigo?", `Tem certeza que quer remover ${target} da sua lista?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          await removeFriend(target);
          void refresh();
        },
      },
    ]);
  };

  const [sharing, setSharing] = useState(false);

  const shareLink = async () => {
    if (sharing) return;
    setSharing(true);
    const res = await createFriendInviteLink();
    setSharing(false);
    if (!res.ok) {
      Alert.alert("Convite", "Não foi possível gerar o link agora.");
      return;
    }
    const link = `${SHARE_BASE}/amigo/${res.data.token}`;
    try {
      // Só `message` (com o link dentro) — passar `url` junto faz o iOS
      // anexar o link de novo no fim, duplicando-o no compartilhamento.
      await Share.share({ message: `Bora jogar Barreira? 🧱 Me adiciona como amigo: ${link}` });
    } catch {
      /* cancelado — ignora */
    }
  };

  if (!user) return null;

  const badge = data.incomingRequests.length;

  return (
    <>
      <Pressable
        accessibilityLabel="Amigos"
        onPress={() => { setOpen(true); void refresh(); }}
        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="people" size={16} color={color} />
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </Pressable>

      {/* Modal principal — card centralizado, lista scrollável, rodapé fixo */}
      <Modal transparent visible={open} animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.header}>
              <Ionicons name="people" size={16} color={C.blue} />
              <Text style={styles.headerTitle}>AMIGOS</Text>
              <Pressable accessibilityLabel="Fechar" onPress={() => setOpen(false)} style={styles.headerClose}>
                <Ionicons name="close" size={20} color={C.muted} />
              </Pressable>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={{ flexGrow: 1 }}>
              <FriendsList
                bare
                friends={data.friends}
                incomingRequests={data.incomingRequests}
                invitingUsername={inviting}
                onInvite={onInvite}
                onAccept={async (u) => { await acceptFriendRequest(u); void refresh(); }}
                onDecline={async (u) => { await declineFriendRequest(u); void refresh(); }}
                onRemove={onRemove}
              />
            </ScrollView>

            <View style={styles.footer}>
              <Pressable accessibilityLabel="Adicionar amigo" onPress={() => setAddOpen(true)} style={[styles.footerBtn, styles.footerBtnPrimary]}>
                <Ionicons name="person-add" size={16} color={C.white} />
                <Text style={styles.footerBtnPrimaryText}>Adicionar amigo</Text>
              </Pressable>
              <Pressable accessibilityLabel="Compartilhar link" onPress={shareLink} style={[styles.footerBtn, styles.footerBtnGhost]}>
                <Ionicons name="share-social" size={16} color={C.blue} />
                <Text style={styles.footerBtnGhostText}>Compartilhar link</Text>
              </Pressable>
            </View>

            {/* "Adicionar amigo" como overlay DENTRO do mesmo modal — dois
                <Modal> simultâneos não apresentam de forma confiável no RN. */}
            {addOpen && (
              <Pressable style={styles.addOverlay} onPress={() => setAddOpen(false)}>
                <Pressable style={styles.addCard} onPress={(e) => e.stopPropagation?.()}>
                  <AddFriend
                    onAdd={async (u) => {
                      const res = await sendFriendRequest(u);
                      if (res.ok) void refresh();
                      return { ok: res.ok, error: res.ok ? undefined : res.message };
                    }}
                  />
                  <Pressable
                    accessibilityLabel="Fechar"
                    onPress={() => setAddOpen(false)}
                    style={styles.addCloseX}
                  >
                    <Ionicons name="close" size={18} color={C.muted} />
                  </Pressable>
                </Pressable>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: C.white, fontSize: 9, fontWeight: "900" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  addOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,42,74,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    height: "70%",
    maxHeight: 560,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: "#F5F8FF",
  },
  headerTitle: { flex: 1, color: C.navy, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  headerClose: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  footer: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.white,
  },
  footerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  footerBtnPrimary: { backgroundColor: C.blue },
  footerBtnPrimaryText: { color: C.white, fontSize: 13, fontWeight: "800" },
  footerBtnGhost: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  footerBtnGhostText: { color: C.navy, fontSize: 13, fontWeight: "800" },
  addCard: { width: "100%", maxWidth: 340 },
  addCloseX: {
    position: "absolute",
    top: -12,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 6,
    shadowColor: C.blue,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
