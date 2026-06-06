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

// Plataforma de origem do cliente (analytics). null = desconhecida (cliente
// antigo que ainda não envia, ou bot).
export type Platform = "web" | "ios" | "android";

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
  // ID do user no Supabase Auth (auth.users.id), null se anonimo.
  // Usado pra premiar trofeus_casual no fim da partida.
  authUserId: string | null;
  // Plataforma de origem (web/ios/android), null se desconhecida ou bot.
  // Propaga pro matches.pN_platform no recordMatchStart.
  platform: Platform | null;
};

export type RematchState = {
  requestedBy: string; // clientId of requester
  requestedAt: number;
  expiresAt: number;
  timer: NodeJS.Timeout;
};

// Origem da partida pra analytics — distinta de isPrivate (visibilidade no
// lobby). Matchmaking nasce isPrivate=true (não aparece no lobby) mas é jogo
// casual; por isso o source é separado. Ver recordMatchStart.
export type MatchSource = "lobby" | "matchmaking" | "invite" | "private" | "rescue";

export type ServerRoom = {
  code: string;
  status: RoomStatus;
  isPrivate: boolean;
  // Origem analítica da sala (não confundir com isPrivate). Setado na criação.
  source: MatchSource;
  // Lances aplicados nesta partida (analytics — total_moves). Reset no
  // recordMatchStart, incrementado a cada move aceito (humano e bot).
  moveCount: number;
  password: string | null;
  hostColor: ColorChoice;
  hostName: string;
  players: ServerPlayer[];
  gameState: GameState | null;
  rematch: RematchState | null;
  // Vira true quando uma revanche é recusada nesta sala finalizada. Trava
  // qualquer novo pedido até começar uma partida nova. Sem isso, depois de
  // recusar dava pra pedir de novo — e o bot aceitaria na hora, entregando
  // que ele estava só esperando.
  rematchDeclined: boolean;
  // Timer agendado pelo botManager pra injetar um bot guest se ninguém
  // entrar em 10-15s. null = sem rescue pendente (sala de bot, sala
  // privada, ou sala que já fechou).
  botRescueTimer: NodeJS.Timeout | null;
  // Timestamp (ms) de quando o countdown termina e moves são aceitos.
  // null = sem countdown ativo (moves liberados).
  countdownEndsAt: number | null;
  // Relógio autoritativo da partida (estilo xadrez, por jogador). Acumula
  // só o tempo gasto nos turnos de cada jogador. Usado pra validar o
  // reportTimeout do cliente — o server só encerra por tempo se o próprio
  // relógio confirmar o estouro.
  timeUsedMs: { 1: number; 2: number };
  // Quando o turno atual começou a contar (ms). null = relógio parado.
  turnStartedAt: number | null;
  // ID da linha em `matches` (analytics). Setado em recordMatchStart quando a
  // partida começa; limpo em recordMatchFinish no fim. null = sem partida
  // registrada (sala em waiting, ou já finalizada).
  matchId: string | null;
  // Timestamp (ms) de criação da sala. Usado pra expirar salas de bot ociosas
  // no lobby (botManager varre e remove as waiting de bot mais velhas que o TTL).
  createdAt: number;
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

// === Callback de mudança no lobby (registrado pelo index.ts) ===
//
// Disparado sempre que o conjunto de salas em "waiting" muda (criar/entrar/
// sair/finalizar). index.ts usa pra emitir `lobbyUpdated` pros clientes,
// que refazem listRooms — assim o lobby fica vivo sem polling.

export type LobbyChangedCallback = () => void;
let onLobbyChangedCb: LobbyChangedCallback | null = null;
export const setOnLobbyChanged = (cb: LobbyChangedCallback) => {
  onLobbyChangedCb = cb;
};
const notifyLobbyChanged = (): void => {
  if (onLobbyChangedCb) onLobbyChangedCb();
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
  hostAuthUserId: string | null;
  hostName: string;
  color: ColorChoice;
  isPrivate: boolean;
  hostPlatform?: Platform | null;
  // Origem analítica. Default: private se isPrivate, senão lobby. Matchmaking e
  // convite passam explícito.
  source?: MatchSource;
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
    source: input.source ?? (input.isPrivate ? "private" : "lobby"),
    moveCount: 0,
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
        authUserId: input.hostAuthUserId,
        platform: input.hostPlatform ?? null,
      },
    ],
    gameState: null,
    rematch: null,
    rematchDeclined: false,
    botRescueTimer: null,
    countdownEndsAt: null,
    timeUsedMs: { 1: 0, 2: 0 },
    turnStartedAt: null,
    matchId: null,
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  socketToRoom.set(input.hostSocketId, code);
  if (input.hostClientId) clientToRoom.set(input.hostClientId, code);
  notifyLobbyChanged();
  return room;
};

export type JoinInput = {
  socketId: string;
  clientId: string | null;
  authUserId: string | null;
  playerName: string;
  code: string;
  password?: string;
  platform?: Platform | null;
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
  // Bloqueia mesma conta enfrentando a si própria — mesmo authUserId logado
  // em duas sessões/abas/dispositivos não pode pegar ambos os lados da sala.
  // Anônimos (authUserId=null) ficam liberados; bots têm authUserId=null por design.
  const hostAuth = room.players[0].authUserId;
  const guestAuth = input.authUserId;
  console.log(
    `[self-match-check] sala=${code} host=${hostAuth ?? "null"} guest=${guestAuth ?? "null"} match=${
      hostAuth && guestAuth && hostAuth === guestAuth ? "BLOCK" : "allow"
    }`,
  );
  if (hostAuth && guestAuth && hostAuth === guestAuth) {
    throw new LobbyError("self-match");
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
    authUserId: input.authUserId,
    platform: input.platform ?? null,
  });
  room.status = "playing";
  room.gameState = initialState(randomFirstTurn());

  // Humano entrou — cancela bot rescue se estava pendente.
  cancelBotRescue(room);

  socketToRoom.set(input.socketId, code);
  if (input.clientId) clientToRoom.set(input.clientId, code);
  // Sala saiu de "waiting" → some da lista pública.
  notifyLobbyChanged();
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

  const wasWaiting = room.status === "waiting";
  if (room.players.length === 0) {
    rooms.delete(code);
    if (wasWaiting) notifyLobbyChanged();
    return null;
  }
  room.status = "finished";
  if (wasWaiting) notifyLobbyChanged();
  return room;
};

export const getRoomBySocket = (socketId: string): ServerRoom | null => {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  return rooms.get(code) ?? null;
};

export const listPublicRooms = (excludeAuthUserId: string | null = null): PublicRoom[] => {
  const out: PublicRoom[] = [];
  for (const room of rooms.values()) {
    if (room.status !== "waiting") continue;
    // Esconde salas do próprio usuário logado pra evitar self-match.
    if (
      excludeAuthUserId &&
      room.players[0]?.authUserId === excludeAuthUserId
    ) {
      continue;
    }
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
  const wasWaiting = room.status === "waiting";
  if (remaining.length === 0) {
    rooms.delete(code);
  } else {
    room.status = "finished";
  }
  if (wasWaiting) notifyLobbyChanged();

  if (onTimeoutCb) onTimeoutCb(clientId, room, remaining);
};

// Tenta reanexar um socket novo a uma sala existente via clientId.
// Devolve o par {room, player} já atualizado, ou null se não existe sala.
//
// `authUserId` é o user resolvido do JWT do socket NOVO. Se o player tinha
// entrado anônimo (authUserId=null por causa da race de cold start, em que
// o handshake saiu sem token) e agora o token resolveu, atualizamos aqui —
// sem isso o jogador ficaria permanentemente sem identidade e nunca ganharia
// troféu, mesmo logado.
export const attemptReanchor = (
  clientId: string,
  newSocketId: string,
  authUserId: string | null = null,
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

  // Segurança: se o player está logado, só o MESMO authUserId (vindo de um
  // JWT válido no socket novo) pode reanexar. Sem isso, quem descobrisse o
  // clientId (que não é segredo) sequestraria a sessão de um jogador logado.
  // Anônimos (authUserId null) seguem só com clientId (comportamento atual).
  // Checado ANTES de qualquer mutação de estado.
  if (player.authUserId && authUserId !== player.authUserId) {
    console.warn(
      `[reanchor] REJEITADO pra ${clientId.slice(0, 8)}…: player é logado e o socket apresentou authUserId diferente`,
    );
    return null;
  }

  // Cancela timer (se houver) — player voltou a tempo.
  const t = disconnectTimers.get(clientId);
  if (t) clearTimeout(t);
  disconnectTimers.delete(clientId);

  // Atualiza mapping pro novo socketId.
  socketToRoom.delete(player.socketId);
  player.socketId = newSocketId;
  player.disconnectedAt = null;
  socketToRoom.set(newSocketId, code);

  // Recupera identidade autenticada se o player tinha entrado anônimo.
  if (authUserId && !player.authUserId) {
    player.authUserId = authUserId;
    console.log(
      `[reanchor] authUserId recuperado pra ${clientId.slice(0, 8)}… = ${authUserId.slice(0, 8)}…`,
    );
  }

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
  // Já houve recusa nesta partida → revanche encerrada. Não dá pra pedir de
  // novo (senão o bot aceitaria na hora e entregaria que estava esperando).
  if (room.rematchDeclined) throw new LobbyError("rematch-unavailable");

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
  } else {
    // Recusou → trava qualquer novo pedido nesta sala finalizada.
    room.rematchDeclined = true;
  }

  return room;
};

const startRematch = (room: ServerRoom) => {
  room.gameState = initialState(randomFirstTurn());
  room.status = "playing";
  room.rematch = null;
  room.rematchDeclined = false; // partida nova → revanche volta a ser possível
};

// === Rematch — variantes pra bot ===
//
// `requestRematch`/`respondRematch` validam via socketId + clientId, mas
// bots têm clientId=null E socketId fake (não estão em socketToRoom).
// Estas variantes recebem `room` direto e pulam essas guardas. Caller
// (index.ts) é responsável por emitir os eventos pros sockets reais.

/** Bot aceita o rematch que um humano pediu. Caller deve broadcastGameStart. */
export const acceptRematchAsBot = (room: ServerRoom): void => {
  if (!room.rematch) throw new LobbyError("no-rematch-pending");
  clearRematch(room);
  startRematch(room);
  if (onRematchAcceptedCb) onRematchAcceptedCb(room);
};

/**
 * Bot inicia um pedido de revanche. Seta `room.rematch.requestedBy` com
 * um id sintético (`bot:<code>`) que nunca colide com clientId real, pra
 * o `respondRematch` do humano (que checa `!== me.clientId`) funcionar
 * normalmente. Caller deve emitir `rematchRequested` pro socket do humano.
 */
export const requestRematchAsBot = (
  room: ServerRoom,
  botName: string,
): { expiresAt: number; fromName: string } | null => {
  if (room.status !== "finished") return null;
  if (room.players.length < 2) return null;
  if (room.rematch) return null; // alguém já pediu — não duplica
  if (room.rematchDeclined) return null; // já recusaram nesta partida

  const now = Date.now();
  const expiresAt = now + REMATCH_TIMEOUT_MS;
  const timer = setTimeout(() => {
    room.rematch = null;
    if (onRematchExpiredCb) onRematchExpiredCb(room);
  }, REMATCH_TIMEOUT_MS);

  room.rematch = {
    requestedBy: `bot:${room.code}`,
    requestedAt: now,
    expiresAt,
    timer,
  };
  return { expiresAt, fromName: botName };
};

export const getRematchTimeoutMs = () => REMATCH_TIMEOUT_MS;

// === Relógio de partida (autoritativo) ===
//
// Cada jogador tem seu próprio relógio que só corre nos seus turnos (igual
// xadrez). `timeUsedMs[p]` acumula o tempo já gasto por p; `turnStartedAt`
// marca quando o turno atual começou. O relógio só começa a contar quando
// o countdown termina.

// (Re)inicia o relógio no começo de uma partida (inclui revanche).
export const initGameClock = (room: ServerRoom): void => {
  room.timeUsedMs = { 1: 0, 2: 0 };
  // Relógio só corre depois do countdown — se ainda não terminou, conta a
  // partir do fim dele; senão, de agora.
  room.turnStartedAt = room.countdownEndsAt ?? Date.now();
};

// Debita do jogador que acabou de jogar o tempo gasto no turno e reinicia o
// cronômetro pro próximo. Chamar logo após cada move aceito (humano ou bot).
export const chargeTurnTime = (
  room: ServerRoom,
  mover: PlayerId,
  now: number,
): void => {
  if (room.turnStartedAt !== null) {
    room.timeUsedMs[mover] += Math.max(0, now - room.turnStartedAt);
  }
  room.turnStartedAt = now;
};

// Quanto tempo o jogador já consumiu, incluindo o turno em andamento se for
// a vez dele. Usado pra validar o reportTimeout.
export const turnTimeUsedMs = (
  room: ServerRoom,
  player: PlayerId,
  now: number,
): number => {
  const runningThisTurn =
    room.turnStartedAt !== null && room.gameState?.turn === player
      ? Math.max(0, now - room.turnStartedAt)
      : 0;
  return room.timeUsedMs[player] + runningThisTurn;
};

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
    source: "lobby", // sala-isca pública; partida vira casual_online
    moveCount: 0,
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
        authUserId: null,
        platform: null,
      },
    ],
    gameState: null,
    rematch: null,
    rematchDeclined: false,
    botRescueTimer: null,
    countdownEndsAt: null,
    timeUsedMs: { 1: 0, 2: 0 },
    turnStartedAt: null,
    matchId: null,
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  // NÃO seta socketToRoom — o socketId é fake, não tem socket.io listener.
  notifyLobbyChanged();
  return room;
};

// Remove um bot da sala (usado pelo botManager pós-partida).
// Diferente de leaveRoom porque não precisa olhar socketToRoom.
export const removeBotFromRoom = (code: string): void => {
  const room = rooms.get(code);
  if (!room) return;
  // Se ainda tinha timer de rescue pendente, cancela.
  cancelBotRescue(room);
  const wasWaiting = room.status === "waiting";
  room.players = room.players.filter((p) => !p.isBot);
  if (room.players.length === 0) {
    clearRematch(room);
    rooms.delete(code);
  } else {
    room.status = "finished";
  }
  if (wasWaiting) notifyLobbyChanged();
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
    authUserId: null,
    platform: null,
  });
  room.status = "playing";
  room.gameState = initialState(randomFirstTurn());

  // Timer já não importa — cancela por garantia.
  cancelBotRescue(room);

  // Sala saiu de "waiting" — desaparece do lobby público.
  notifyLobbyChanged();
  return room;
};
