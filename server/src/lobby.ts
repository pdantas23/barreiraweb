// === Lobby em memória ===
//
// Responsabilidades:
// - guardar salas ativas (Map roomCode → ServerRoom)
// - cuidar de criar / listar / entrar / sair
// - resolver cores e enginePlayer no momento que a sala fica cheia
// - inicializar o GameState pra a partida começar
//
// Sem persistência. Se o processo cair, todas as salas somem — OK por enquanto.

import {
  initialState,
  type Color,
  type ColorChoice,
  type GameState,
  type PlayerId,
  type PublicRoom,
  type RoomDetail,
} from "@barreira/shared";

// === Tipos internos ===

export type RoomStatus = "waiting" | "playing" | "finished";

export type ServerPlayer = {
  socketId: string;
  name: string;
  color: Color;
  enginePlayer: PlayerId;
};

export type ServerRoom = {
  code: string;
  status: RoomStatus;
  isPrivate: boolean;
  password: string | null;
  // Host é sempre players[0] (o que criou a sala).
  // hostColor guarda a escolha original (pode ser "random") só pra UI da lista.
  hostColor: ColorChoice;
  hostName: string;
  players: ServerPlayer[];
  gameState: GameState | null;
};

// === Estado global do lobby ===

const rooms = new Map<string, ServerRoom>();
const socketToRoom = new Map<string, string>();

// === Helpers ===

// Sem 0/O/1/I pra reduzir confusão visual quando o jogador soletra o código.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateCode = (): string => {
  // Gera até dar um código não usado. Probabilidade de colisão = 32^6 ≈ 1B.
  for (let attempt = 0; attempt < 10; attempt++) {
    let out = "";
    for (let i = 0; i < 6; i++) {
      out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!rooms.has(out)) return out;
  }
  throw new Error("não consegui gerar código único — o lobby está absurdamente cheio");
};

const generatePassword = (): string => {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
};

// "random" → "cyan" ou "red" via sorteio.
const resolveColor = (choice: ColorChoice): Color => {
  if (choice === "cyan") return "cyan";
  if (choice === "red") return "red";
  return Math.random() < 0.5 ? "cyan" : "red";
};

const oppositeColor = (c: Color): Color => (c === "cyan" ? "red" : "cyan");

// === Projeções pro cliente ===

export const toPublicRoom = (room: ServerRoom): PublicRoom => ({
  code: room.code,
  hostName: room.hostName,
  hostColor: room.hostColor,
  isPrivate: room.isPrivate,
  playerCount: room.players.length as 1 | 2,
});

export const toRoomDetail = (
  room: ServerRoom,
  forSocketId: string,
): RoomDetail => {
  const isHost = room.players[0]?.socketId === forSocketId;
  return {
    ...toPublicRoom(room),
    // Só o host enxerga a senha — convidados acham o código mas não
    // precisam ver a senha pra entrar (eles digitaram pra conseguir entrar).
    password: isHost ? room.password : null,
  };
};

// === API pública ===

export type CreateInput = {
  hostSocketId: string;
  hostName: string;
  color: ColorChoice;
  isPrivate: boolean;
};

export const createRoom = (input: CreateInput): ServerRoom => {
  if (socketToRoom.has(input.hostSocketId)) {
    throw new LobbyError("already-in-room");
  }
  const code = generateCode();
  // hostColor aqui é a ESCOLHA do host ("random" ainda é possível).
  // A cor REAL só vai ser fixada quando a sala fechar (2º jogador entrar) —
  // assim host e convidado ficam definidos juntos sem inconsistência.
  const room: ServerRoom = {
    code,
    status: "waiting",
    isPrivate: input.isPrivate,
    password: input.isPrivate ? generatePassword() : null,
    hostColor: input.color,
    hostName: input.hostName,
    players: [
      {
        socketId: input.hostSocketId,
        name: input.hostName,
        // Cor temporária — vai ser sobrescrita em `startGame` se for "random".
        color: input.color === "random" ? "cyan" : input.color,
        enginePlayer: 1, // host = engine player 1 (sai de baixo). Determinístico.
      },
    ],
    gameState: null,
  };
  rooms.set(code, room);
  socketToRoom.set(input.hostSocketId, code);
  return room;
};

export type JoinInput = {
  socketId: string;
  playerName: string;
  code: string;
  password?: string;
};

export const joinRoom = (input: JoinInput): ServerRoom => {
  if (socketToRoom.has(input.socketId)) {
    throw new LobbyError("already-in-room");
  }
  const code = input.code.toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) throw new LobbyError("room-not-found");
  if (room.players.length >= 2) throw new LobbyError("room-full");
  if (room.isPrivate && room.password !== input.password) {
    throw new LobbyError("wrong-password");
  }

  // Resolve cores no momento que a sala fecha — é a única hora que sabemos
  // os 2 jogadores envolvidos e podemos garantir consistência.
  const hostColor = resolveColor(room.hostColor);
  room.players[0].color = hostColor;

  room.players.push({
    socketId: input.socketId,
    name: input.playerName,
    color: oppositeColor(hostColor),
    enginePlayer: 2,
  });
  room.status = "playing";
  room.gameState = initialState();

  socketToRoom.set(input.socketId, code);
  return room;
};

export const leaveRoom = (socketId: string): ServerRoom | null => {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  socketToRoom.delete(socketId);
  if (!room) return null;
  room.players = room.players.filter((p) => p.socketId !== socketId);
  // Se ficou vazia, deleta. Se ainda tem alguém, marca como finished —
  // o outro jogador será notificado pelo handler.
  if (room.players.length === 0) {
    rooms.delete(code);
    return null;
  }
  room.status = "finished";
  return room;
};

export const getRoomBySocket = (socketId: string): ServerRoom | null => {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  return rooms.get(code) ?? null;
};

// Lista só salas em "waiting" (a entrar). Salas em "playing" / "finished"
// não interessam pro lobby.
export const listPublicRooms = (): PublicRoom[] => {
  const out: PublicRoom[] = [];
  for (const room of rooms.values()) {
    if (room.status !== "waiting") continue;
    out.push(toPublicRoom(room));
  }
  return out;
};

// === Erro tipado ===

import type { RpcError } from "@barreira/shared";

export class LobbyError extends Error {
  constructor(public readonly code: RpcError, message?: string) {
    super(message ?? code);
  }
}
