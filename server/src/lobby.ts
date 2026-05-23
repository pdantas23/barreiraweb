// === Lobby em memória ===
//
// Responsabilidades:
// - guardar salas ativas (Map roomCode → ServerRoom)
// - cuidar de criar / listar / entrar / sair
// - resolver cores e enginePlayer no momento que a sala fica cheia
// - inicializar o GameState pra a partida começar
//
// Identidade (clientId, opcional):
// - Quando o socket envia `auth.clientId` no handshake, entra em modo
//   "reconectável": disconnect agenda timer de N ms; se outro socket
//   reconectar com o mesmo clientId antes do timer, a sala é reanexada
//   e o jogo continua. Se o timer estourar, a sala é encerrada e o
//   oponente vence por W.O. (via callback `onPlayerTimeout`).
// - Sem clientId, modo "volátil" (legacy): disconnect = leaveRoom imediato.

import {
  initialState,
  randomFirstTurn,
  type Color,
  type ColorChoice,
  type GameState,
  type PlayerId,
  type PublicRoom,
  type RoomDetail,
  type RpcError,
} from "@barreira/shared";

// === Tipos internos ===

export type RoomStatus = "waiting" | "playing" | "finished";

export type ServerPlayer = {
  // null = socket "volátil" (não reconectável). Atribuído quando o cliente
  // passa `auth.clientId` no handshake.
  clientId: string | null;
  socketId: string;
  name: string;
  color: Color;
  enginePlayer: PlayerId;
  // Timestamp quando o socket caiu. null = conectado.
  disconnectedAt: number | null;
  // true = ator interno do server fingindo ser jogador. Não tem socket real,
  // não recebe emits, é "jogado" pelo botManager via callbacks.
  isBot: boolean;
};

export type RematchState = {
  requestedBy: string; // clientId of requester
  requestedAt: number;
  expiresAt: number;
  timer: NodeJS.Timeout;
};

export type ServerRoom = {
  code: string;
  status: RoomStatus;
  isPrivate: boolean;
  password: string | null;
  hostColor: ColorChoice;
  hostName: string;
  players: ServerPlayer[];
  gameState: GameState | null;
  rematch: RematchState | null;
  // Timer agendado pelo botManager pra injetar um bot guest se ninguém
  // entrar em 10-15s. null = sem rescue pendente (sala de bot, sala
  // privada, ou sala que já fechou).
  botRescueTimer: NodeJS.Timeout | null;
  // Timestamp (ms) de quando o countdown termina e moves são aceitos.
  // null = sem countdown ativo (moves liberados).
  countdownEndsAt: number | null;
};

// === Estado global ===

const rooms = new Map<string, ServerRoom>();
const socketToRoom = new Map<string, string>();
const clientToRoom = new Map<string, string>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();

// Configurável via env pra acelerar testes (default 30s).
const DISCONNECT_TIMEOUT_MS = Number(process.env.DISCONNECT_TIMEOUT_MS ?? 30_000);

// === Callback de timeout (registrado pelo index.ts) ===

export type TimeoutCallback = (
  clientId: string,
  room: ServerRoom,
  remaining: ServerPlayer[],
) => void;

let onTimeoutCb: TimeoutCallback | null = null;
export const setOnPlayerTimeout = (cb: TimeoutCallback) => {
  onTimeoutCb = cb;
};

// === Helpers ===

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateCode = (): string => {
  for (let attempt = 0; attempt < 10; attempt++) {
    let out = "";
    for (let i = 0; i < 6; i++) {
      out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!rooms.has(out)) return out;
  }
  throw new Error("lobby cheio demais — códigos esgotados");
};

const generatePassword = (): string => {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
};

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
    password: isHost ? room.password : null,
  };
};

// === Pré-flight: garante que o cliente está livre antes de criar/entrar ===
//
// Cenários que isso resolve:
// 1. Cliente sai da sala mas o leaveRoom não foi ack-ado (race do back button)
// 2. App fechou abruptamente e o disconnect timer ainda não estourou
// 3. Cliente clica voltar pro lobby após partida terminada e logo cria outra
//
// Regra: se a sala antiga estava em "playing" (partida ativa), recusa —
// o user precisa sair explicitamente primeiro. Se estava em "waiting" ou
// "finished", limpa silenciosamente.
const ensureClientFree = (clientId: string | null, socketId: string): void => {
  if (clientId) {
    const oldCode = clientToRoom.get(clientId);
    if (oldCode) {
      const oldRoom = rooms.get(oldCode);
      if (oldRoom && oldRoom.status === "playing") {
        throw new LobbyError("already-in-room");
      }
      if (oldRoom) {
        const oldPlayer = oldRoom.players.find((p) => p.clientId === clientId);
        if (oldPlayer) {
          leaveRoom(oldPlayer.socketId);
        }
      }
      clientToRoom.delete(clientId);
    }
  }
  if (socketToRoom.has(socketId)) {
    const oldCode = socketToRoom.get(socketId);
    const oldRoom = oldCode ? rooms.get(oldCode) : null;
    if (oldRoom && oldRoom.status === "playing") {
      throw new LobbyError("already-in-room");
    }
    leaveRoom(socketId);
  }
};

// === API: criar / entrar / listar / sair ===

export type CreateInput = {
  hostSocketId: string;
  hostClientId: string | null;
  hostName: string;
  color: ColorChoice;
  isPrivate: boolean;
};

export const createRoom = (input: CreateInput): ServerRoom => {
  // Defesa em profundidade: se o cliente ainda aparece em uma sala antiga
  // (race do leaveRoom anterior, app fechou sem ack, etc), tenta liberar.
  // Só nega se a sala anterior estiver em "playing" — aí o user de fato
  // está numa partida ativa e precisa sair dela primeiro.
  ensureClientFree(input.hostClientId, input.hostSocketId);

  const code = generateCode();
  const room: ServerRoom = {
    code,
    status: "waiting",
    isPrivate: input.isPrivate,
    password: input.isPrivate ? generatePassword() : null,
    hostColor: input.color,
    hostName: input.hostName,
    players: [
      {
        clientId: input.hostClientId,
        socketId: input.hostSocketId,
        name: input.hostName,
        color: input.color === "random" ? "cyan" : input.color,
        enginePlayer: 1,
        disconnectedAt: null,
        isBot: false,
      },
    ],
    gameState: null,
    rematch: null,
    botRescueTimer: null,
    countdownEndsAt: null,
  };
  rooms.set(code, room);
  socketToRoom.set(input.hostSocketId, code);
  if (input.hostClientId) clientToRoom.set(input.hostClientId, code);
  return room;
};

export type JoinInput = {
  socketId: string;
  clientId: string | null;
  playerName: string;
  code: string;
  password?: string;
};

export const joinRoom = (input: JoinInput): ServerRoom => {
  // Mesma defesa do createRoom — limpa sala antiga se houver fantasma.
  ensureClientFree(input.clientId, input.socketId);

  const code = input.code.toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) throw new LobbyError("room-not-found");
  if (room.players.length >= 2) throw new LobbyError("room-full");
  if (room.isPrivate && room.password !== input.password) {
    throw new LobbyError("wrong-password");
  }

  // Resolve cores agora que sabemos os 2 jogadores.
  const hostColor = resolveColor(room.hostColor);
  room.players[0].color = hostColor;

  room.players.push({
    clientId: input.clientId,
    socketId: input.socketId,
    name: input.playerName,
    color: oppositeColor(hostColor),
    enginePlayer: 2,
    disconnectedAt: null,
    isBot: false,
  });
  room.status = "playing";
  room.gameState = initialState(randomFirstTurn());

  // Humano entrou — cancela bot rescue se estava pendente.
  cancelBotRescue(room);

  socketToRoom.set(input.socketId, code);
  if (input.clientId) clientToRoom.set(input.clientId, code);
  return room;
};

// Saída "voluntária": user clicou em voltar, ou socket sem clientId caiu.
// Remove imediatamente, sem timer de graça.
export const leaveRoom = (socketId: string): ServerRoom | null => {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  socketToRoom.delete(socketId);
  if (!room) return null;
  // Se host saiu antes de qualquer guest entrar, cancela rescue.
  cancelBotRescue(room);

  const player = room.players.find((p) => p.socketId === socketId);
  if (player) {
    if (player.clientId) {
      // Cancela qualquer timer pendente — vamos remover agora mesmo.
      const t = disconnectTimers.get(player.clientId);
      if (t) clearTimeout(t);
      disconnectTimers.delete(player.clientId);
      clientToRoom.delete(player.clientId);
    }
    room.players = room.players.filter((p) => p.socketId !== socketId);
  }

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

export const listPublicRooms = (): PublicRoom[] => {
  const out: PublicRoom[] = [];
  for (const room of rooms.values()) {
    if (room.status !== "waiting") continue;
    out.push(toPublicRoom(room));
  }
  return out;
};

// === Reconexão ===

// Chamado no socket.disconnect quando o socket tinha clientId.
// Marca o player como desconectado e agenda timeout — o oponente NÃO
// é notificado ainda. Se ele voltar dentro do prazo, ninguém perde nada.
export const markDisconnected = (socketId: string): void => {
  const room = getRoomBySocket(socketId);
  if (!room) return;
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player || !player.clientId) return;

  player.disconnectedAt = Date.now();
  // socketToRoom mantém apontando — mesmo "stale", deixa pra próxima
  // reanexa atualizar. Limpar agora poderia atrapalhar o reanchor.

  const existing = disconnectTimers.get(player.clientId);
  if (existing) clearTimeout(existing);

  const clientId = player.clientId;
  const timer = setTimeout(() => {
    disconnectTimers.delete(clientId);
    finalizeTimeout(clientId);
  }, DISCONNECT_TIMEOUT_MS);
  disconnectTimers.set(clientId, timer);
};

// Player não voltou no tempo. Remove da sala + notifica callback (que vai
// emitir gameOver/opponentLeft).
const finalizeTimeout = (clientId: string): void => {
  const code = clientToRoom.get(clientId);
  if (!code) return;
  const room = rooms.get(code);
  if (!room) {
    clientToRoom.delete(clientId);
    return;
  }
  const player = room.players.find((p) => p.clientId === clientId);
  if (!player) return;

  // Remove dele da sala.
  socketToRoom.delete(player.socketId);
  clientToRoom.delete(clientId);
  const remaining = room.players.filter((p) => p.clientId !== clientId);
  room.players = remaining;

  // Se ninguém sobrou, descarta a sala. Caso contrário marca como finished.
  if (remaining.length === 0) {
    rooms.delete(code);
  } else {
    room.status = "finished";
  }

  if (onTimeoutCb) onTimeoutCb(clientId, room, remaining);
};

// Tenta reanexar um socket novo a uma sala existente via clientId.
// Devolve o par {room, player} já atualizado, ou null se não existe sala.
export const attemptReanchor = (
  clientId: string,
  newSocketId: string,
): { room: ServerRoom; player: ServerPlayer } | null => {
  const code = clientToRoom.get(clientId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) {
    clientToRoom.delete(clientId);
    return null;
  }
  const player = room.players.find((p) => p.clientId === clientId);
  if (!player) return null;

  // Cancela timer (se houver) — player voltou a tempo.
  const t = disconnectTimers.get(clientId);
  if (t) clearTimeout(t);
  disconnectTimers.delete(clientId);

  // Atualiza mapping pro novo socketId.
  socketToRoom.delete(player.socketId);
  player.socketId = newSocketId;
  player.disconnectedAt = null;
  socketToRoom.set(newSocketId, code);

  return { room, player };
};

// === Rematch ===

const REMATCH_TIMEOUT_MS = 15_000;
const REMATCH_MUTUAL_WINDOW_MS = 2_000;

export type RematchCallback = (room: ServerRoom) => void;
let onRematchExpiredCb: RematchCallback | null = null;
let onRematchAcceptedCb: RematchCallback | null = null;

export const setOnRematchExpired = (cb: RematchCallback) => {
  onRematchExpiredCb = cb;
};
export const setOnRematchAccepted = (cb: RematchCallback) => {
  onRematchAcceptedCb = cb;
};

export const clearRematch = (room: ServerRoom) => {
  if (room.rematch) {
    clearTimeout(room.rematch.timer);
    room.rematch = null;
  }
};

export const requestRematch = (socketId: string): {
  kind: "pending" | "mutual";
  room: ServerRoom;
  requester: ServerPlayer;
} => {
  const room = getRoomBySocket(socketId);
  if (!room) throw new LobbyError("not-in-room");
  if (room.status !== "finished") throw new LobbyError("game-not-over");
  if (room.players.length < 2) throw new LobbyError("not-in-room", "oponente saiu");

  const me = room.players.find((p) => p.socketId === socketId);
  if (!me || !me.clientId) throw new LobbyError("internal-error");

  // Se já existe um pedido pendente do OUTRO jogador → mutual
  if (room.rematch && room.rematch.requestedBy !== me.clientId) {
    const elapsed = Date.now() - room.rematch.requestedAt;
    if (elapsed <= REMATCH_MUTUAL_WINDOW_MS) {
      clearRematch(room);
      startRematch(room);
      return { kind: "mutual", room, requester: me };
    }
  }

  if (room.rematch && room.rematch.requestedBy === me.clientId) {
    throw new LobbyError("rematch-already-pending");
  }

  const now = Date.now();
  const expiresAt = now + REMATCH_TIMEOUT_MS;
  const timer = setTimeout(() => {
    room.rematch = null;
    if (onRematchExpiredCb) onRematchExpiredCb(room);
  }, REMATCH_TIMEOUT_MS);

  room.rematch = { requestedBy: me.clientId, requestedAt: now, expiresAt, timer };
  return { kind: "pending", room, requester: me };
};

export const respondRematch = (socketId: string, accept: boolean): ServerRoom => {
  const room = getRoomBySocket(socketId);
  if (!room) throw new LobbyError("not-in-room");
  if (!room.rematch) throw new LobbyError("no-rematch-pending");

  const me = room.players.find((p) => p.socketId === socketId);
  if (!me || !me.clientId) throw new LobbyError("internal-error");

  // Quem pediu não pode responder ao próprio pedido
  if (room.rematch.requestedBy === me.clientId) {
    throw new LobbyError("internal-error", "não pode responder ao próprio pedido");
  }

  clearRematch(room);

  if (accept) {
    startRematch(room);
    if (onRematchAcceptedCb) onRematchAcceptedCb(room);
  }

  return room;
};

const startRematch = (room: ServerRoom) => {
  room.gameState = initialState(randomFirstTurn());
  room.status = "playing";
  room.rematch = null;
};

export const getRematchTimeoutMs = () => REMATCH_TIMEOUT_MS;

// === Erro tipado ===

export class LobbyError extends Error {
  constructor(public readonly code: RpcError, message?: string) {
    super(message ?? code);
  }
}

// Pra testes saberem o timeout configurado.
export const getDisconnectTimeoutMs = () => DISCONNECT_TIMEOUT_MS;

// === Acesso ao map global (usado pelo botManager pra scan) ===
export const getAllRooms = (): Map<string, ServerRoom> => rooms;

// === Bot host room ===
//
// Cria uma sala com um bot como host. O bot tem socketId fake (não usado
// nem pelo socket.io nem pelo socketToRoom global) e clientId null
// (nada de reanchor). Identidade só pra UI.
export type BotHostInput = {
  hostName: string; // ex: "anonimo7508"
  color: ColorChoice;
};

export const createBotHostRoom = (input: BotHostInput): ServerRoom => {
  const code = generateCode();
  const botSocketId = `bot-internal-${code}`; // único, não conflita com socket.io
  const room: ServerRoom = {
    code,
    status: "waiting",
    isPrivate: false, // bots sempre públicos
    password: null,
    hostColor: input.color,
    hostName: input.hostName,
    players: [
      {
        clientId: null, // bot não tem identidade persistente
        socketId: botSocketId,
        name: input.hostName,
        color: input.color === "random" ? "cyan" : input.color,
        enginePlayer: 1,
        disconnectedAt: null,
        isBot: true,
      },
    ],
    gameState: null,
    rematch: null,
    botRescueTimer: null,
    countdownEndsAt: null,
  };
  rooms.set(code, room);
  // NÃO seta socketToRoom — o socketId é fake, não tem socket.io listener.
  return room;
};

// Remove um bot da sala (usado pelo botManager pós-partida).
// Diferente de leaveRoom porque não precisa olhar socketToRoom.
export const removeBotFromRoom = (code: string): void => {
  const room = rooms.get(code);
  if (!room) return;
  // Se ainda tinha timer de rescue pendente, cancela.
  cancelBotRescue(room);
  room.players = room.players.filter((p) => !p.isBot);
  if (room.players.length === 0) {
    clearRematch(room);
    rooms.delete(code);
  } else {
    room.status = "finished";
  }
};

// === Bot Rescue ===
//
// Quando um humano cria sala, o botManager pode agendar um timer.
// Se o timer dispara antes de outro humano entrar, addBotGuest é chamado
// pra adicionar um bot como segundo jogador (a partida começa).
// Se outro humano entra antes, o timer é cancelado.

export const cancelBotRescue = (room: ServerRoom): void => {
  if (room.botRescueTimer) {
    clearTimeout(room.botRescueTimer);
    room.botRescueTimer = null;
  }
};

export type AddBotGuestInput = {
  code: string;
  botName: string;
};

// Adiciona um bot como segundo jogador na sala. Espelha o que joinRoom
// faz pra um humano, mas sem mexer em socketToRoom (bot não tem socket).
// Retorna a sala atualizada (com gameState inicializado) ou null se a
// sala não existe / já não está em waiting.
export const addBotGuest = (input: AddBotGuestInput): ServerRoom | null => {
  const room = rooms.get(input.code);
  if (!room) return null;
  if (room.status !== "waiting") return null;
  if (room.players.length >= 2) return null;

  // Resolve cores (igual ao joinRoom)
  const hostColor = resolveColor(room.hostColor);
  room.players[0].color = hostColor;

  const botSocketId = `bot-internal-${input.code}-guest`;
  room.players.push({
    clientId: null,
    socketId: botSocketId,
    name: input.botName,
    color: oppositeColor(hostColor),
    enginePlayer: 2,
    disconnectedAt: null,
    isBot: true,
  });
  room.status = "playing";
  room.gameState = initialState(randomFirstTurn());

  // Timer já não importa — cancela por garantia.
  cancelBotRescue(room);

  return room;
};
