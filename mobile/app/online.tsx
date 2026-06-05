import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { Leaderboard } from "../src/components/Leaderboard";
import { FriendsButton } from "../src/components/FriendsButton";
import { QuickMatchCard } from "../src/components/QuickMatchCard";
import { MatchmakingModal } from "../src/components/MatchmakingModal";
import { createRoom, joinRoom, listRooms } from "../src/net/api";
import { errorInfo } from "../src/net/errors";
import { clearLastGameStart, connectSocket, getSocket } from "../src/net/socket";
import { playButtonSound, useButtonSound } from "../src/hooks/useButtonSound";
import { usePlayerName } from "../src/state/profile";

// Palette — matches Home & Game screens
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
  gold: "#F4B619",
} as const;

// Fallback caso o profile ainda não tenha chegado do server. Em produção
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
  // Fallback "Jogador" só na primeira conexão antes do ack — ~200ms.
  const playerName = usePlayerName();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  // Quando o user clica numa sala privada da lista, abrimos o JoinByCodeModal
  // já com o code preenchido + travado + senha exigida. Null = modo padrão
  // (user clicou em "Entrar com código" — só code, sem senha).
  const [joinPrivate, setJoinPrivate] = useState<{ code: string } | null>(null);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [matchmaking, setMatchmaking] = useState(false);

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
    // Server avisa quando salas waiting mudam — refaz a lista sem polling.
    const socket = getSocket();
    const onLobbyUpdated = () => {
      refresh();
    };
    socket.on("lobbyUpdated", onLobbyUpdated);
    return () => {
      socket.off("lobbyUpdated", onLobbyUpdated);
    };
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      // Limpa o cache do último gameStart sempre que voltamos ao lobby.
      // Sem isso, se o user joga uma partida e volta via router.back(),
      // /online não unmonta → seu useEffect inicial não roda → o cache
      // fica com o gameStart da partida anterior. Daí o próximo push pra
      // /online-game lê esse cache e pula direto pra "vs anônimo..." como
      // se o bot tivesse entrado imediato. Limpar no focus blinda esse caso.
      clearLastGameStart();
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
      // Sala privada da lista: abrir modal com code pré-preenchido + travado,
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
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>
                {item.isPrivate ? "Privada" : "Pública"}
              </Text>
              <Text style={styles.metaDot}>·</Text>
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
        Crie uma nova sala ou entre com um código.
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
          <View style={styles.topRight}>
            <Pressable
              onPress={() => { playButtonSound(); setShowLeaderboard(true); }}
              style={({ pressed }) => [styles.headerTrophyBtn, pressed && styles.pressed]}
              accessibilityLabel="Ver leaderboard"
            >
              <Ionicons name="trophy" size={16} color={C.gold} />
            </Pressable>
            <FriendsButton />
          </View>
        </View>

        <FlatList
          data={rooms}
          keyExtractor={(r) => r.code}
          renderItem={renderRoom}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Partida Rápida (matchmaking) — acima da lista de salas. */}
              <View style={{ marginBottom: 14 }}>
                <QuickMatchCard
                  disabled={busy}
                  onPlay={() => { playButtonSound(); setMatchmaking(true); }}
                />
              </View>
              <View style={styles.subRow}>
                <Text style={styles.subText}>
                  {loading
                    ? "Carregando..."
                    : `${rooms.length} sala${rooms.length === 1 ? "" : "s"} disponíve${rooms.length === 1 ? "l" : "is"}`}
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
            </View>
          }
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
            <Text style={styles.btnSecondaryText}>Entrar com código</Text>
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

        <MatchmakingModal
          visible={matchmaking}
          onCancel={() => setMatchmaking(false)}
        />

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

        <Modal
          transparent
          visible={showLeaderboard}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowLeaderboard(false)}
        >
          <Pressable style={styles.lbBackdrop} onPress={() => setShowLeaderboard(false)}>
            <Pressable style={styles.lbModalCard} onPress={(e) => e.stopPropagation?.()}>
              <Pressable
                onPress={() => { playButtonSound(); setShowLeaderboard(false); }}
                style={({ pressed }) => [styles.lbCloseBtn, pressed && styles.pressed]}
                accessibilityLabel="Fechar"
              >
                <Ionicons name="close" size={20} color={C.muted} />
              </Pressable>
              <Leaderboard />
            </Pressable>
          </Pressable>
        </Modal>
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
    // Mesma largura do grupo da direita (troféu + amigos = ~80) pra o
    // título "Lobby" ficar centralizado de verdade. Seta encostada à esquerda.
    width: 80,
    height: 40,
    alignItems: "flex-start",
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
    paddingTop: 18,
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
    paddingTop: 8,
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
  // ─── Troféu (leaderboard) + amigos no header ───
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTrophyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  // ─── Leaderboard modal ───
  lbBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  lbModalCard: {
    width: "100%",
    maxWidth: 360,
  },
  lbCloseBtn: {
    position: "absolute",
    top: -14,
    right: -6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.cellBg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: C.blue,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});
