// === FriendInviteBanner (mobile) ===
// Banner no topo quando chega convite de partida. Timer regressivo de 30s;
// some ao responder ou expirar (onExpire).

import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type GameInvite = { fromUsername: string; expiresAt: number };

const C = { blue: "#3D6FFF", navy: "#1A2A4A", muted: "#9AAACA", white: "#FFFFFF", border: "#DDEAFF" };

type Props = {
  invite: GameInvite | null;
  onAccept: (fromUsername: string) => void;
  onDecline: (fromUsername: string) => void;
  onExpire?: () => void;
};

export const FriendInviteBanner = ({ invite, onAccept, onDecline, onExpire }: Props) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!invite) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((invite.expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [invite, onExpire]);

  if (!invite || remaining <= 0) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <Ionicons name="game-controller" size={18} color={C.blue} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{invite.fromUsername} te convidou</Text>
        <Text style={styles.sub}>Convite expira em {remaining}s</Text>
      </View>
      <Pressable accessibilityLabel="Aceitar convite" onPress={() => onAccept(invite.fromUsername)} style={styles.accept}>
        <Text style={styles.acceptText}>Aceitar</Text>
      </Pressable>
      <Pressable accessibilityLabel="Recusar convite" onPress={() => onDecline(invite.fromUsername)} style={styles.decline}>
        <Ionicons name="close" size={18} color={C.muted} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 8,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(61,111,255,0.1)", alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  title: { color: C.navy, fontSize: 13, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 11, fontWeight: "600" },
  accept: { backgroundColor: C.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  acceptText: { color: C.white, fontSize: 12, fontWeight: "900" },
  decline: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#F0F4FF", alignItems: "center", justifyContent: "center" },
});
