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
import Animated, { FadeInUp } from "react-native-reanimated";
import type { ColorChoice, PublicRoom } from "@barreira/shared";
import {
  CreateRoomModal,
  type CreateRoomConfig,
} from "../src/components/CreateRoomModal";
import { JoinByCodeModal } from "../src/components/JoinByCodeModal";
import { createRoom, joinRoom, listRooms } from "../src/net/api";
import { clearLastGameStart, connectSocket } from "../src/net/socket";
import { theme } from "../src/theme";

// Nome default do jogador. Quando tivermos perfil, vai vir do AsyncStorage.
const DEFAULT_PLAYER_NAME = "Jogador";

// === Helpers de UI ===

const colorAccent = (c: ColorChoice): string => {
  if (c === "cyan") return theme.player1;
  if (c === "red") return theme.player2;
  return theme.textMuted;
};

const colorLabel = (c: ColorChoice): string => {
  if (c === "cyan") return "Ciano";
  if (c === "red") return "Vermelho";
  return "Random";
};

// === Tela ===

export default function OnlineScreen() {
  const insets = useSafeAreaInsets();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Refresh: chama o server e atualiza lista.
  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await listRooms();
    setLoading(false);
    if (!res.ok) {
      Alert.alert("Erro", `Não consegui listar salas (${res.error}).`);
      return;
    }
    setRooms(res.data.rooms);
  }, []);

  // Conecta o socket ao montar a tela. O singleton garante que reconectar
  // depois de já estar conectado é no-op. Limpa o cache de gameStart pra
  // não vazar payload de partida anterior pra próxima sala que o user entrar.
  useEffect(() => {
    clearLastGameStart();
    connectSocket();
    refresh();
  }, [refresh]);

  // Quando o usuário volta de uma partida pra cá, re-lista (sala antiga
  // pode ter sumido, novas podem ter aparecido).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // === Ações ===

  const goToOnlineGame = (params: Record<string, string>) => {
    router.push({
      pathname: "/online-game" as never,
      params,
    });
  };

  const onJoinRoom = async (room: PublicRoom) => {
    if (busy) return;
    if (room.isPrivate) {
      // Sala privada na lista — exige código + senha. Abre o modal de código.
      setJoinOpen(true);
      return;
    }
    setBusy(true);
    const res = await joinRoom({
      code: room.code,
      playerName: DEFAULT_PLAYER_NAME,
    });
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Não consegui entrar", errorMessage(res.error));
      return;
    }
    goToOnlineGame({ role: "guest", code: room.code });
  };

  const onConfirmCreate = async (config: CreateRoomConfig) => {
    setCreateOpen(false);
    setBusy(true);
    const res = await createRoom({
      hostName: DEFAULT_PLAYER_NAME,
      color: config.color,
      isPrivate: config.isPrivate,
    });
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Não consegui criar a sala", errorMessage(res.error));
      return;
    }
    goToOnlineGame({
      role: "host",
      code: res.data.code,
      password: res.data.password ?? "",
    });
  };

  const onConfirmJoin = async (code: string) => {
    setJoinOpen(false);
    setBusy(true);
    const res = await joinRoom({
      code,
      playerName: DEFAULT_PLAYER_NAME,
    });
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Não consegui entrar", errorMessage(res.error));
      return;
    }
    goToOnlineGame({ role: "guest", code });
  };

  // === Render ===

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
                <Ionicons name="lock-closed" size={13} color={theme.textMuted} />
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
            <Ionicons name="arrow-forward" size={16} color="#0b1014" />
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const emptyView = (
    <View style={styles.emptyBox}>
      <Ionicons name="people-outline" size={48} color="#2a2a35" />
      <Text style={styles.emptyText}>Nenhuma sala aberta agora</Text>
      <Text style={styles.emptySub}>
        Crie uma nova sala ou entre com um código.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Jogo Online</Text>
        <View style={styles.backButton} />
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
            <ActivityIndicator size="small" color={theme.textMuted} />
          ) : (
            <Ionicons name="refresh" size={16} color={theme.textMuted} />
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
          onPress={() => setJoinOpen(true)}
          disabled={busy}
          style={({ pressed }) => [
            styles.btnSecondary,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <Ionicons name="key-outline" size={18} color={theme.textPrimary} />
          <Text style={styles.btnSecondaryText}>Entrar com código</Text>
        </Pressable>

        <Pressable
          onPress={() => setCreateOpen(true)}
          disabled={busy}
          style={({ pressed }) => [
            styles.btnPrimary,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <Ionicons name="add" size={20} color="#0b1014" />
          <Text style={styles.btnPrimaryText}>Criar sala</Text>
        </Pressable>
      </View>

      <CreateRoomModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onConfirm={onConfirmCreate}
      />
      <JoinByCodeModal
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onConfirm={onConfirmJoin}
      />
    </View>
  );
}

// Tradução dos RpcError pra mensagens amigáveis.
const errorMessage = (err: string): string => {
  switch (err) {
    case "room-not-found":
      return "Sala não encontrada. O código está certo?";
    case "room-full":
      return "Essa sala já tem 2 jogadores.";
    case "wrong-password":
      return "Senha incorreta.";
    case "already-in-room":
      return "Você já está numa sala.";
    case "internal-error":
      return "Erro no servidor. Verifica se o server está rodando.";
    default:
      return `Erro: ${err}`;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
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
    color: theme.textPrimary,
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
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.boardBg,
    borderWidth: 1,
    borderColor: "#2a2a35",
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
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 14,
  },
  emptySub: {
    color: theme.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
  roomCard: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: theme.boardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a2a35",
    overflow: "hidden",
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
    color: theme.textPrimary,
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
    color: "#3a3a48",
    fontSize: 12,
  },
  metaText: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  codeText: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    fontVariant: ["tabular-nums"],
  },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.player1,
    paddingHorizontal: 14,
    marginVertical: 10,
    marginRight: 10,
    borderRadius: 10,
  },
  joinBtnText: {
    color: "#0b1014",
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
    borderTopColor: "#1f1f27",
    backgroundColor: theme.bg,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3a3a48",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    color: theme.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: theme.player1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: "#0b1014",
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
