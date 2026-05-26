// === Barreira — servidor multiplayer ===
//
// Os handlers RPC devolvem RpcResult<T> via ack; estado de partida vai
// por push (gameStart / stateUpdate / profile / etc).

import dotenv from "dotenv";
import { resolve } from "node:path";

// Tenta .env no cwd (raiz) e depois um nível acima (caso cwd seja server/)
dotenv.config({ path: resolve(process.cwd(), ".env") }) ||
  dotenv.config({ path: resolve(process.cwd(), "..", ".env") });
import express from "express";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  applyMove,
  serializeState,
  type ClientToServerEvents,
  type GameStartPayload,
  type RpcError,
  type RpcResult,
  type ServerToClientEvents,
} from "@barreira/shared";
import {
  LobbyError,
  attemptReanchor,
  clearRematch,
  createRoom,
  getRoomBySocket,
  joinRoom,
  leaveRoom,
  listPublicRooms,
  markDisconnected,
  requestRematch,
  respondRematch,
  setOnPlayerTimeout,
  setOnRematchAccepted,
  setOnRematchExpired,
  toRoomDetail,
  type ServerPlayer,
  type ServerRoom,
} from "./lobby.js";
import { getOrCreateProfile } from "./profiles.js";
import { resolveAuthUser } from "./auth.js";
import { awardCasualTrophy } from "./trophies.js";
import {
  maybeScheduleBotMove,
  scheduleBotRescue,
  setOnBotRescueStarted,
  startBotManager,
} from "./botManager.js";

const PORT = Number(process.env.PORT ?? 3000);

// === HTTP ===
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// === WebSocket ===
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*" },
});

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// === Helpers ===

const errResult = (error: RpcError, message?: string): RpcResult<never> => ({
  ok: false,
  error,
  message,
});

const okResult = <T>(data: T): RpcResult<T> => ({ ok: true, data });

// Envelopa um handler RPC: captura LobbyError e devolve via ack;
// qualquer outra exceção vira "internal-error" e é logada.
const rpc = <P, R>(
  handler: (payload: P, socket: TypedSocket) => Promise<R> | R,
) => {
  return async (payload: P, socket: TypedSocket, ack: (res: RpcResult<R>) => void) => {
    try {
      const data = await handler(payload, socket);
      ack(okResult(data));
    } catch (err) {
      if (err instanceof LobbyError) {
        ack(errResult(err.code, err.message));
        return;
      }
      console.error("[rpc] erro inesperado:", err);
      ack(errResult("internal-error", err instanceof Error ? err.message : String(err)));
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
  };
  io.to(me.socketId).emit("gameStart", payload);
};

// Callback: timer de desconexão estourou — quem sobrou vence por W.O.
setOnPlayerTimeout((_clientId, room, remaining) => {
  if (remaining.length === 1 && room.gameState) {
    const winner = remaining[0].enginePlayer;
    console.log(
      `[timeout] sala ${room.code}: ${winner} venceu por W.O. (oponente não voltou)`,
    );
    // Marca winner no state pra UI mostrar gameOver coerente.
    room.gameState = { ...room.gameState, winner };
    io.to(room.code).emit("stateUpdate", { state: serializeState(room.gameState) });
    io.to(room.code).emit("gameOver", { winner });
    io.to(room.code).emit("opponentLeft");
    // Premia o vencedor logado (W.O. conta como vitoria casual).
    if (remaining[0].authUserId) {
      void awardCasualTrophy(remaining[0].authUserId, 1);
    }
  }
});

// Callback: 15s sem resposta ao pedido de revanche.
setOnRematchExpired((room) => {
  console.log(`[rematch] expirou em ${room.code}`);
  io.to(room.code).emit("rematchExpired", {});
});

setOnRematchAccepted((_room) => {
  // broadcastGameStart já foi chamado dentro do respondRematch.
});

// === Conexões ===

io.on("connection", (socket: TypedSocket) => {
  // Cliente pode passar `auth.clientId` no handshake pra entrar em modo
  // "reconectável". Sem clientId é modo legado (volátil).
  const clientId = (socket.handshake.auth?.clientId as string | undefined) ?? null;
  // accessToken: JWT do Supabase Auth (so existe se o user esta logado).
  // Usado pra premiar trofeus_casual no fim da partida.
  const accessToken = (socket.handshake.auth?.accessToken as string | undefined) ?? null;
  socket.data.clientId = clientId;
  socket.data.authUserId = null;
  console.log(`[+] conectou: ${socket.id}${clientId ? ` (clientId ${clientId.slice(0, 8)}…)` : ""}`);

  // Resolve identidade persistente via Supabase (fire-and-forget — não
  // bloqueia outros handlers). Emite `profile` quando resolver.
  // Se Supabase estiver fora do ar, o socket continua funcionando mas
  // o display_name fica null no cliente até a próxima conexão.
  if (clientId) {
    void getOrCreateProfile(clientId)
      .then((profile) => {
        socket.emit("profile", profile);
      })
      .catch((err) => {
        console.error(`[profile] falhou pra ${clientId.slice(0, 8)}…:`, err);
      });
  }

  // Resolve authUserId (JWT) em paralelo. Vai estar disponivel antes do
  // createRoom/joinRoom em casos normais (latencia Supabase << UX humana).
  // Se chegar tarde, o socket cria sala como anonimo — aceitavel.
  if (accessToken) {
    void resolveAuthUser(accessToken).then((uid) => {
      socket.data.authUserId = uid;
      if (uid) {
        console.log(`[auth] socket ${socket.id} = user ${uid.slice(0, 8)}…`);
      }
    });
  }

  // Reanchor: cliente conhecido voltou a uma sala em andamento.
  if (clientId) {
    const anchor = attemptReanchor(clientId, socket.id);
    if (anchor) {
      socket.join(anchor.room.code);
      console.log(`[reanchor] ${clientId.slice(0, 8)}… voltou pra ${anchor.room.code}`);
      // Reentrega identidade + state atual.
      if (anchor.room.gameState) {
        sendGameStartTo(anchor.room, anchor.player);
      }
    }
  }

  socket.on("createRoom", (payload, ack) =>
    rpc((p: typeof payload) => {
      const room = createRoom({
        hostSocketId: socket.id,
        hostClientId: clientId,
        hostAuthUserId: socket.data.authUserId,
        hostName: p.hostName,
        color: p.color,
        isPrivate: p.isPrivate,
      });
      socket.join(room.code);
      console.log(`[room] criada ${room.code} por ${p.hostName} (${socket.id})`);
      // Agenda bot rescue: se ninguém entrar em 10-15s, bot entra como guest.
      // (Salas privadas e salas criadas por bots são puladas dentro da função.)
      scheduleBotRescue(room);
      return toRoomDetail(room, socket.id);
    })(payload, socket, ack),
  );

  socket.on("joinRoom", (payload, ack) =>
    rpc((p: typeof payload) => {
      const room = joinRoom({
        socketId: socket.id,
        clientId,
        authUserId: socket.data.authUserId,
        playerName: p.playerName,
        code: p.code,
        password: p.password,
      });
      socket.join(room.code);
      console.log(`[room] ${p.playerName} entrou em ${room.code}`);

      broadcastGameStart(room);
      // Se a sala era de bot, ele é P1 e começa (50% das vezes via random).
      maybeScheduleBotMove(room);
      return toRoomDetail(room, socket.id);
    })(payload, socket, ack),
  );

  socket.on("listRooms", (payload, ack) =>
    rpc(() => ({ rooms: listPublicRooms() }))(payload, socket, ack),
  );

  socket.on("leaveRoom", (payload, ack) =>
    rpc(() => {
      const roomBefore = getRoomBySocket(socket.id);
      if (roomBefore) clearRematch(roomBefore);
      const room = leaveRoom(socket.id);
      if (room) {
        socket.to(room.code).emit("opponentLeft");
        socket.leave(room.code);
      }
      return null;
    })(payload, socket, ack),
  );

  // === Move autoritativo ===
  // Validações em camadas: sala existe → partida rolando → é a sua vez →
  // applyMove aceita. Qualquer "não" devolve erro tipado pelo ack, e o
  // estado não é modificado. Cliente nunca consegue avançar sem o "ok" daqui.
  socket.on("move", (payload, ack) =>
    rpc((p: typeof payload) => {
      const room = getRoomBySocket(socket.id);
      if (!room) throw new LobbyError("not-in-room");
      if (room.status === "finished") throw new LobbyError("game-over");
      if (room.status !== "playing" || !room.gameState) {
        throw new LobbyError("internal-error", "sala não está em partida");
      }
      if (room.countdownEndsAt && Date.now() < room.countdownEndsAt) {
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
      room.gameState = result.state;
      const wireState = serializeState(result.state);
      io.to(room.code).emit("stateUpdate", { state: wireState });

      // Vitória? Fecha a sala e dispara gameOver.
      if (result.state.winner !== null) {
        room.status = "finished";
        io.to(room.code).emit("gameOver", { winner: result.state.winner });
        // Premia o vencedor se for um user logado (vale contra bot tambem).
        const winnerPlayer = room.players.find(
          (pl) => pl.enginePlayer === result.state.winner,
        );
        if (winnerPlayer?.authUserId) {
          void awardCasualTrophy(winnerPlayer.authUserId, 1);
        }
      }

      // Se o oponente é um bot e agora é a vez dele, agenda jogada.
      maybeScheduleBotMove(room);

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
            // Bot auto-aceita rematch após 1-4s
            const delay = 1000 + Math.random() * 3000;
            setTimeout(() => {
              try {
                const room = respondRematch(opponent.socketId, true);
                console.log(`[rematch] bot aceitou em ${room.code}`);
                broadcastGameStart(room);
                maybeScheduleBotMove(room);
              } catch {
                // Room may have been cleaned up
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

  socket.on("disconnect", (reason) => {
    console.log(`[-] desconectou: ${socket.id} (${reason})`);
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    if (clientId) {
      // Modo reconectável: agenda timer, oponente não é avisado ainda.
      // Se o player voltar dentro do timeout, ninguém perde nada.
      console.log(`[disconnect] ${clientId.slice(0, 8)}… aguardando reanexa por até ${process.env.DISCONNECT_TIMEOUT_MS ?? 30_000}ms`);
      markDisconnected(socket.id);
    } else {
      // Modo volátil: leaveRoom imediato, oponente recebe opponentLeft.
      leaveRoom(socket.id);
      io.to(room.code).emit("opponentLeft");
    }
  });
});

// Quando o bot rescue injeta um bot guest, dispara o gameStart e
// agenda eventual jogada inicial do bot (se for vez dele).
setOnBotRescueStarted((room) => {
  broadcastGameStart(room);
  maybeScheduleBotMove(room);
});

httpServer.listen(PORT, () => {
  console.log(`Barreira server rodando em http://localhost:${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/health`);
  console.log(`Socket:  ws://localhost:${PORT}`);
  // Inicializa o bot manager — vai povoar o lobby com salas fantasmas.
  startBotManager(io);
});
