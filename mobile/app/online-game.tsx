import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import {
  canPlaceWall,
  deserializeState,
  getValidMoves,
  goalRow,
  hasPathToRow,
  registerWall,
  WALLS_PER_PLAYER,
  type Color,
  type GameOverPayload,
  type GameStartPayload,
  type GameState,
  type PlayerId,
  type RematchDeclinedPayload,
  type RematchExpiredPayload,
  type RematchRequestedPayload,
  type StateUpdatePayload,
  type WallPlacement,
  type WallType,
} from "@barreira/shared";
import { Board } from "../src/components/Board";
import { CountdownOverlay } from "../src/components/CountdownOverlay";
import { GameOverModal, type GameOverReason } from "../src/components/GameOverModal";
import { GameTimer, useGameTimers } from "../src/components/GameTimer";
import { PlayerCard, TurnArrow } from "../src/components/PlayerCard";
import { WallBank } from "../src/components/WallBank";
import { useResponsiveBoard } from "../src/hooks/useResponsiveBoard";
import {
  leaveRoom,
  reportTimeout,
  requestRematch as requestRematchRpc,
  respondRematch as respondRematchRpc,
  sendMove,
} from "../src/net/api";
import {
  clearLastGameStart,
  getLastGameStart,
  getSocket,
} from "../src/net/socket";
import { useDragOverlay } from "../src/state/dragOverlay";
import { usePlayerName } from "../src/state/profile";
import { usePieceMoveSound } from "../src/hooks/usePieceSound";
import { useWallPlaceSound } from "../src/hooks/useWallSound";
import { playButtonSound, useButtonSound } from "../src/hooks/useButtonSound";
import { gc } from "../src/gameColors";
import { theme } from "../src/theme";

// Paleta clara — espelha a do lobby (online.tsx) pra consistência visual.
const L = {
  navy: "#1A2A4A",
  textSecondary: "#5C6F8F",
  muted: "#9AAACA",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
  cellBg: "#EEF2FF",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
};

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
  const [reconnecting, setReconnecting] = useState(false);

  // Countdown de 3s no início da partida
  const [countdownStartsAt, setCountdownStartsAt] = useState<number | null>(null);
  const [countdownActive, setCountdownActive] = useState(false);

  // Rematch state
  type RematchStatus = "idle" | "requesting" | "requested" | "declined" | "expired";
  const [rematchStatus, setRematchStatus] = useState<RematchStatus>("idle");
  const [rematchExpiresAt, setRematchExpiresAt] = useState(0);
  const [rematchRequesterName, setRematchRequesterName] = useState("");

  usePieceMoveSound(state?.p1 ?? -1, state?.p2 ?? -1);
  const totalWallsUsed = state ? (WALLS_PER_PLAYER - state.wallsLeft[1]) + (WALLS_PER_PLAYER - state.wallsLeft[2]) : 0;
  useWallPlaceSound(totalWallsUsed);
  useButtonSound();
  // Nome persistente do jogador (vem do server via evento `profile`).
  const myName = usePlayerName();

  // Fischer-clock timers
  const myPlayer: PlayerId = meta?.yourEnginePlayer ?? 1;
  const opponentPlayer: PlayerId = myPlayer === 1 ? 2 : 1;
  const { p1TimeMs, p2TimeMs, timedOutPlayer, resetTimers } = useGameTimers(
    state?.turn ?? 1,
    state?.winner ?? null,
    countdownActive,
    meta?.timeTotalMs,
  );

  const [gameOverReason, setGameOverReason] = useState<GameOverReason>("goal");

  // Timeout = loss
  useEffect(() => {
    if (timedOutPlayer !== null && state && state.winner === null) {
      const winner = timedOutPlayer === 1 ? 2 : 1;
      setGameOverReason("timeout");
      setState((prev) => prev ? { ...prev, winner } : prev);
      // Avisa o server pra ele encerrar/premiar — o relógio é client-side; sem
      // isso o awardCasualTrophy nunca rodava em vitória por tempo no mobile.
      void reportTimeout();
    }
  }, [timedOutPlayer, state?.winner]);

  // Drag de parede — espelha o que game.tsx (CPU local) já faz.
  const [dragType, setDragType] = useState<WallType | null>(null);
  const [ghost, setGhost] = useState<WallPlacement | null>(null);
  const [ghostInvalid, setGhostInvalid] = useState(false);
  const [showBlockedToast, setShowBlockedToast] = useState(false);

  const boardRef = useAnimatedRef<Animated.View>();
  const layout = useResponsiveBoard();
  const { dragX, dragY, lastInter, show, hide } = useDragOverlay();

  // Refs lidas dentro dos handlers do gesto (que rodam fora do ciclo React).
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state;
  const ghostRef = useRef<WallPlacement | null>(null);
  ghostRef.current = ghost;
  const dragTypeRef = useRef<WallType | null>(null);
  dragTypeRef.current = dragType;
  // Ref pra o handler de gameStart (registrado uma vez, deps []) sempre ler o
  // resetTimers atual. Sem isso a revanche herdaria os relógios da partida
  // anterior (timedOutPlayer fixo / tempo restante errado).
  const resetTimersRef = useRef(resetTimers);
  resetTimersRef.current = resetTimers;

  // === Listeners do socket ===
  // gameStart pode chegar ANTES desta tela montar (race típica do guest:
  // server emite gameStart logo após o ack do joinRoom, mas a navegação
  // demora alguns ms). Pra evitar perder, o socket.ts mantém um cache
  // global do último gameStart — aqui no mount lemos esse cache como
  // bootstrap e depois ficamos ouvindo pra updates futuras (reanchor etc).
  useEffect(() => {
    const cached = getLastGameStart();
    if (cached) {
      setMeta(cached);
      setState(deserializeState(cached.state));
      setCountdownStartsAt(cached.countdownStartsAt);
      setCountdownActive(true);
    }
    // Consome o cache UMA VEZ no mount. Sem isso, se o user navega de
    // volta pro lobby e cria outra sala, a próxima montagem desta tela
    // lê o gameStart antigo (de partida anterior) e pula direto pro modo
    // jogo — o que parece "bot entrou instantâneo" mas é só lixo no buffer.
    // gameStart subsequentes (do server) chegam via listener abaixo.
    clearLastGameStart();

    const socket = getSocket();

    const onGameStart = (payload: GameStartPayload) => {
      setMeta(payload);
      setState(deserializeState(payload.state));
      setOpponentLeft(false);
      setCountdownStartsAt(payload.countdownStartsAt);
      setCountdownActive(true);
      // Reset rematch state for new game
      setRematchStatus("idle");
      setRematchExpiresAt(0);
      setRematchRequesterName("");
      setGameOverReason("goal");
      // Zera os relógios — sem isso a revanche herda o tempo restante da
      // partida anterior (e o timedOutPlayer ficaria fixo se tivesse estourado).
      resetTimersRef.current();
    };
    const onStateUpdate = (payload: StateUpdatePayload) => {
      setState(deserializeState(payload.state));
    };
    const onGameOver = (_payload: GameOverPayload) => {
      // O winner já vem no state via stateUpdate (vem antes do gameOver).
    };
    const onOpponentLeft = () => {
      setOpponentLeft(true);
    };

    // Rematch events
    const onRematchRequested = (payload: RematchRequestedPayload) => {
      setRematchStatus("requested");
      setRematchExpiresAt(payload.expiresAt);
      setRematchRequesterName(payload.fromName);
    };
    const onRematchDeclined = (_payload: RematchDeclinedPayload) => {
      setRematchStatus("declined");
    };
    const onRematchExpired = (_payload: RematchExpiredPayload) => {
      setRematchStatus("expired");
    };

    const onDisconnect = () => setReconnecting(true);
    const onConnect = () => setReconnecting(false);

    socket.on("gameStart", onGameStart);
    socket.on("stateUpdate", onStateUpdate);
    socket.on("gameOver", onGameOver);
    socket.on("opponentLeft", onOpponentLeft);
    socket.on("rematchRequested", onRematchRequested);
    socket.on("rematchDeclined", onRematchDeclined);
    socket.on("rematchExpired", onRematchExpired);
    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);

    return () => {
      socket.off("gameStart", onGameStart);
      socket.off("stateUpdate", onStateUpdate);
      socket.off("gameOver", onGameOver);
      socket.off("opponentLeft", onOpponentLeft);
      socket.off("rematchRequested", onRematchRequested);
      socket.off("rematchDeclined", onRematchDeclined);
      socket.off("rematchExpired", onRematchExpired);
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
    };
  }, []);

  const myTurn =
    state !== null && state.turn === myPlayer && state.winner === null && !countdownActive;

  // validMoves só preenche quando é a vez do jogador — evita highlight
  // verde durante o turno do oponente. Também zera durante drag de parede
  // pra UI ficar limpa (sem casas verdes E parede flutuante ao mesmo tempo).
  const validMoves = useMemo(() => {
    if (!state || !myTurn || dragType !== null) return EMPTY_SET;
    return new Set(getValidMoves(state, myPlayer));
  }, [state, myTurn, myPlayer, dragType]);

  // === Ações ===

  const onSquareTap = async (index: number) => {
    if (!myTurn || !state) return;
    const res = await sendMove({ kind: "piece", to: index });
    if (!res.ok) {
      console.warn("[move] rejeitado:", res.error, res.message);
    }
  };

  // --- Drag de parede ---
  // Espelha exatamente o fluxo do game.tsx (CPU local), trocando applyMove
  // local por sendMove via socket. O server é a fonte da verdade.

  const onDragStart = (type: WallType) => {
    if (!myTurn || !state) return;
    if (state.wallsLeft[myPlayer] <= 0) return;
    setDragType(type);
    setGhost(null);
    show(type, layout);
  };

  const onIntersectionChange = (ir: number, ic: number, type: WallType) => {
    const placement: WallPlacement = { type, interRow: ir, interCol: ic };
    const s = stateRef.current;
    if (s && canPlaceWall(s.walls, placement)) {
      const nextWalls = registerWall(s.walls, placement);
      const blocksPath =
        !hasPathToRow(nextWalls, s.p1, goalRow(1)) ||
        !hasPathToRow(nextWalls, s.p2, goalRow(2));
      setGhost(placement);
      setGhostInvalid(blocksPath);
      setShowBlockedToast(blocksPath);
    } else {
      setGhost(null);
      setGhostInvalid(false);
      setShowBlockedToast(false);
    }
  };

  const onIntersectionLeave = () => {
    setGhost(null);
    setGhostInvalid(false);
    setShowBlockedToast(false);
  };

  const ghostInvalidRef = useRef(ghostInvalid);
  ghostInvalidRef.current = ghostInvalid;

  const sendingWallRef = useRef(false);

  const onDragEnd = async () => {
    if (dragTypeRef.current === null) return;
    const g = ghostRef.current;
    const invalid = ghostInvalidRef.current;
    dragTypeRef.current = null;
    setDragType(null);
    setGhost(null);
    setGhostInvalid(false);
    setShowBlockedToast(false);
    hide();
    if (!g || invalid || sendingWallRef.current) return;
    sendingWallRef.current = true;
    const res = await sendMove({ kind: "wall", placement: g });
    sendingWallRef.current = false;
    if (!res.ok) {
      console.warn("[wall] rejeitado:", res.error, res.message);
    }
  };

  const doLeave = async () => {
    // Espera o ack do server antes de navegar, senão race condition:
    // router.back() pode acontecer antes do server processar o leave,
    // deixando a sala "fantasma" na lista pros outros e bloqueando
    // o user de criar/entrar em outra ("already-in-room").
    // Race com timeout pra não travar a UI se a rede cair.
    await Promise.race([
      leaveRoom().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
    router.back();
  };

  const onLeave = () => {
    if (state && state.winner === null && !opponentLeft) {
      Alert.alert("Sair da partida", "Tem certeza que deseja sair?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: doLeave },
      ]);
    } else {
      doLeave();
    }
  };

  const onReportPlayer = () => {
    Alert.alert(
      "Denunciar jogador",
      `Deseja denunciar "${meta?.opponentName ?? "jogador"}" por comportamento inadequado?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Denunciar",
          style: "destructive",
          onPress: () => {
            const subject = encodeURIComponent("Denúncia de jogador - Barreira");
            const body = encodeURIComponent(
              `Jogador denunciado: ${meta?.opponentName ?? "?"}\nSala: ${code}\nMotivo: `,
            );
            Linking.openURL(`mailto:contato@barreira.app?subject=${subject}&body=${body}`);
          },
        },
      ],
    );
  };

  const onBackToMenu = () => router.replace("/");

  // Monta link de convite — formato igual à web: /?join=CODE[&pw=SENHA].
  // Share.share() abre o menu nativo (WhatsApp, Messages, Copy, etc).
  const onShareRoom = async () => {
    playButtonSound();
    const base =
      (Constants.expoConfig?.extra?.serverUrl as string | undefined) ??
      "https://barreirajogo.com";
    const params = new URLSearchParams({ join: code });
    if (password) params.set("pw", password);
    const url = `${base}/?${params.toString()}`;
    const lines = [
      "Bora jogar Barreira?",
      `Sala: ${code}`,
      ...(password ? [`Senha: ${password}`] : []),
      `Entre direto: ${url}`,
    ];
    try {
      await Share.share({ message: lines.join("\n"), url });
    } catch (err) {
      console.warn("[share] falhou:", err);
    }
  };

  const onBackToLobby = async () => {
    // Mesmo motivo do doLeave: espera ack pra evitar sala fantasma.
    await Promise.race([
      leaveRoom().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
    router.replace("/online");
  };

  // === Rematch callbacks ===
  const onRequestRematch = async () => {
    setRematchStatus("requesting");
    const res = await requestRematchRpc();
    if (!res.ok) {
      // Se o servidor detectou mutual, a nova partida já vai chegar via gameStart.
      // Se deu outro erro, reseta.
      if (res.error !== "rematch-already-pending") {
        setRematchStatus("idle");
      }
    }
  };

  const onAcceptRematch = async () => {
    setRematchStatus("idle");
    await respondRematchRpc(true);
    // Nova partida chega via gameStart
  };

  const onDeclineRematch = async () => {
    setRematchStatus("idle");
    await respondRematchRpc(false);
  };

  // === Render: tela de espera (host aguardando guest) ===

  if (!meta || !state) {
    return (
      <LinearGradient colors={[L.bgTop, L.bgBottom]} style={styles.root}>
        <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.topBar}>
            <Pressable onPress={onLeave} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color={L.navy} />
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

                <Pressable
                  onPress={onShareRoom}
                  style={({ pressed }) => [
                    styles.shareBtn,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <Ionicons name="share-social" size={18} color={L.white} />
                  <Text style={styles.shareBtnText}>Compartilhar sala</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </LinearGradient>
    );
  }

  // === Render: partida em andamento ===

  const myTimeMs = myPlayer === 1 ? p1TimeMs : p2TimeMs;
  const opTimeMs = myPlayer === 1 ? p2TimeMs : p1TimeMs;

  return (
    <LinearGradient
      colors={[gc.bgTop, gc.bgBottom]}
      style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={onLeave} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={gc.textDark} />
        </Pressable>
        <View style={styles.opponentChip}>
          <Text style={styles.opponentChipText} numberOfLines={1}>
            vs {meta.opponentName}
          </Text>
        </View>
        <Pressable onPress={onReportPlayer} style={styles.reportBtn}>
          <Ionicons name="flag-outline" size={18} color={L.muted} />
        </Pressable>
      </View>

      {/* Player cards */}
      <View style={styles.cardsRow}>
        <PlayerCard
          name={meta.opponentName}
          wallsLeft={state.wallsLeft[opponentPlayer]}
          totalWalls={WALLS_PER_PLAYER}
          isActive={state.turn === opponentPlayer && state.winner === null}
          isPlayer={false}
        />
        <TurnArrow isPlayerTurn={state.turn === myPlayer} />
        <PlayerCard
          name={myName}
          wallsLeft={state.wallsLeft[myPlayer]}
          totalWalls={WALLS_PER_PLAYER}
          isActive={state.turn === myPlayer && state.winner === null}
          isPlayer={true}
        />
      </View>

      {/* Opponent timer */}
      <View style={styles.timerRow}>
        <GameTimer
          timeRemainingMs={opTimeMs}
          isActive={state.turn === opponentPlayer && state.winner === null && !countdownActive}
          isPlayer={false}
        />
      </View>

      {/* Board */}
      <View style={styles.boardArea}>
        <View
          style={[
            styles.boardWrap,
            myPlayer === 2 && { transform: [{ rotate: "180deg" }] },
          ]}
        >
          <Board
            state={state}
            validMoves={validMoves}
            ghost={ghost}
            ghostInvalid={ghostInvalid}
            showBlockedToast={showBlockedToast}
            flipped={myPlayer === 2}
            onSquareTap={onSquareTap}
            boardRef={boardRef}
          />
        </View>
      </View>

      {/* Player timer */}
      <View style={styles.timerRow}>
        <GameTimer
          timeRemainingMs={myTimeMs}
          isActive={state.turn === myPlayer && state.winner === null && !countdownActive}
          isPlayer={true}
        />
      </View>

      {/* Wall bank */}
      <WallBank
        wallsLeft={state.wallsLeft[myPlayer]}
        disabled={!myTurn || state.winner !== null || opponentLeft}
        dragX={dragX}
        dragY={dragY}
        lastInter={lastInter}
        boardRef={boardRef}
        layout={layout}
        flipped={myPlayer === 2}
        onDragStart={onDragStart}
        onIntersectionChange={onIntersectionChange}
        onIntersectionLeave={onIntersectionLeave}
        onDragEnd={onDragEnd}
      />

      {/* Hint */}
      <Text style={styles.hint}>
        Toque para mover · Arraste para colocar parede
      </Text>

      {/* Countdown overlay */}
      {countdownActive && countdownStartsAt !== null && (
        <CountdownOverlay
          startsAt={countdownStartsAt}
          onComplete={() => setCountdownActive(false)}
        />
      )}

      {reconnecting && !opponentLeft && state.winner === null && (
        <View style={styles.reconnectBanner}>
          <ActivityIndicator size="small" color={theme.player1} />
          <Text style={styles.reconnectText}>
            Reconectando... sua vaga está reservada por uns segundos.
          </Text>
        </View>
      )}

      {/* Banner "oponente saiu" só faz sentido se a partida ainda não terminou.
          Se já tem winner, o resultado normal sobrescreve qualquer abandono
          (oponente sair APÓS perder = reação natural ao gameOver, não desistência). */}
      {opponentLeft && state.winner === null && (
        <View style={styles.leftBanner}>
          <Ionicons name="alert-circle" size={18} color={theme.player2} />
          <Text style={styles.leftBannerText}>Oponente saiu da partida</Text>
        </View>
      )}

      {/* Modal de vitória/derrota normal — mostra independente de opponentLeft.
          Se o winner já está decidido, é esse modal que vale. */}
      <GameOverModal
        visible={state.winner !== null}
        winner={
          state.winner === null
            ? null
            : state.winner === myPlayer
              ? 1
              : 2
        }
        reason={gameOverReason}
        onRematch={onRequestRematch}
        onBackToMenu={onBackToMenu}
        online
        rematchStatus={rematchStatus}
        rematchExpiresAt={rematchExpiresAt}
        rematchRequesterName={rematchRequesterName}
        onAcceptRematch={onAcceptRematch}
        onDeclineRematch={onDeclineRematch}
        onLeave={onBackToLobby}
      />

      {/* Modal "Oponente saiu" — só durante partida ativa (sem winner). */}
      <GameOverModal
        visible={opponentLeft && state.winner === null}
        winner={2}
        onRematch={onBackToLobby}
        onBackToMenu={onBackToMenu}
      />

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Wrapper raiz pro LinearGradient (waiting screen). A tela de jogo ativa
  // tem fundo claro vindo do GridBackground/Board, então não precisa.
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    color: L.navy,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  opponentChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(61,111,255,0.08)",
  },
  reportBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  opponentChipText: {
    color: gc.blue,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cardsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "90%",
    gap: 4,
    marginBottom: 6,
  },
  timerRow: {
    width: "88%",
    marginVertical: 3,
  },
  boardArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  boardWrap: {
    // Wrapper só pra aplicar rotate sem afetar layout dos vizinhos.
  },
  hint: {
    color: gc.labelColor,
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  // === Tela de espera ===
  waitingBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  waitingTitle: {
    color: L.navy,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 20,
  },
  waitingSub: {
    color: L.muted,
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
    backgroundColor: L.white,
    borderWidth: 1,
    borderColor: L.border,
    shadowColor: L.navy,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  codeBoxValue: {
    color: theme.player1,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 8,
    fontVariant: ["tabular-nums"],
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: theme.player1,
    shadowColor: theme.player1,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  shareBtnText: {
    color: L.white,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  // === Banner de reconexão (overlay durante partida) ===
  reconnectBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: L.white,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.player1,
    shadowColor: L.navy,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  reconnectText: {
    color: L.navy,
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  // === Banner de oponente saiu (durante partida ativa) ===
  leftBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: L.white,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.player2,
    shadowColor: L.navy,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  leftBannerText: {
    color: theme.player2,
    fontSize: 13,
    fontWeight: "700",
  },
});
