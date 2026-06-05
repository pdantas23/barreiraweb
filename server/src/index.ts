// === Barreira — servidor multiplayer ===
//
// Os handlers RPC devolvem RpcResult<T> via ack; estado de partida vai
// por push (gameStart / stateUpdate / profile / etc).

import dotenv from "dotenv";
import { resolve } from "node:path";

// Carrega .env do cwd (caso o server seja iniciado da raiz) e tambem da
// raiz do monorepo (caso o cwd seja server/). dotenv nao sobrescreve vars
// ja setadas, entao chamar os dois eh seguro e idempotente.
dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), "..", ".env") });
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  applyMove,
  GAME_TIME_TOTAL_MS,
  serializeState,
  type ClientToServerEvents,
  type GameStartPayload,
  type PlayerId,
  type RpcError,
  type RpcResult,
  type ServerToClientEvents,
} from "@barreira/shared";
import {
  LobbyError,
  acceptRematchAsBot,
  attemptReanchor,
  chargeTurnTime,
  clearRematch,
  createRoom,
  getRoomBySocket,
  initGameClock,
  joinRoom,
  leaveRoom,
  listPublicRooms,
  markDisconnected,
  requestRematch,
  requestRematchAsBot,
  respondRematch,
  setOnLobbyChanged,
  setOnPlayerTimeout,
  setOnRematchAccepted,
  setOnRematchExpired,
  toRoomDetail,
  turnTimeUsedMs,
  type ServerPlayer,
  type ServerRoom,
} from "./lobby.js";
import {
  getOrCreateProfile,
  getUsernameForAuthUser,
  linkPlayerToUser,
  markPlayed,
  updatePlayerPlatform,
} from "./profiles.js";
import { startReengagementCron } from "./reengagement.js";
import { resolveAuthUser } from "./auth.js";
import { recordMatchStart, recordMatchFinish } from "./matches.js";
import { recordOnlineSnapshot, type OnlineStats } from "./snapshots.js";
import { awardCasualTrophy } from "./trophies.js";
import {
  validateCreateRoom,
  validateJoinRoom,
  validateListRooms,
  validateMove,
  validateSendFriendRequest,
  validateRespondFriendRequest,
  validateRemoveFriend,
  validateGetFriends,
  validateSendGameInvite,
  validateRespondGameInvite,
  validateRedeemFriendInvite,
  validateRegisterPushToken,
} from "./validation.js";
import { isAllowedOrigin } from "./cors.js";
import { createOnlineRegistry } from "./onlineRegistry.js";
import { createFriendService, createSupabaseFriendStore } from "./friendships.js";
import {
  connectionAllowed,
  eventAllowed,
  startHardeningSweeper,
} from "./hardening.js";
import { sendInvitePush, upsertPushToken } from "./push.js";
import type { InviteAcceptResult } from "@barreira/shared";
import {
  addMatchmakingBot,
  maybeBotRequestRematch,
  maybeScheduleBotMove,
  scheduleBotRescue,
  setOnBotRescueStarted,
  startBotManager,
} from "./botManager.js";
import {
  initMatchmaking,
  joinMatchmaking,
  leaveMatchmaking,
  type QueuedPlayer,
} from "./matchmaking.js";

const PORT = Number(process.env.PORT ?? 3000);

// === HTTP ===
const app = express();
// Atrás do nginx (1 hop): faz req.ip refletir o X-Forwarded-For real, senão
// todo request viria de 127.0.0.1 e o rate-limit cairia num balde só.
app.set("trust proxy", 1);
// Headers de segurança padrão. Só afeta as rotas express (/health) — as
// requests de /socket.io são tratadas pela engine antes do express.
app.use(helmet());
// Limite explícito de corpo: as mensagens do jogo são minúsculas, 50kb é
// folga de sobra e fecha o vetor de payload JSON gigante.
app.use(express.json({ limit: "50kb" }));

// Rate-limit do HTTP. Só existe /health hoje; 120/min por IP é teto alto pra
// healthcheck/uptime e barra varredura. Devolve 429 sem derrubar o resto.
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: Number(process.env.RL_HTTP_PER_MIN ?? 120),
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// === WebSocket ===
// Origens permitidas a abrir socket no backend — ver cors.ts. Bloqueia sites
// http/https arbitrários, mas libera app nativo (sem Origin), Expo (exp://) e
// dev local/LAN, pra não derrubar o mobile em desenvolvimento.
const corsOrigin = (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
): void => {
  if (isAllowedOrigin(origin)) cb(null, true);
  else cb(new Error("Origin não permitida pelo CORS"));
};

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: corsOrigin },
  // Default é 1MB por mensagem — alto pro nosso tráfego (jogadas minúsculas).
  // 64KB cobre qualquer payload legítimo e corta mensagem gigante de propósito.
  maxHttpBufferSize: 64 * 1024,
});

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Anti-flood de conexão: recusa quem abre sockets em loop (protege a tabela
// `players`, que ganha uma linha por clientId novo). Roda antes do connection.
io.use((socket, next) => {
  if (connectionAllowed(socket, Date.now())) {
    next();
  } else {
    next(new Error("rate-limited"));
  }
});

// === Helpers ===

const errResult = (error: RpcError, message?: string): RpcResult<never> => ({
  ok: false,
  error,
  message,
});

const okResult = <T>(data: T): RpcResult<T> => ({ ok: true, data });

// Trunca IDs (clientId/authUserId) nos logs pra não expor o valor inteiro —
// já é o padrão dos demais logs do projeto (slice 0,8).
const short = (id: string | null | undefined): string =>
  id ? `${id.slice(0, 8)}…` : "null";

// Envelopa um handler RPC: captura LobbyError e devolve via ack;
// qualquer outra exceção vira "internal-error" e é logada.
const rpc = <P, R>(
  handler: (payload: P, socket: TypedSocket) => Promise<R> | R,
) => {
  return async (payload: P, socket: TypedSocket, ack: (res: RpcResult<R>) => void) => {
    // Throttle por socket: barra spam de eventos antes de tocar engine/DB.
    if (!eventAllowed(socket, Date.now())) {
      ack(errResult("rate-limited"));
      return;
    }
    try {
      const data = await handler(payload, socket);
      ack(okResult(data));
    } catch (err) {
      if (err instanceof LobbyError) {
        ack(errResult(err.code, err.message));
        return;
      }
      // Detalhe do erro fica só no log do server — o cliente recebe só o
      // código genérico, sem vazar mensagens/estrutura internas.
      console.error("[rpc] erro inesperado:", err);
      ack(errResult("internal-error"));
    }
  };
};

// Quando a sala fecha (2 jogadores), envia gameStart pra cada socket com
// payload personalizado (yourEnginePlayer / yourColor diferentes).
const COUNTDOWN_DURATION_MS = 3_000;

const broadcastGameStart = (room: ServerRoom) => {
  if (!room.gameState) return;
  const wireState = serializeState(room.gameState);
  const countdownStartsAt = Date.now();
  room.countdownEndsAt = countdownStartsAt + COUNTDOWN_DURATION_MS;
  // Zera o relógio autoritativo — começa a contar quando o countdown acabar.
  // Cobre tanto a 1ª partida quanto a revanche (ambas passam por aqui).
  initGameClock(room);

  // Marca atividade dos jogadores logados (profiles.last_played_at) pro cron
  // de reengajamento saber quem está ativo. Fire-and-forget.
  for (const p of room.players) {
    if (p.authUserId) void markPlayed(p.authUserId);
  }

  for (const me of room.players) {
    const opponent = room.players.find((p) => p.socketId !== me.socketId);
    if (!opponent) continue;
    const payload: GameStartPayload = {
      state: wireState,
      yourEnginePlayer: me.enginePlayer,
      yourColor: me.color,
      opponentName: opponent.name,
      opponentColor: opponent.color,
      countdownStartsAt,
      timeTotalMs: GAME_TIME_TOTAL_MS,
    };
    io.to(me.socketId).emit("gameStart", payload);
  }
};

// Envia gameStart APENAS pro player especificado — usado em reanexa
// pra um cliente que reconectou recuperar identidade + state.
const sendGameStartTo = (room: ServerRoom, me: ServerPlayer) => {
  if (!room.gameState) return;
  const opponent = room.players.find((p) => p.socketId !== me.socketId);
  if (!opponent) return;
  const payload: GameStartPayload = {
    state: serializeState(room.gameState),
    yourEnginePlayer: me.enginePlayer,
    yourColor: me.color,
    opponentName: opponent.name,
    opponentColor: opponent.color,
    countdownStartsAt: Date.now() - COUNTDOWN_DURATION_MS - 1000,
    timeTotalMs: GAME_TIME_TOTAL_MS,
  };
  io.to(me.socketId).emit("gameStart", payload);
};

// Callback: timer de desconexão estourou — quem sobrou vence por W.O.
//
// Guarda crítica: só premia/encerra se a partida AINDA estava em andamento
// (winner === null). Sem isso, se o jogo já tinha acabado (alguém chegou na
// linha) e o perdedor só fechou a aba 30s depois, o timer dispararia aqui e
// premiaria o vencedor uma SEGUNDA vez (troféu em dobro).
setOnPlayerTimeout(async (_clientId, room, remaining) => {
  if (remaining.length === 1 && room.gameState && room.gameState.winner === null) {
    const winner = remaining[0].enginePlayer;
    console.log(
      `[timeout] sala ${room.code}: ${winner} venceu por W.O. (oponente não voltou)`,
    );
    // Marca winner no state pra UI mostrar gameOver coerente.
    room.gameState = { ...room.gameState, winner };
    io.to(room.code).emit("stateUpdate", { state: serializeState(room.gameState) });
    // Premia o vencedor logado (W.O. conta como vitoria casual) ANTES
    // do emit, pra refreshTrofeus do cliente não ler valor stale.
    if (remaining[0].authUserId) {
      await awardCasualTrophy(remaining[0].authUserId, 1);
    } else {
      console.warn(
        `[timeout] sala ${room.code}: vencedor sem authUserId (race de cold-start / sessão sem token) — troféu NÃO concedido`,
      );
    }
    io.to(room.code).emit("gameOver", { winner, reason: "abandon" });
    io.to(room.code).emit("opponentLeft");
    // Analytics: oponente não voltou dentro do timeout (W.O. por abandono).
    recordMatchFinish(room, winner, "abandoned");
    // Sala vs bot: bot pode pedir revanche.
    maybeBotRequestRematch(room);
  }
});

// Callback: 15s sem resposta ao pedido de revanche.
setOnRematchExpired((room) => {
  console.log(`[rematch] expirou em ${room.code}`);
  io.to(room.code).emit("rematchExpired", {});
});

setOnRematchAccepted((room) => {
  // broadcastGameStart já foi chamado dentro do respondRematch.
  // Analytics: revanche é uma partida nova (cobre humano e bot).
  recordMatchStart(room);
});

// Avisa todos os sockets sempre que o conjunto de salas "waiting" muda.
// Quem está no lobby refaz listRooms; quem não está, ignora (não montou
// listener). Custo desprezível pra escala atual e dispensa polling.
setOnLobbyChanged(() => {
  io.emit("lobbyUpdated");
});

// === Sistema de amizade ===
// Registry de presença (username → sockets) + serviço de amizade. O serviço
// é desacoplado do io/Supabase via dependências injetadas (ver friendships.ts).
const onlineRegistry = createOnlineRegistry();

// Emite um evento server→client pra todos os sockets de um username online.
const emitToUser = (username: string, event: string, payload: unknown): void => {
  for (const sid of onlineRegistry.socketsOf(username)) {
    // event/payload são tipados em ServerToClientEvents; o cast evita ginástica
    // de tipos genérica aqui (o protocolo já garante a forma na origem).
    io.to(sid).emit(event as keyof ServerToClientEvents, payload as never);
  }
};

// Um username está "em partida" se algum dos seus sockets está numa sala
// com status playing.
const isInGame = (username: string): boolean =>
  onlineRegistry
    .socketsOf(username)
    .some((sid) => getRoomBySocket(sid)?.status === "playing");

// Cria a sala privada quando um convite é aceito: hospedada pelo convidante.
const createInviteRoom = (
  fromUsername: string,
  _toUsername: string,
): InviteAcceptResult | null => {
  const hostSocketId = onlineRegistry.socketsOf(fromUsername)[0];
  if (!hostSocketId) return null;
  const hostSocket = io.sockets.sockets.get(hostSocketId);
  const room = createRoom({
    hostSocketId,
    hostClientId: (hostSocket?.data.clientId as string | null) ?? null,
    hostAuthUserId: (hostSocket?.data.authUserId as string | null) ?? null,
    hostName: fromUsername,
    color: "random",
    isPrivate: true,
  });
  hostSocket?.join(room.code);
  return { code: room.code, password: room.password };
};

const friendService = createFriendService({
  store: createSupabaseFriendStore(),
  registry: onlineRegistry,
  emitToUser,
  isInGame,
  createInviteRoom,
  sendInvitePush,
});

// === Matchmaking (Partida Rápida) ===
// Injeta no módulo de fila as operações concretas (criar sala + gameStart +
// bot), reusando o broadcastGameStart e o lobby já existentes.
initMatchmaking({
  createHumanMatch: (host: QueuedPlayer, guest: QueuedPlayer) => {
    const room = createRoom({
      hostSocketId: host.socketId,
      hostClientId: host.clientId,
      hostAuthUserId: host.authUserId,
      hostName: host.name,
      color: "random",
      isPrivate: true, // sala de matchmaking não aparece no lobby público
      hostPlatform: host.platform,
    });
    io.sockets.sockets.get(host.socketId)?.join(room.code);
    try {
      joinRoom({
        socketId: guest.socketId,
        clientId: guest.clientId,
        authUserId: guest.authUserId,
        playerName: guest.name,
        code: room.code,
        password: room.password ?? undefined,
        platform: guest.platform,
      });
    } catch {
      // Guest não pôde entrar (caiu nesse meio-tempo, etc) — desfaz a sala.
      leaveRoom(host.socketId);
      return null;
    }
    io.sockets.sockets.get(guest.socketId)?.join(room.code);
    recordMatchStart(room);
    broadcastGameStart(room);
    console.log(`[matchmaking] match real ${host.name} x ${guest.name} → ${room.code}`);
    return { code: room.code, password: room.password };
  },
  createBotMatch: (host: QueuedPlayer) => {
    const room = createRoom({
      hostSocketId: host.socketId,
      hostClientId: host.clientId,
      hostAuthUserId: host.authUserId,
      hostName: host.name,
      color: "random",
      isPrivate: true,
      hostPlatform: host.platform,
    });
    io.sockets.sockets.get(host.socketId)?.join(room.code);
    const added = addMatchmakingBot(room.code);
    if (!added) {
      leaveRoom(host.socketId);
      return null;
    }
    recordMatchStart(added.room);
    broadcastGameStart(added.room);
    maybeScheduleBotMove(added.room);
    console.log(`[matchmaking] timeout → bot ${added.botName} pra ${host.name} → ${room.code}`);
    return { code: room.code, botName: added.botName };
  },
  emitMatchFound: (socketId, payload) => {
    io.to(socketId).emit("matchFound", payload);
  },
  emitStatus: (socketId, payload) => {
    io.to(socketId).emit("matchmakingStatus", payload);
  },
});

// Resolve o username (login) do socket; erro tipado se não estiver logado.
// O sistema de amizade é exclusivo de usuários autenticados.
const requireUsername = async (socket: TypedSocket): Promise<string> => {
  const uid = await ensureAuthUserId(socket);
  if (!uid) throw new LobbyError("not-authenticated", "Faça login para usar amigos.");
  const username = await getUsernameForAuthUser(uid);
  if (!username) {
    throw new LobbyError("not-authenticated", "Sua conta ainda não tem username.");
  }
  return username;
};

// === Conexões ===

// Devolve o authUserId do socket. Se a resolução em background ainda não
// completou, dá await no resolveAuthUser (cache-hit é instantâneo). Isso
// fecha a race em que createRoom/joinRoom rodam antes da resolução
// async terminar — sem isso, o socket aparece como anônimo e o guard
// de self-match não dispara.
const ensureAuthUserId = async (socket: TypedSocket): Promise<string | null> => {
  if (socket.data.authUserId) return socket.data.authUserId;
  const token = socket.data.accessToken as string | null | undefined;
  if (!token) return null;
  const uid = await resolveAuthUser(token);
  socket.data.authUserId = uid;
  return uid;
};

// Resolve o nome a mostrar na sala. Pra user logado, busca `username` na
// tabela profiles do Supabase Auth — fallback pro nome enviado pelo
// cliente (anonimoXXXX) se não tiver username ainda (novo cadastro ou
// erro de fetch). Anônimos sempre usam o nome do cliente.
const resolvePlayerName = async (
  authUserId: string | null,
  clientName: string,
): Promise<string> => {
  if (!authUserId) return clientName;
  const username = await getUsernameForAuthUser(authUserId);
  return username ?? clientName;
};

io.on("connection", (socket: TypedSocket) => {
  // Cliente pode passar `auth.clientId` no handshake pra entrar em modo
  // "reconectável". Sem clientId é modo legado (volátil).
  const clientId = (socket.handshake.auth?.clientId as string | undefined) ?? null;
  // accessToken: JWT do Supabase Auth (so existe se o user esta logado).
  // Usado pra premiar trofeus_casual no fim da partida.
  const accessToken = (socket.handshake.auth?.accessToken as string | undefined) ?? null;
  // platform: de onde o cliente está jogando (web/ios/android). Validado pra
  // não confiar cegamente no que vem do socket. null = cliente antigo/inválido.
  const rawPlatform = socket.handshake.auth?.platform as string | undefined;
  const platform =
    rawPlatform === "web" || rawPlatform === "ios" || rawPlatform === "android"
      ? rawPlatform
      : null;
  socket.data.clientId = clientId;
  socket.data.accessToken = accessToken;
  socket.data.authUserId = null;
  socket.data.platform = platform;
  console.log(`[+] conectou: ${socket.id}${clientId ? ` (clientId ${clientId.slice(0, 8)}…)` : ""}`);

  // Resolve identidade persistente via Supabase (fire-and-forget — não
  // bloqueia outros handlers). Emite `profile` quando resolver.
  // Se Supabase estiver fora do ar, o socket continua funcionando mas
  // o display_name fica null no cliente até a próxima conexão.
  if (clientId) {
    void getOrCreateProfile(clientId)
      .then(async (profile) => {
        socket.emit("profile", profile);
        // Fase 2 (analytics): linka este aparelho à conta logada, se houver.
        // Separa anônimo (user_id NULL) de cadastrado nas métricas.
        // ensureAuthUserId aguarda o token resolver (cache-aware), evitando
        // o race de linkar antes da linha do player existir.
        const uid = await ensureAuthUserId(socket);
        if (uid) void linkPlayerToUser(clientId, uid);
        // Fase 4 (analytics): registra a plataforma de origem do aparelho.
        if (platform) void updatePlayerPlatform(clientId, platform);
      })
      .catch((err) => {
        console.error(`[profile] falhou pra ${clientId.slice(0, 8)}…:`, err);
      });
  }

  // Resolve authUserId (JWT) em paralelo. Vai estar disponivel antes do
  // createRoom/joinRoom em casos normais (latencia Supabase << UX humana).
  // Se chegar tarde, o socket cria sala como anonimo — aceitavel.
  if (accessToken) {
    void (async () => {
      const uid = await resolveAuthUser(accessToken);
      socket.data.authUserId = uid;
      if (!uid) return;
      console.log(`[auth] socket ${socket.id} = user ${uid.slice(0, 8)}…`);
      // Presença online pro sistema de amizade: registra o socket sob o
      // username e, se o usuário acabou de ficar online, avisa os amigos.
      const username = await getUsernameForAuthUser(uid);
      if (!username) return;
      socket.data.username = username;
      const wasOffline = onlineRegistry.add(username, socket.id);
      if (wasOffline) {
        void friendService.notifyFriendsOfStatus(username, "online");
      }
    })();
  }

  // Reanchor: cliente conhecido voltou a uma sala em andamento.
  if (clientId) {
    // Resolve a identidade do JWT ANTES de reanexar pra recuperar o
    // authUserId caso o player tenha entrado anônimo (race do cold start).
    // ensureAuthUserId é cache-hit (token já resolvido no 1º connect), então
    // o atraso até o socket.join é desprezível.
    void (async () => {
      const reanchorUid = await ensureAuthUserId(socket);
      const anchor = attemptReanchor(clientId, socket.id, reanchorUid);
      if (anchor) {
        socket.join(anchor.room.code);
        console.log(`[reanchor] ${clientId.slice(0, 8)}… voltou pra ${anchor.room.code}`);
        // Reentrega identidade + state atual.
        if (anchor.room.gameState) {
          sendGameStartTo(anchor.room, anchor.player);
        }
      }
    })();
  }

  socket.on("createRoom", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateCreateRoom(p);
      const hostAuthUserId = await ensureAuthUserId(socket);
      const hostName = await resolvePlayerName(hostAuthUserId, p.hostName);
      console.log(
        `[createRoom] socket=${socket.id} clientId=${short(clientId)} authUserId=${short(hostAuthUserId)} name=${hostName}`,
      );
      const room = createRoom({
        hostSocketId: socket.id,
        hostClientId: clientId,
        hostAuthUserId,
        hostName,
        color: p.color,
        isPrivate: p.isPrivate,
        hostPlatform: socket.data.platform ?? null,
      });
      socket.join(room.code);
      console.log(`[room] criada ${room.code} por ${hostName} (${socket.id})`);
      // Agenda bot rescue: se ninguém entrar em 10-15s, bot entra como guest.
      // (Salas privadas e salas criadas por bots são puladas dentro da função.)
      scheduleBotRescue(room);
      return toRoomDetail(room, socket.id);
    })(payload, socket, ack),
  );

  socket.on("joinRoom", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateJoinRoom(p);
      const authUserId = await ensureAuthUserId(socket);
      const playerName = await resolvePlayerName(authUserId, p.playerName);
      console.log(
        `[joinRoom] socket=${socket.id} clientId=${short(clientId)} authUserId=${short(authUserId)} sala=${p.code} name=${playerName}`,
      );
      const room = joinRoom({
        socketId: socket.id,
        clientId,
        authUserId,
        playerName,
        code: p.code,
        password: p.password,
        platform: socket.data.platform ?? null,
      });
      socket.join(room.code);
      console.log(`[room] ${playerName} entrou em ${room.code}`);

      // Analytics: partida começou (humano entrou numa sala → playing).
      recordMatchStart(room);

      broadcastGameStart(room);
      // Se a sala era de bot, ele é P1 e começa (50% das vezes via random).
      maybeScheduleBotMove(room);
      return toRoomDetail(room, socket.id);
    })(payload, socket, ack),
  );

  socket.on("listRooms", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateListRooms(p);
      const uid = await ensureAuthUserId(socket);
      const rooms = listPublicRooms(uid);
      console.log(
        `[listRooms] socket=${socket.id} clientId=${short(clientId)} authUserId=${short(uid)} returned=${rooms.length}`,
      );
      return { rooms };
    })(payload, socket, ack),
  );

  socket.on("leaveRoom", (payload, ack) =>
    rpc(async () => {
      const roomBefore = getRoomBySocket(socket.id);
      if (roomBefore) clearRematch(roomBefore);
      // A partida estava rolando? Só nesse caso a saída vira W.O. pro
      // jogador que ficou (abandono = derrota). Se já tinha acabado
      // (alguém chegou na linha / W.O.), não premia de novo.
      const wasPlaying = roomBefore?.status === "playing";
      const room = leaveRoom(socket.id);
      if (room) {
        socket.leave(room.code);
        // Abandono no meio da partida: quem ficou vence por W.O.
        const winner = room.players[0];
        if (wasPlaying && winner && room.gameState) {
          // Premia ANTES do emit pra o refreshTrofeus do cliente não ler
          // valor stale (mesmo motivo da vitória normal).
          if (winner.authUserId) {
            await awardCasualTrophy(winner.authUserId, 1);
          } else {
            console.warn(
              `[leave-wo] sala ${room.code}: ${winner.enginePlayer} venceu por saída do oponente mas está sem authUserId (race de cold-start / sessão sem token) — troféu NÃO concedido`,
            );
          }
          io.to(room.code).emit("gameOver", {
            winner: winner.enginePlayer,
            reason: "abandon",
          });
          // Analytics: oponente saiu no meio da partida (W.O. por saída).
          recordMatchFinish(room, winner.enginePlayer, "leave_wo");
        }
        socket.to(room.code).emit("opponentLeft");
      }
      return null;
    })(payload, socket, ack),
  );

  // === Move autoritativo ===
  // Validações em camadas: sala existe → partida rolando → é a sua vez →
  // applyMove aceita. Qualquer "não" devolve erro tipado pelo ack, e o
  // estado não é modificado. Cliente nunca consegue avançar sem o "ok" daqui.
  socket.on("move", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateMove(p);
      const room = getRoomBySocket(socket.id);
      if (!room) throw new LobbyError("not-in-room");
      if (room.status === "finished") throw new LobbyError("game-over");
      if (room.status !== "playing" || !room.gameState) {
        throw new LobbyError("internal-error", "sala não está em partida");
      }
      const now = Date.now();
      if (room.countdownEndsAt && now < room.countdownEndsAt) {
        throw new LobbyError("not-your-turn", "countdown ativo");
      }

      const me = room.players.find((pl) => pl.socketId === socket.id);
      if (!me) {
        throw new LobbyError("internal-error", "socket fora da lista de players");
      }
      if (room.gameState.turn !== me.enginePlayer) {
        throw new LobbyError("not-your-turn");
      }

      const result = applyMove(room.gameState, me.enginePlayer, p.move);
      if (!result.ok) {
        // applyMove devolve string descritiva — passa adiante pro cliente
        // saber por que (parede ilegal, casa não-vizinha, etc).
        throw new LobbyError("invalid-move", result.error);
      }

      // Estado virou autoritativo. Persiste e broadcasta pros 2 sockets da room.
      // Inclui o `move` no payload pra o replay client-side empilhar o lance
      // do oponente (que o client não vê de outra forma, só vê state final).
      room.gameState = result.state;
      // Debita o tempo gasto neste turno e reinicia o cronômetro pro próximo.
      chargeTurnTime(room, me.enginePlayer, now);
      const wireState = serializeState(result.state);
      io.to(room.code).emit("stateUpdate", { state: wireState, move: p.move });

      // Vitória? Fecha a sala e dispara gameOver.
      if (result.state.winner !== null) {
        room.status = "finished";
        // Premia o vencedor ANTES do emit pra evitar race com o
        // refreshTrofeus do cliente: o client recebe gameOver e lê
        // a tabela imediatamente — se o increment ainda não tiver
        // commitado, ele puxa valor stale.
        const winnerPlayer = room.players.find(
          (pl) => pl.enginePlayer === result.state.winner,
        );
        if (winnerPlayer?.authUserId) {
          await awardCasualTrophy(winnerPlayer.authUserId, 1);
        }
        io.to(room.code).emit("gameOver", { winner: result.state.winner, reason: "goal" });
        // Analytics: vitória normal (peão chegou na linha de chegada).
        recordMatchFinish(room, result.state.winner, "goal");
        // Sala vs bot: bot pode pedir revanche.
        maybeBotRequestRematch(room);
      }

      // Se o oponente é um bot e agora é a vez dele, agenda jogada.
      maybeScheduleBotMove(room);

      return null;
    })(payload, socket, ack),
  );

  // === Vitória por tempo (relógio estourou) ===
  // O cliente roda o relógio e avisa aqui quando zera. O SERVER é a fonte da
  // verdade: consulta o próprio relógio e só encerra/premia se confirmar o
  // estouro. Sem payload de vencedor — quem está com o relógio correndo é o
  // jogador da vez, então é ele quem perde por tempo.
  socket.on("reportTimeout", (payload, ack) =>
    rpc(async () => {
      const room = getRoomBySocket(socket.id);
      if (!room) throw new LobbyError("not-in-room");
      // Já acabou (chegada, W.O. ou outro report) — idempotente, ignora.
      if (room.status === "finished") return null;
      if (room.status !== "playing" || !room.gameState) {
        throw new LobbyError("internal-error", "sala não está em partida");
      }
      if (room.gameState.winner !== null) return null;

      const now = Date.now();
      const loser = room.gameState.turn; // quem está com o relógio correndo
      const used = turnTimeUsedMs(room, loser, now);
      // Tolerância pequena: o cliente pode reportar uns ms antes pela
      // granularidade do tick. Acima dela, ignora — protege contra report
      // forjado (relógio do server não confirma o estouro).
      const TIMEOUT_TOLERANCE_MS = 2_000;
      if (used < GAME_TIME_TOTAL_MS - TIMEOUT_TOLERANCE_MS) {
        console.log(
          `[timeout] report ignorado em ${room.code}: jogador ${loser} usou ${Math.round(used / 1000)}s (< ${GAME_TIME_TOTAL_MS / 1000}s)`,
        );
        return null;
      }

      const winner: PlayerId = loser === 1 ? 2 : 1;
      console.log(`[timeout] sala ${room.code}: ${winner} venceu (relógio do ${loser} estourou)`);
      room.gameState = { ...room.gameState, winner };
      room.status = "finished";
      io.to(room.code).emit("stateUpdate", { state: serializeState(room.gameState) });
      const winnerPlayer = room.players.find((pl) => pl.enginePlayer === winner);
      if (winnerPlayer?.authUserId) {
        await awardCasualTrophy(winnerPlayer.authUserId, 1);
      }
      io.to(room.code).emit("gameOver", { winner, reason: "timeout" });
      // Analytics: relógio do perdedor estourou (derrota por tempo).
      recordMatchFinish(room, winner, "timeout_wo");
      // Sala vs bot: bot pode pedir revanche.
      maybeBotRequestRematch(room);
      return null;
    })(payload, socket, ack),
  );

  // === Rematch ===
  socket.on("requestRematch", (payload, ack) =>
    rpc(() => {
      const result = requestRematch(socket.id);
      if (result.kind === "mutual") {
        // Ambos pediram dentro da janela — nova partida direto.
        console.log(`[rematch] mutual em ${result.room.code}`);
        broadcastGameStart(result.room);
      } else {
        // Notifica oponente do pedido.
        const opponent = result.room.players.find((p) => p.socketId !== socket.id);
        if (opponent && result.room.rematch) {
          if (opponent.isBot) {
            // Bot auto-aceita rematch após 1-4s. Não dá pra usar
            // respondRematch() porque ela exige socketId em socketToRoom
            // E clientId não-nulo — bot falha em ambos. acceptRematchAsBot
            // recebe a room direto e pula as guardas.
            const delay = 1000 + Math.random() * 3000;
            setTimeout(() => {
              try {
                // Re-checa a room — pode ter sumido (humano saiu, etc).
                const current = getRoomBySocket(socket.id);
                if (!current || current.code !== result.room.code) return;
                if (!current.rematch) return;
                acceptRematchAsBot(current);
                console.log(`[rematch] bot aceitou em ${current.code}`);
                broadcastGameStart(current);
                maybeScheduleBotMove(current);
              } catch (err) {
                console.warn(`[rematch] bot accept falhou:`, err);
              }
            }, delay);
          } else {
            io.to(opponent.socketId).emit("rematchRequested", {
              fromName: result.requester.name,
              expiresAt: result.room.rematch.expiresAt,
            });
          }
        }
      }
      return null;
    })(payload, socket, ack),
  );

  socket.on("respondRematch", (payload, ack) =>
    rpc((p: typeof payload) => {
      const room = respondRematch(socket.id, p.accept);
      if (p.accept) {
        console.log(`[rematch] aceito em ${room.code}`);
        broadcastGameStart(room);
        maybeScheduleBotMove(room);
      } else {
        // Notifica quem pediu que foi recusado.
        const requesterSocket = room.players.find((p) => p.socketId !== socket.id);
        if (requesterSocket) {
          io.to(requesterSocket.socketId).emit("rematchDeclined", {});
        }
      }
      return null;
    })(payload, socket, ack),
  );

  // === Sistema de amizade ===
  // Todos exigem login (requireUsername lança not-authenticated se anônimo).

  socket.on("sendFriendRequest", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateSendFriendRequest(p);
      const me = await requireUsername(socket);
      return friendService.sendFriendRequest(me, p.targetUsername);
    })(payload, socket, ack),
  );

  socket.on("acceptFriendRequest", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateRespondFriendRequest(p);
      const me = await requireUsername(socket);
      return friendService.acceptFriendRequest(me, p.requesterUsername);
    })(payload, socket, ack),
  );

  socket.on("declineFriendRequest", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateRespondFriendRequest(p);
      const me = await requireUsername(socket);
      return friendService.declineFriendRequest(me, p.requesterUsername);
    })(payload, socket, ack),
  );

  socket.on("removeFriend", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateRemoveFriend(p);
      const me = await requireUsername(socket);
      return friendService.removeFriend(me, p.targetUsername);
    })(payload, socket, ack),
  );

  socket.on("getFriends", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateGetFriends(p);
      const me = await requireUsername(socket);
      return friendService.getFriends(me);
    })(payload, socket, ack),
  );

  socket.on("createFriendInviteLink", (payload, ack) =>
    rpc(async () => {
      const me = await requireUsername(socket);
      return friendService.createFriendInviteLink(me);
    })(payload, socket, ack),
  );

  socket.on("redeemFriendInvite", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateRedeemFriendInvite(p);
      const me = await requireUsername(socket);
      return friendService.redeemFriendInvite(me, p.token);
    })(payload, socket, ack),
  );

  socket.on("sendGameInvite", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateSendGameInvite(p);
      const me = await requireUsername(socket);
      return friendService.sendGameInvite(me, p.targetUsername);
    })(payload, socket, ack),
  );

  socket.on("respondGameInvite", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateRespondGameInvite(p);
      const me = await requireUsername(socket);
      return friendService.respondGameInvite(me, p.fromUsername, p.accept);
    })(payload, socket, ack),
  );

  socket.on("registerPushToken", (payload, ack) =>
    rpc(async (p: typeof payload) => {
      validateRegisterPushToken(p);
      const uid = await ensureAuthUserId(socket);
      if (!uid) throw new LobbyError("not-authenticated", "Faça login.");
      await upsertPushToken(uid, p.token, p.platform);
      return null;
    })(payload, socket, ack),
  );

  // === Matchmaking (Partida Rápida) ===
  socket.on("joinMatchmaking", (payload, ack) =>
    rpc(async () => {
      const authUserId = await ensureAuthUserId(socket);
      // Nome exibido pro oponente: username se logado, senão o display_name do
      // profile anônimo (mesma resolução do createRoom/joinRoom).
      const fallback = clientId
        ? (await getOrCreateProfile(clientId)).displayName
        : (socket.data.username ?? "Anônimo");
      const name = await resolvePlayerName(authUserId, fallback);
      const player: QueuedPlayer = {
        socketId: socket.id,
        clientId,
        authUserId,
        name,
        platform: socket.data.platform ?? null,
        joinedAt: Date.now(),
      };
      joinMatchmaking(player);
      return null;
    })(payload, socket, ack),
  );

  socket.on("leaveMatchmaking", (payload, ack) =>
    rpc(() => {
      leaveMatchmaking(socket.id);
      return null;
    })(payload, socket, ack),
  );

  socket.on("disconnect", (reason) => {
    console.log(`[-] desconectou: ${socket.id} (${reason})`);
    // Sai da fila de matchmaking se estava nela (não bloqueia o resto).
    leaveMatchmaking(socket.id);
    // Baixa de presença: se foi o último socket do usuário, avisa amigos.
    const off = onlineRegistry.remove(socket.id);
    if (off?.nowOffline) {
      void friendService.notifyFriendsOfStatus(off.username, "offline");
    }
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    if (clientId) {
      // Modo reconectável: agenda timer, oponente não é avisado ainda.
      // Se o player voltar dentro do timeout, ninguém perde nada.
      console.log(`[disconnect] ${clientId.slice(0, 8)}… aguardando reanexa por até ${process.env.DISCONNECT_TIMEOUT_MS ?? 30_000}ms`);
      markDisconnected(socket.id);
    } else {
      // Modo volátil: leaveRoom imediato, oponente recebe opponentLeft.
      const wasPlaying = room.status === "playing";
      const left = leaveRoom(socket.id);
      io.to(room.code).emit("opponentLeft");
      // Se a partida estava rolando, quem ficou vence por W.O. — premia e
      // emite gameOver (antes esse caminho só registrava analytics e o
      // vencedor ficava sem troféu nem fim de partida).
      if (wasPlaying && left && left.gameState) {
        const winner = left.players[0];
        if (winner?.authUserId) {
          void awardCasualTrophy(winner.authUserId, 1);
        } else if (winner) {
          console.warn(
            `[disconnect-wo volátil] sala ${left.code}: vencedor sem authUserId — troféu NÃO concedido`,
          );
        }
        if (winner) {
          io.to(left.code).emit("gameOver", { winner: winner.enginePlayer, reason: "abandon" });
        }
        recordMatchFinish(left, winner?.enginePlayer ?? null, "leave_wo");
      }
    }
  });
});

// Quando o bot rescue injeta um bot guest, dispara o gameStart e
// agenda eventual jogada inicial do bot (se for vez dele).
setOnBotRescueStarted((room) => {
  broadcastGameStart(room);
  maybeScheduleBotMove(room);
});

// === Presença online (Fase 6) ===
//
// Computa a foto atual a partir dos sockets conectados em memória. Dedup por
// clientId (mesma pessoa em 2 abas = 1). Bots não entram aqui — têm socketId
// fake e nunca aparecem em io.sockets.sockets.
const computeOnlineStats = (): OnlineStats => {
  // clientId → { logado, em jogo }. Agrega múltiplos sockets do mesmo aparelho.
  const byClient = new Map<string, { registered: boolean; inGame: boolean }>();
  let anonNoClient = 0;
  let anonNoClientInGame = 0;

  for (const [, sock] of io.sockets.sockets) {
    const cid = (sock.data.clientId as string | null) ?? null;
    const auth = (sock.data.authUserId as string | null) ?? null;
    const inGame = getRoomBySocket(sock.id)?.status === "playing";
    if (cid) {
      const prev = byClient.get(cid);
      byClient.set(cid, {
        registered: !!auth || (prev?.registered ?? false),
        inGame: inGame || (prev?.inGame ?? false),
      });
    } else {
      anonNoClient++;
      if (inGame) anonNoClientInGame++;
    }
  }

  let inGame = anonNoClientInGame;
  let registered = 0;
  for (const v of byClient.values()) {
    if (v.inGame) inGame++;
    if (v.registered) registered++;
  }
  const total = byClient.size + anonNoClient;
  return {
    online_total: total,
    online_in_game: inGame,
    online_in_lobby: total - inGame,
    registered_online: registered,
    anonymous_online: total - registered,
  };
};

const SNAPSHOT_INTERVAL_MS = Number(process.env.SNAPSHOT_MS ?? 60_000);

httpServer.listen(PORT, () => {
  console.log(`Barreira server rodando em http://localhost:${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/health`);
  console.log(`Socket:  ws://localhost:${PORT}`);
  // Inicializa o bot manager — vai povoar o lobby com salas fantasmas.
  startBotManager(io);
  // Cron diário de reengajamento (18h BRT): push pra quem sumiu há 48h+.
  startReengagementCron();
  // Limpeza periódica das janelas de rate-limit (libera memória de IPs/sockets).
  startHardeningSweeper();
  // Snapshot periódico de presença online pro dashboard.
  setInterval(() => {
    try {
      recordOnlineSnapshot(computeOnlineStats());
    } catch (err) {
      console.warn("[snapshots] falha ao computar:", err);
    }
  }, SNAPSHOT_INTERVAL_MS);
  console.log(`Snapshots de presença a cada ${SNAPSHOT_INTERVAL_MS}ms`);
});
