// === Bot Manager ===
//
// Mantém sempre N salas em "waiting" disponíveis no lobby. Quando um humano
// entra numa sala de bot, o bot joga a partida como se fosse um humano
// (delay variável, decisões de jogo via `smartOpponentMove`).
//
// Pré-requisitos:
// - `getAllRooms()` exportado do lobby
// - `createBotHostRoom()` e `removeBotFromRoom()` no lobby
// - `isBot: boolean` no ServerPlayer
//
// Fluxo:
// 1. Scan periódico conta salas em waiting; se < MIN_WAITING_ROOMS, agenda
//    spawn com delay aleatório
// 2. Quando humano entra → joinRoom normal funciona → broadcastGameStart
//    pros sockets reais → botManager nota que é vez do bot, agenda move
// 3. Bot escolhe move via smartOpponentMove + applyMove + broadcast
// 4. Repete enquanto for vez do bot
// 5. Partida acaba → bot manager schedule "bot leave" em alguns segundos
//    → próximo scan repõe a sala

import type { Server } from "socket.io";
import {
  applyMove,
  serializeState,
  smartOpponentMove,
  type ClientToServerEvents,
  type GameOverPayload,
  type ServerToClientEvents,
} from "@barreira/shared";
import {
  addBotGuest,
  cancelBotRescue,
  createBotHostRoom,
  getAllRooms,
  removeBotFromRoom,
  type ServerPlayer,
  type ServerRoom,
} from "./lobby.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

// === Config ===
// Tunable via env pra testes — defaults realistas pra UX casual.
const MIN_WAITING_ROOMS = Number(process.env.BOT_MIN_WAITING ?? 2);
const SCAN_INTERVAL_MS = Number(process.env.BOT_SCAN_MS ?? 4_000);
const SPAWN_DELAY_MIN_MS = Number(process.env.BOT_SPAWN_MIN_MS ?? 3_000);
const SPAWN_DELAY_MAX_MS = Number(process.env.BOT_SPAWN_MAX_MS ?? 8_000);
const MOVE_DELAY_MIN_MS = Number(process.env.BOT_MOVE_MIN_MS ?? 800);
const MOVE_DELAY_MAX_MS = Number(process.env.BOT_MOVE_MAX_MS ?? 2_500);
const LEAVE_DELAY_MIN_MS = Number(process.env.BOT_LEAVE_MIN_MS ?? 3_000);
const LEAVE_DELAY_MAX_MS = Number(process.env.BOT_LEAVE_MAX_MS ?? 6_000);
// Bot rescue: se um humano cria sala e ninguém entra em 10-15s, um bot
// entra como guest pra começar a partida. Configurável via env pra testes.
const RESCUE_DELAY_MIN_MS = Number(process.env.BOT_RESCUE_MIN_MS ?? 10_000);
const RESCUE_DELAY_MAX_MS = Number(process.env.BOT_RESCUE_MAX_MS ?? 15_000);

// Cores válidas pro bot escolher na criação da sala.
const BOT_COLORS = ["cyan", "random", "red"] as const;

// === Helpers ===

const randInt = (min: number, max: number): number =>
  Math.floor(min + Math.random() * (max - min + 1));

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);

const generateBotName = (): string => `anonimo${randInt(1000, 9999)}`;

const pickRandomColor = (): "cyan" | "random" | "red" =>
  BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];

// Pra evitar spawns concorrentes na mesma "janela" (race do setInterval +
// múltiplos setTimeouts agendados). Conta spawns em voo.
let pendingSpawns = 0;

// === Public API ===

// Callback que o index.ts registra: dispara broadcastGameStart + maybeScheduleBotMove
// quando o bot rescue injeta um bot guest. Sem isso, o host não vê a partida começar.
export type GameStartBroadcaster = (room: ServerRoom) => void;
let onBotRescueStarted: GameStartBroadcaster | null = null;
export const setOnBotRescueStarted = (cb: GameStartBroadcaster): void => {
  onBotRescueStarted = cb;
};

let started = false;
let io: TypedServer | null = null;

export const startBotManager = (server: TypedServer): void => {
  if (started) return;
  started = true;
  io = server;
  console.log(`[botManager] iniciado — min ${MIN_WAITING_ROOMS} salas, scan a cada ${SCAN_INTERVAL_MS}ms`);
  setInterval(scan, SCAN_INTERVAL_MS);
  // Scan imediato pra não esperar o primeiro tick
  scan();
};

// Agenda um bot pra entrar como guest se ninguém entrar em 10-15s.
// Chamado pelo index.ts logo após createRoom (de um host humano).
// Salas privadas e salas de bot são puladas — não fazem sentido pra rescue.
export const scheduleBotRescue = (room: ServerRoom): void => {
  if (room.isPrivate) return;
  if (room.players.length === 0 || room.players[0].isBot) return;
  // Já agendado? Não duplica.
  if (room.botRescueTimer) return;

  const delay = randomBetween(RESCUE_DELAY_MIN_MS, RESCUE_DELAY_MAX_MS);
  const code = room.code;
  console.log(`[botManager] rescue agendado pra sala ${code} em ${Math.round(delay)}ms`);

  room.botRescueTimer = setTimeout(() => {
    // Re-checa estado: humano pode ter entrado nesses ms.
    const r = getAllRooms().get(code);
    if (!r) return;
    r.botRescueTimer = null;
    if (r.status !== "waiting" || r.players.length >= 2) return;

    const botName = generateBotName();
    const updated = addBotGuest({ code, botName });
    if (!updated) {
      console.warn(`[botManager] rescue falhou pra sala ${code}`);
      return;
    }
    console.log(`[botManager] rescue: ${botName} entrou em ${code}`);
    if (onBotRescueStarted) onBotRescueStarted(updated);
  }, delay);
};

// Cancela manualmente um rescue pendente. Útil pra index.ts cancelar
// em cenários que o lobby não captura sozinho.
export const cancelPendingBotRescue = (room: ServerRoom): void => {
  cancelBotRescue(room);
};

// Chamado pelo index.ts após cada `move` aceito + após broadcastGameStart.
// Se for vez de um bot, agenda a jogada dele.
export const maybeScheduleBotMove = (room: ServerRoom): void => {
  if (!io) return;
  if (room.status !== "playing" || !room.gameState) return;
  if (room.gameState.winner !== null) {
    scheduleBotLeave(room);
    return;
  }
  const currentPlayer = room.players.find(
    (p) => p.enginePlayer === room.gameState!.turn,
  );
  if (!currentPlayer || !currentPlayer.isBot) return;

  const delay = randomBetween(MOVE_DELAY_MIN_MS, MOVE_DELAY_MAX_MS);
  setTimeout(() => playBotMove(room, currentPlayer), delay);
};

// === Internals ===

const scan = (): void => {
  let waitingCount = 0;
  for (const room of getAllRooms().values()) {
    if (room.status === "waiting") waitingCount++;
  }
  const target = MIN_WAITING_ROOMS;
  const gap = target - waitingCount - pendingSpawns;
  if (gap <= 0) return;

  for (let i = 0; i < gap; i++) {
    pendingSpawns++;
    const delay = randomBetween(SPAWN_DELAY_MIN_MS, SPAWN_DELAY_MAX_MS);
    setTimeout(() => {
      pendingSpawns = Math.max(0, pendingSpawns - 1);
      spawnBotHostRoom();
    }, delay);
  }
};

const spawnBotHostRoom = (): void => {
  // Re-checa antes de criar (estado pode ter mudado durante o delay).
  let waitingCount = 0;
  for (const room of getAllRooms().values()) {
    if (room.status === "waiting") waitingCount++;
  }
  if (waitingCount >= MIN_WAITING_ROOMS) return;

  const name = generateBotName();
  const color = pickRandomColor();
  const room = createBotHostRoom({ hostName: name, color });
  console.log(`[botManager] sala bot ${room.code} criada por ${name} (cor ${color})`);
};

const playBotMove = (room: ServerRoom, bot: ServerPlayer): void => {
  if (!io) return;
  // State pode ter mudado durante o delay (humano desconectou, partida acabou, etc).
  if (room.status !== "playing" || !room.gameState) return;
  if (room.gameState.winner !== null) {
    scheduleBotLeave(room);
    return;
  }
  if (room.gameState.turn !== bot.enginePlayer) return; // não é mais a vez

  const move = smartOpponentMove(room.gameState, bot.enginePlayer);
  if (!move) {
    console.warn(`[botManager] sala ${room.code}: bot não gerou move`);
    return;
  }

  const result = applyMove(room.gameState, bot.enginePlayer, move);
  if (!result.ok) {
    console.warn(`[botManager] sala ${room.code}: applyMove rejeitou jogada do bot (${result.error})`);
    return;
  }

  room.gameState = result.state;
  const wireState = serializeState(result.state);
  io.to(room.code).emit("stateUpdate", { state: wireState });

  if (result.state.winner !== null) {
    room.status = "finished";
    const payload: GameOverPayload = { winner: result.state.winner };
    io.to(room.code).emit("gameOver", payload);
    scheduleBotLeave(room);
    return;
  }

  // Se virou vez do bot de novo (cenário raro mas possível com salto), schedule
  // próxima. Senão é vez do humano — espera o move dele chegar via socket.
  if (result.state.turn === bot.enginePlayer) {
    const delay = randomBetween(MOVE_DELAY_MIN_MS, MOVE_DELAY_MAX_MS);
    setTimeout(() => playBotMove(room, bot), delay);
  }
};

// Quando partida termina, agenda saída do bot pra a sala morrer e abrir
// espaço pro próximo spawn. Delay aleatório pra não parecer automatizado.
const scheduledLeaves = new Set<string>();
const scheduleBotLeave = (room: ServerRoom): void => {
  if (scheduledLeaves.has(room.code)) return;
  scheduledLeaves.add(room.code);
  const delay = randomBetween(LEAVE_DELAY_MIN_MS, LEAVE_DELAY_MAX_MS);
  setTimeout(() => {
    scheduledLeaves.delete(room.code);
    removeBotFromRoom(room.code);
    console.log(`[botManager] bot saiu da sala ${room.code}`);
  }, delay);
};
