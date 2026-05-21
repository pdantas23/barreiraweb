import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import {
  CreateRoomModal,
  type CreateRoomConfig,
} from "../src/components/CreateRoomModal";
import { JoinByCodeModal } from "../src/components/JoinByCodeModal";
import { theme } from "../src/theme";

// === Tipos ===

type RoomColor = "cyan" | "random" | "red";

type Room = {
  id: string;
  code: string;
  host: string;
  hostColor: RoomColor;
  isPrivate: boolean;
  ping: number;
};

// === Mock de salas (3 exemplos, sem backend) ===
// Trocar essa lista por dados vindos do servidor quando o socket entrar.
// hostColor é apenas cosmético — quem entrar sempre joga saindo de baixo.

const MOCK_ROOMS: Room[] = [
  {
    id: "r1",
    code: "AX42KP",
    host: "RogerCarl",
    hostColor: "cyan",
    isPrivate: false,
    ping: 38,
  },
  {
    id: "r2",
    code: "ZQ09MN",
    host: "MariaLuz",
    hostColor: "random",
    isPrivate: true,
    ping: 64,
  },
  {
    id: "r3",
    code: "BT77JD",
    host: "Pedrim",
    hostColor: "red",
    isPrivate: false,
    ping: 22,
  },
];

// === Helpers de UI ===

const colorAccent = (c: RoomColor): string => {
  if (c === "cyan") return theme.player1;
  if (c === "red") return theme.player2;
  return theme.textMuted;
};

const colorLabel = (c: RoomColor): string => {
  if (c === "cyan") return "Ciano";
  if (c === "red") return "Vermelho";
  return "Random";
};

// === Tela ===

export default function OnlineScreen() {
  const insets = useSafeAreaInsets();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const onJoinRoom = (room: Room) => {
    // Estrutura: aqui plugaríamos a navegação pra sala de espera após o socket.
    Alert.alert(
      "Entrar na sala",
      `Conectaria à sala ${room.code} (${room.host}).`,
    );
  };

  const onConfirmCreate = (config: CreateRoomConfig) => {
    setCreateOpen(false);
    // Estrutura: chamaria o servidor pra criar sala com essa config.
    const detail = config.isPrivate
      ? `Privada · senha ${config.password} · cor ${colorLabel(config.color)}`
      : `Pública · cor ${colorLabel(config.color)}`;
    Alert.alert("Sala criada", detail);
  };

  const onConfirmJoin = (code: string) => {
    setJoinOpen(false);
    Alert.alert("Entrar com código", `Tentaria entrar na sala ${code}.`);
  };

  const renderRoom = ({ item, index }: { item: Room; index: number }) => {
    const accent = colorAccent(item.hostColor);
    return (
      <Animated.View entering={FadeInUp.duration(360).delay(80 + index * 70)}>
        <View style={styles.roomCard}>
          {/* Faixa colorida lateral mostra a cor escolhida pelo host */}
          <View style={[styles.roomAccent, { backgroundColor: accent }]} />

          <View style={styles.roomBody}>
            <View style={styles.roomHeader}>
              <Text style={styles.roomHost} numberOfLines={1}>
                {item.host}
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
              <Text style={styles.metaText}>{item.ping}ms</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.codeText}>{item.code}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => onJoinRoom(item)}
            style={({ pressed }) => [styles.joinBtn, pressed && styles.pressed]}
          >
            <Text style={styles.joinBtnText}>Entrar</Text>
            <Ionicons name="arrow-forward" size={16} color="#0b1014" />
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Jogo Online</Text>
        <View style={styles.backButton} />
      </View>

      {/* Subtítulo / contador */}
      <View style={styles.subRow}>
        <Text style={styles.subText}>{MOCK_ROOMS.length} salas disponíveis</Text>
        <Pressable
          onPress={() => Alert.alert("Atualizar", "Recarregaria a lista do servidor.")}
          style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={16} color={theme.textMuted} />
        </Pressable>
      </View>

      {/* Lista de salas (FlatList nativo pra performance) */}
      <FlatList
        data={MOCK_ROOMS}
        keyExtractor={(r) => r.id}
        renderItem={renderRoom}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Ações fixas no rodapé */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) + 4 },
        ]}
      >
        <Pressable
          onPress={() => setJoinOpen(true)}
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
        >
          <Ionicons name="key-outline" size={18} color={theme.textPrimary} />
          <Text style={styles.btnSecondaryText}>Entrar com código</Text>
        </Pressable>

        <Pressable
          onPress={() => setCreateOpen(true)}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
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
});
