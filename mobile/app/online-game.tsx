import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import {
  deserializeState,
  getValidMoves,
  type Color,
  type GameOverPayload,
  type GameStartPayload,
  type GameState,
  type PlayerId,
  type StateUpdatePayload,
} from "@barreira/shared";
import { Board } from "../src/components/Board";
import { GameOverModal } from "../src/components/GameOverModal";
import { TurnIndicator } from "../src/components/TurnIndicator";
import { sendMove } from "../src/net/api";
import { getSocket } from "../src/net/socket";
import { theme } from "../src/theme";

const EMPTY_SET: Set<number> = new Set();

export default function OnlineGameScreen() {
  const params = useLocalSearchParams<{
    role?: string;
    code?: string;
    password?: string;
  }>();
  const code = params.code ?? "?";
  const isHost = params.role === "host";
  const password = params.password ?? "";

  const router = useRouter();
  const insets = useSafeAreaInsets();

  // === Estado da partida ===
  const [meta, setMeta] = useState<GameStartPayload | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);

  const boardRef = useAnimatedRef<Animated.View>();

  // === Listeners do socket ===
  // Importante: gameStart pode chegar ANTES da tela montar (caso comum pro
  // guest, que recebe a mensagem antes de a navegação completar). Por isso
  // registramos com `on` (que dispara em qualquer ordem) e não `once`.
  useEffect(() => {
    const socket = getSocket();

    const onGameStart = (payload: GameStartPayload) => {
      setMeta(payload);
      setState(deserializeState(payload.state));
    };
    const onStateUpdate = (payload: StateUpdatePayload) => {
      setState(deserializeState(payload.state));
    };
    const onGameOver = (_payload: GameOverPayload) => {
      // O winner já vem no state via stateUpdate (vem antes do gameOver).
      // O evento gameOver é redundante de propósito — sirve como sinal
      // explícito de "fim de partida" caso o cliente queira logar/analytics.
    };
    const onOpponentLeft = () => {
      setOpponentLeft(true);
    };

    socket.on("gameStart", onGameStart);
    socket.on("stateUpdate", onStateUpdate);
    socket.on("gameOver", onGameOver);
    socket.on("opponentLeft", onOpponentLeft);

    return () => {
      socket.off("gameStart", onGameStart);
      socket.off("stateUpdate", onStateUpdate);
      socket.off("gameOver", onGameOver);
      socket.off("opponentLeft", onOpponentLeft);
    };
  }, []);

  const myPlayer: PlayerId = meta?.yourEnginePlayer ?? 1;
  const myTurn =
    state !== null && state.turn === myPlayer && state.winner === null;

  // validMoves só preenche quando é a vez do jogador — evita highlight
  // verde durante o turno do oponente.
  const validMoves = useMemo(() => {
    if (!state || !myTurn) return EMPTY_SET;
    return new Set(getValidMoves(state, myPlayer));
  }, [state, myTurn, myPlayer]);

  // === Ações ===

  const onSquareTap = async (index: number) => {
    if (!myTurn || !state) return;
    const res = await sendMove({ kind: "piece", to: index });
    if (!res.ok) {
      console.warn("[move] rejeitado:", res.error, res.message);
    }
  };

  const onLeave = () => {
    // TODO Fase 5: leaveRoom() RPC + cleanup. Por ora só volta.
    router.back();
  };

  const onBackToMenu = () => router.replace("/");
  const onBackToLobby = () => router.replace("/online");

  // === Render: tela de espera (host aguardando guest) ===

  if (!meta || !state) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.topBar}>
          <Pressable onPress={onLeave} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.topTitle}>Sala {code}</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.waitingBody}>
          <ActivityIndicator size="large" color={theme.player1} />
          <Text style={styles.waitingTitle}>
            {isHost ? "Aguardando oponente..." : "Entrando..."}
          </Text>
          {isHost && (
            <>
              <Text style={styles.waitingSub}>
                Compartilhe esse código para alguém entrar:
              </Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeBoxValue}>{code}</Text>
              </View>
              {password && (
                <>
                  <Text style={styles.waitingSub}>Senha (sala privada):</Text>
                  <View style={styles.codeBox}>
                    <Text style={[styles.codeBoxValue, { color: theme.player2 }]}>
                      {password}
                    </Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </View>
    );
  }

  // === Render: partida em andamento ===

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <Pressable onPress={onLeave} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.textPrimary} />
        </Pressable>
        <View style={styles.turnWrapper}>
          <TurnIndicator turn={state.turn} winner={state.winner} myPlayer={myPlayer} />
        </View>
        <View style={styles.opponentChip}>
          <Text style={styles.opponentChipText} numberOfLines={1}>
            {meta.opponentName}
          </Text>
        </View>
      </View>

      {/* Wrapper que aplica flip 180° quando jogador é engine player 2,
          pra ele sempre se ver "saindo de baixo". Eventos de toque
          são corretamente reposicionados pelo RN. */}
      <View
        style={[
          styles.boardWrap,
          myPlayer === 2 && { transform: [{ rotate: "180deg" }] },
        ]}
      >
        <Board
          state={state}
          validMoves={validMoves}
          ghost={null}
          onSquareTap={onSquareTap}
          boardRef={boardRef}
        />
      </View>

      {/* Aviso enquanto drag de parede ainda não funciona com flip. */}
      <Text style={styles.hint}>
        {myPlayer === 1
          ? "Toque numa casa verde pra mover. (Paredes em breve no modo online.)"
          : "Toque numa casa verde pra mover."}
      </Text>

      {opponentLeft && (
        <View style={styles.leftBanner}>
          <Ionicons name="alert-circle" size={18} color={theme.player2} />
          <Text style={styles.leftBannerText}>Oponente saiu da partida</Text>
        </View>
      )}

      <GameOverModal
        visible={state.winner !== null && !opponentLeft}
        // Mapeia winner real pra "perspectiva local": 1 = eu venci, 2 = perdi.
        // O modal usa essa convenção (cyan = vitória, red = derrota).
        winner={
          state.winner === null
            ? null
            : state.winner === myPlayer
              ? 1
              : 2
        }
        onRematch={onBackToLobby}
        onBackToMenu={onBackToMenu}
      />

      {/* Modal de "oponente saiu". Reusa GameOverModal pra manter visual. */}
      <GameOverModal
        visible={opponentLeft}
        winner={2}
        onRematch={onBackToLobby}
        onBackToMenu={onBackToMenu}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: theme.bg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 10,
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
  turnWrapper: {
    flex: 1,
    alignItems: "center",
  },
  opponentChip: {
    maxWidth: 110,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#22262e",
    borderWidth: 1,
    borderColor: "#33384a",
    alignItems: "center",
    justifyContent: "center",
  },
  opponentChipText: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  boardWrap: {
    // Wrapper só pra aplicar rotate sem afetar layout dos vizinhos.
  },
  hint: {
    color: theme.textMuted,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 16,
    marginTop: 14,
  },
  // === Tela de espera ===
  waitingBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  waitingTitle: {
    color: theme.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 20,
  },
  waitingSub: {
    color: theme.textMuted,
    fontSize: 12,
    marginTop: 18,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  codeBox: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: theme.boardBg,
    borderWidth: 1,
    borderColor: "#2a2a35",
  },
  codeBoxValue: {
    color: theme.player1,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 8,
    fontVariant: ["tabular-nums"],
  },
  // === Banner de oponente saiu ===
  leftBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${theme.player2}1f`,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.player2,
  },
  leftBannerText: {
    color: theme.player2,
    fontSize: 13,
    fontWeight: "700",
  },
});
