// === Barreira — servidor multiplayer ===
//
// Fase 2: lobby + início de partida.
// Os handlers RPC devolvem RpcResult<T> via ack; estado de partida vai
// por push (gameStart / stateUpdate / etc).

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
  createRoom,
  getRoomBySocket,
  joinRoom,
  leaveRoom,
  listPublicRooms,
  toRoomDetail,
  type ServerRoom,
} from "./lobby.js";

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
const broadcastGameStart = (room: ServerRoom) => {
  if (!room.gameState) return;
  const wireState = serializeState(room.gameState);

  for (const me of room.players) {
    const opponent = room.players.find((p) => p.socketId !== me.socketId);
    if (!opponent) continue;
    const payload: GameStartPayload = {
      state: wireState,
      yourEnginePlayer: me.enginePlayer,
      yourColor: me.color,
      opponentName: opponent.name,
      opponentColor: opponent.color,
    };
    io.to(me.socketId).emit("gameStart", payload);
  }
};

// === Conexões ===

io.on("connection", (socket: TypedSocket) => {
  console.log(`[+] conectou: ${socket.id}`);

  socket.on("createRoom", (payload, ack) =>
    rpc((p: typeof payload) => {
      const room = createRoom({
        hostSocketId: socket.id,
        hostName: p.hostName,
        color: p.color,
        isPrivate: p.isPrivate,
      });
      socket.join(room.code);
      console.log(`[room] criada ${room.code} por ${p.hostName} (${socket.id})`);
      return toRoomDetail(room, socket.id);
    })(payload, socket, ack),
  );

  socket.on("joinRoom", (payload, ack) =>
    rpc((p: typeof payload) => {
      const room = joinRoom({
        socketId: socket.id,
        playerName: p.playerName,
        code: p.code,
        password: p.password,
      });
      socket.join(room.code);
      console.log(`[room] ${p.playerName} entrou em ${room.code}`);

      // Sala fechou: dispara início de partida pros 2.
      broadcastGameStart(room);
      return toRoomDetail(room, socket.id);
    })(payload, socket, ack),
  );

  socket.on("listRooms", (payload, ack) =>
    rpc(() => ({ rooms: listPublicRooms() }))(payload, socket, ack),
  );

  socket.on("leaveRoom", (payload, ack) =>
    rpc(() => {
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
      }

      return null;
    })(payload, socket, ack),
  );

  socket.on("disconnect", (reason) => {
    console.log(`[-] desconectou: ${socket.id} (${reason})`);
    const room = getRoomBySocket(socket.id);
    if (room) {
      leaveRoom(socket.id);
      io.to(room.code).emit("opponentLeft");
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Barreira server rodando em http://localhost:${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/health`);
  console.log(`Socket:  ws://localhost:${PORT}`);
});
