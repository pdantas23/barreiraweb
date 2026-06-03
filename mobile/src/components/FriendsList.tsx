// === FriendsList (mobile, apresentacional) ===
// Espelha o componente da web. Bolinha de status + "Convidar" só p/ online.

import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Friend, FriendStatus } from "@barreira/shared";

const STATUS_COLOR: Record<FriendStatus, string> = {
  online: "#22C55E",
  offline: "#9AAACA",
  "in-game": "#F4B619",
};
const STATUS_LABEL: Record<FriendStatus, string> = {
  online: "Online",
  offline: "Offline",
  "in-game": "Em partida",
};

const C = { blue: "#3D6FFF", navy: "#1A2A4A", muted: "#9AAACA", white: "#FFFFFF", border: "#DDEAFF", borderSoft: "#F0F4FF" };

type Props = {
  friends: Friend[];
  incomingRequests?: string[];
  onInvite?: (username: string) => void;
  onAccept?: (username: string) => void;
  onDecline?: (username: string) => void;
  onRemove?: (username: string) => void;
  invitingUsername?: string | null;
  // "bare": sem card/cabeçalho próprios (quando embutido num modal com chrome).
  bare?: boolean;
};

export const FriendsList = ({
  friends,
  incomingRequests = [],
  onInvite,
  onAccept,
  onDecline,
  onRemove,
  invitingUsername = null,
  bare = false,
}: Props) => {
  return (
    <View style={bare ? undefined : styles.card}>
      {!bare && (
        <View style={styles.header}>
          <Ionicons name="people" size={14} color={C.blue} />
          <Text style={styles.headerTitle}>AMIGOS</Text>
        </View>
      )}

      {incomingRequests.map((u) => (
        <View key={`req-${u}`} style={styles.row}>
          <Text style={styles.username} numberOfLines={1}>{u}</Text>
          <Pressable accessibilityLabel={`Aceitar ${u}`} onPress={() => onAccept?.(u)} style={styles.iconBtn}>
            <Ionicons name="checkmark" size={18} color="#16A34A" />
          </Pressable>
          <Pressable accessibilityLabel={`Recusar ${u}`} onPress={() => onDecline?.(u)} style={styles.iconBtn}>
            <Ionicons name="close" size={18} color="#E04256" />
          </Pressable>
        </View>
      ))}

      {friends.length === 0 && incomingRequests.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Você ainda não tem amigos.</Text>
          <Text style={styles.emptySub}>Adicione pelo username ou compartilhe seu link.</Text>
        </View>
      ) : (
        friends.map((f) => (
          <View key={f.username} style={styles.row}>
            <View
              accessibilityLabel={STATUS_LABEL[f.status]}
              style={[styles.dot, { backgroundColor: STATUS_COLOR[f.status] }]}
            />
            <Text style={styles.username} numberOfLines={1}>{f.username}</Text>
            <View style={styles.trophyChip}>
              <Ionicons name="trophy" size={11} color="#F4B619" />
              <Text style={styles.trophyText}>{f.trofeus ?? 0}</Text>
            </View>
            {f.status === "online" ? (
              <Pressable
                accessibilityLabel={`Convidar ${f.username}`}
                onPress={() => onInvite?.(f.username)}
                disabled={invitingUsername === f.username}
                style={styles.inviteBtn}
              >
                <Ionicons name="game-controller" size={13} color={C.white} />
                <Text style={styles.inviteText}>Convidar</Text>
              </Pressable>
            ) : (
              <Text style={styles.statusText}>{STATUS_LABEL[f.status]}</Text>
            )}
            {onRemove && (
              <Pressable accessibilityLabel={`Remover ${f.username}`} onPress={() => onRemove(f.username)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={15} color={C.muted} />
              </Pressable>
            )}
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#F5F8FF" },
  headerTitle: { color: C.navy, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  dot: { width: 10, height: 10, borderRadius: 5 },
  username: { flex: 1, color: C.navy, fontSize: 13, fontWeight: "600" },
  statusText: { color: C.muted, fontSize: 10, fontWeight: "700" },
  trophyChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  trophyText: { color: C.blue, fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  inviteBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.blue, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  inviteText: { color: C.white, fontSize: 11, fontWeight: "800" },
  iconBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: 24, paddingHorizontal: 16, alignItems: "center" },
  emptyTitle: { color: C.navy, fontSize: 13, fontWeight: "700" },
  emptySub: { color: C.muted, fontSize: 11, marginTop: 4, textAlign: "center" },
});
