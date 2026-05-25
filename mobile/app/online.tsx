import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import type { ColorChoice, PublicRoom } from "@barreira/shared";
import {
  CreateRoomModal,
  type CreateRoomConfig,
} from "../src/components/CreateRoomModal";
import { JoinByCodeModal } from "../src/components/JoinByCodeModal";
import { createRoom, joinRoom, listRooms } from "../src/net/api";
import { errorInfo } from "../src/net/errors";
import { clearLastGameStart, connectSocket } from "../src/net/socket";
import { playButtonSound, useButtonSound } from "../src/hooks/useButtonSound";
import { usePlayerName } from "../src/state/profile";

// Palette â€” matches Home & Game screens
const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
  cardBg: "#FFFFFF",
  cellBg: "#EEF2FF",
  border: "#DDEAFF",
  red: "#FF3D6F",
} as const;

// Fallback caso o profile ainda nÃ£o tenha chegado do server. Em produÃ§Ã£o
// (server online), o `usePlayerName` retorna o anonimoXXXX persistente.
const DEFAULT_PLAYER_NAME = "Jogador";

const colorAccent = (c: ColorChoice): string => {
  if (c === "cyan") return C.blue;
  if (c === "red") return C.red;
  return C.muted;
};

const colorLabel = (c: ColorChoice): string => {
  if (c === "cyan") return "Ciano";
  if (c === "red") return "Vermelho";
  return "Random";
};

export default function OnlineScreen() {
  useButtonSound(); // preload
  const insets = useSafeAreaInsets();
  // Nome persistente do jogador (vem do server via evento `profile`).
  // Fallback "Jogador" sÃ³ na primeira conexÃ£o antes do ack â€” ~200ms.
  const playerName = usePlayerName();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  // Quando o user clica numa sala privada da lista, abrimos o JoinByCodeModal
  // jÃ¡ com o code preenchido + travado + senha exigida. Null = modo padrÃ£o
  // (user clicou em "Entrar com cÃ³digo" â€” sÃ³ code, sem senha).
  const [joinPrivate, setJoinPrivate] = useState<{ code: string } | null>(null);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const showError = useCallback((res: { error: string; message?: string }) => {
    const info = errorInfo(res.error);
    Alert.alert(info.title, res.message ?? info.message);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await listRooms();
    setLoading(false);
    if (!res.ok) {
      showError(res);
      return;
    }
    setRooms(res.data.rooms);
  }, [showError]);

  useEffect(() => {
    clearLastGameStart();
    connectSocket();
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const goToOnlineGame = (params: Record<string, string>) => {
    router.push({
      pathname: "/online-game" as never,
      params,
    });
  };

  const onJoinRoom = (room: PublicRoom) => {
    playButtonSound();
    if (busy) return;
    if (room.isPrivate) {
      // Sala privada da lista: abrir modal com code prÃ©-preenchido + travado,
      // exigindo senha. O join real acontece em onConfirmJoin.
      setJoinPrivate({ code: room.code });
      setJoinOpen(true);
      return;
    }
    void doJoin(room.code);
  };

  const doJoin = async (code: string, password?: string) => {
    setBusy(true);
    const res = await joinRoom({ code, playerName, password });
    setBusy(false);
    if (!res.ok) {
      showError(res);
      return;
    }
    goToOnlineGame({ role: "guest", code });
  };

  const onConfirmCreate = async (config: CreateRoomConfig) => {
    playButtonSound();
    setCreateOpen(false);
    setBusy(true);
    const res = await createRoom({
      hostName: playerName,
      color: config.color,
      isPrivate: config.isPrivate,
    });
    setBusy(false);
    if (!res.ok) {
      showError(res);
      return;
    }
    goToOnlineGame({
      role: "host",
      code: res.data.code,
      password: res.data.password ?? "",
    });
  };

  const onConfirmJoin = (code: string, password?: string) => {
    setJoinOpen(false);
    setJoinPrivate(null);
    void doJoin(code, password);
  };

  const onCloseJoin = () => {
    setJoinOpen(false);
    setJoinPrivate(null);
  };

  const renderRoom = ({ item, index }: { item: PublicRoom; index: number }) => {
    const accent = colorAccent(item.hostColor);
    return (
      <Animated.View entering={FadeInUp.duration(360).delay(80 + index * 70)}>
        <View style={styles.roomCard}>
          <View style={[styles.roomAccent, { backgroundColor: accent }]} />

          <View style={styles.roomBody}>
            <View style={styles.roomHeader}>
              <Text style={styles.roomHost} numberOfLines={1}>
                {item.hostName}
              </Text>
              {item.isPrivate && (
                <Ionicons name="lock-closed" size={13} color={C.muted} />
              )}
            </View>

            <View style={styles.roomMeta}>
              <View style={[styles.sideChip, { borderColor: accent }]}>
                <Text style={[styles.sideChipText, { color: accent }]}>
                  {colorLabel(item.hostColor)}
                </Text>
              </View>
              <Text style={styles.metaDot}>Â·</Text>
              <Text style={styles.metaText}>
                {item.isPrivate ? "Privada" : "PÃºblica"}
              </Text>
              <Text style={styles.metaDot}>Â·</Text>
              <Text style={styles.codeText}>{item.code}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => onJoinRoom(item)}
            disabled={busy}
            style={({ pressed }) => [
              styles.joinBtn,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Text style={styles.joinBtnText}>Entrar</Text>
            <Ionicons name="arrow-forward" size={16} color={C.white} />
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const emptyView = (
    <View style={styles.emptyBox}>
      <Ionicons name="people-outline" size={48} color={C.border} />
      <Text style={styles.emptyText}>Nenhuma sala aberta agora</Text>
      <Text style={styles.emptySub}>
        Crie uma nova sala ou entre com um cÃ³digo.
      </Text>
    </View>
  );

  return (
    <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={C.navy} />
          </Pressable>
          <Text style={styles.topTitle}>Lobby</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.subRow}>
          <Text style={styles.subText}>
            {loading
              ? "Carregando..."
              : `${rooms.length} sala${rooms.length === 1 ? "" : "s"} disponÃ­ve${rooms.length === 1 ? "l" : "is"}`}
          </Text>
          <Pressable
            onPress={refresh}
            disabled={loading || busy}
            style={({ pressed }) => [
              styles.refreshBtn,
              pressed && styles.pressed,
              (loading || busy) && styles.disabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={C.muted} />
            ) : (
              <Ionicons name="refresh" size={16} color={C.blue} />
            )}
          </Pressable>
        </View>

        <FlatList
          data={rooms}
          keyExtractor={(r) => r.code}
          renderItem={renderRoom}
          contentContainerStyle={
            rooms.length === 0
              ? [styles.listContent, styles.listEmpty]
              : styles.listContent
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={!loading ? emptyView : null}
        />

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) + 4 },
          ]}
        >
          <Pressable
            onPress={() => {
              playButtonSound();
              setJoinPrivate(null);
              setJoinOpen(true);
            }}
            disabled={busy}
            style={({ pressed }) => [
              styles.btnSecondary,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Ionicons name="key-outline" size={18} color={C.navy} />
            <Text style={styles.btnSecondaryText}>Entrar com cÃ³digo</Text>
          </Pressable>

          <Pressable
            onPress={() => { playButtonSound(); setCreateOpen(true); }}
            disabled={busy}
            style={({ pressed }) => [{ flex: 1 }, pressed && styles.pressed, busy && styles.disabled]}
          >
            <LinearGradient
              colors={[C.blue, C.blueLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnPrimary}
            >
              <Ionicons name="add" size={20} color={C.white} />
              <Text style={styles.btnPrimaryText}>Criar sala</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <CreateRoomModal
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          onConfirm={onConfirmCreate}
        />
        <JoinByCodeModal
          visible={joinOpen}
          onClose={onCloseJoin}
          onConfirm={onConfirmJoin}
          initialCode={joinPrivate?.code}
          lockCode={joinPrivate !== null}
          requirePassword={joinPrivate !== null}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    color: C.navy,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  subText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyBox: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyText: {
    color: C.navy,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 14,
  },
  emptySub: {
    color: C.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
  roomCard: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: C.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: C.blue,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  roomAccent: {
    width: 5,
    alignSelf: "stretch",
  },
  roomBody: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  roomHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  roomHost: {
    color: C.navy,
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  roomMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  sideChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  sideChipText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  metaDot: {
    color: C.border,
    fontSize: 12,
  },
  metaText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  codeText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    fontVariant: ["tabular-nums"],
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.blue,
    paddingHorizontal: 14,
    marginVertical: 10,
    marginRight: 10,
    borderRadius: 10,
  },
  joinBtnText: {
    color: C.white,
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  btnSecondary: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    color: C.navy,
    fontWeight: "700",
    fontSize: 13,
  },
  btnPrimary: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: C.white,
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});

