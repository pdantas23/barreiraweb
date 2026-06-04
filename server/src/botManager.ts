// === Bot Manager ===
//
// Mantém sempre N salas em "waiting" disponíveis no lobby. Quando um humano
// entra numa sala de bot, o bot joga a partida como se fosse um humano
// (delay variável, decisões de jogo via `botMove` conforme a dificuldade
// sorteada pra aquele bot — fácil/médio/difícil).
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
// 3. Bot escolhe move via botMove(dificuldade) + applyMove + broadcast
// 4. Repete enquanto for vez do bot
// 5. Partida acaba → bot manager schedule "bot leave" em alguns segundos
//    → próximo scan repõe a sala

import type { Server } from "socket.io";
import {
  applyMove,
  botMove,
  serializeState,
  type BotDifficulty,
  type ClientToServerEvents,
  type GameOverPayload,
  type ServerToClientEvents,
} from "@barreira/shared";
import {
  addBotGuest,
  cancelBotRescue,
  chargeTurnTime,
  createBotHostRoom,
  getAllRooms,
  getRematchTimeoutMs,
  removeBotFromRoom,
  requestRematchAsBot,
  type ServerPlayer,
  type ServerRoom,
} from "./lobby.js";
import { recordMatchStart, recordMatchFinish } from "./matches.js";

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
// Após game over, com essa chance o bot pede revanche ao humano em 1.5-3.5s.
const BOT_REMATCH_CHANCE = 0.45;
const BOT_REMATCH_DELAY_MIN_MS = 1_500;
const BOT_REMATCH_DELAY_MAX_MS = 3_500;

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

// Dificuldade de cada bot: socketId → BotDifficulty. Atribuída no spawn/rescue
// e consultada a cada jogada (botMove decide via minimax na profundidade do
// nível). No multiplayer online NUNCA usamos "easy" — só médio e difícil,
// 50/50: o online é pra valer, o "easy" fica só pro treino offline.
const botDifficulties = new Map<string, BotDifficulty>();

const randomDifficulty = (): BotDifficulty =>
  Math.random() < 0.5 ? "medium" : "hard";

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
    // Atribui dificuldade ao bot guest do rescue.
    const botPlayer = updated.players.find((p) => p.isBot);
    if (botPlayer) botDifficulties.set(botPlayer.socketId, randomDifficulty());
    // Analytics: partida começou (bot entrou como guest → playing).
    recordMatchStart(updated);
    console.log(`[botManager] rescue: ${botName} entrou em ${code}`);
    if (onBotRescueStarted) onBotRescueStarted(updated);
  }, delay);
};

// Cancela manualmente um rescue pendente. Útil pra index.ts cancelar
// em cenários que o lobby não captura sozinho.
export const cancelPendingBotRescue = (room: ServerRoom): void => {
  cancelBotRescue(room);
};

/**
 * Após game over numa sala com bot+humano, com chance `BOT_REMATCH_CHANCE`
 * o bot agenda um pedido de revanche em 1.5-3.5s. Index.ts chama isso em
 * todos os caminhos de fim (vitória normal, W.O., bot vence). Idempotente:
 * se a sala já tem revanche pendente, ou se o bot ou humano saíram, no-op.
 */
export const maybeBotRequestRematch = (room: ServerRoom): void => {
  if (!io) return;
  const bot = room.players.find((p) => p.isBot);
  const human = room.players.find((p) => !p.isBot);
  if (!bot || !human) return;
  if (Math.random() > BOT_REMATCH_CHANCE) return;

  const delay = randomBetween(BOT_REMATCH_DELAY_MIN_MS, BOT_REMATCH_DELAY_MAX_MS);
  setTimeout(() => {
    if (!io) return;
    // Re-checa estado: pode ter mudado durante o delay (humano já pediu,
    // saiu, sala foi limpa, etc).
    const current = getAllRooms().get(room.code);
    if (!current) return;
    if (current.status !== "finished") return;
    if (current.rematch) return;
    if (!current.players.some((p) => p.isBot)) return;
    const humanNow = current.players.find((p) => !p.isBot);
    if (!humanNow) return;

    const pending = requestRematchAsBot(current, bot.name);
    if (!pending) return;
    io.to(humanNow.socketId).emit("rematchRequested", {
      fromName: pending.fromName,
      expiresAt: pending.expiresAt,
    });
    console.log(`[rematch] bot pediu em ${current.code} (${bot.name})`);
  }, delay);
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

  // Wait for countdown to finish before bot plays
  const countdownRemaining = room.countdownEndsAt
    ? Math.max(0, room.countdownEndsAt - Date.now())
    : 0;
  const delay = countdownRemaining + randomBetween(MOVE_DELAY_MIN_MS, MOVE_DELAY_MAX_MS);
  setTimeout(() => playBotMove(room, currentPlayer), delay);
};

// === Internals ===

// Remove salas que ficaram só com bot (o humano saiu ou caiu por W.O.).
// Sem isso elas viram "finished" e ficam pra sempre no mapa: o scan de spawn
// só olha salas "waiting", então nunca as limpa → vazamento de memória.
// Reusa scheduleBotLeave (que re-checa rematch/playing e remove após delay).
const reapOrphanedBotRooms = (): void => {
  for (const room of getAllRooms().values()) {
    if (room.status === "waiting") continue; // decoy aguardando humano — intencional
    if (room.players.length === 0) continue; // sala vazia: a lobby já deleta
    const hasHuman = room.players.some((p) => !p.isBot);
    if (!hasHuman) scheduleBotLeave(room);
  }
};

const scan = (): void => {
  reapOrphanedBotRooms();

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
  // Atribui dificuldade ao bot host (socketId interno).
  const botPlayer = room.players[0];
  if (botPlayer) {
    const difficulty = randomDifficulty();
    botDifficulties.set(botPlayer.socketId, difficulty);
    console.log(`[botManager] sala bot ${room.code} criada por ${name} (cor ${color}, dificuldade ${difficulty})`);
  }
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

  const difficulty = botDifficulties.get(bot.socketId) ?? "medium";
  const move = botMove(room.gameState, bot.enginePlayer, difficulty);
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
  // Mantém o relógio autoritativo coerente — debita o turno do bot e
  // reinicia pro humano (senão o reportTimeout do humano calcula errado).
  chargeTurnTime(room, bot.enginePlayer, Date.now());
  const wireState = serializeState(result.state);
  // Inclui o `move` pro client empilhar no replay (sem isso o oponente
  // humano não vê o lance do bot, só o state resultante).
  io.to(room.code).emit("stateUpdate", { state: wireState, move });

  if (result.state.winner !== null) {
    room.status = "finished";
    const payload: GameOverPayload = { winner: result.state.winner, reason: "goal" };
    io.to(room.code).emit("gameOver", payload);
    // Analytics: bot venceu (peão do bot chegou na linha de chegada).
    recordMatchFinish(room, result.state.winner, "goal");
    // Bot pode pedir revanche (chance pequena, delay 1.5-3.5s).
    maybeBotRequestRematch(room);
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

// Quando a partida termina, agenda a saída do bot pra a sala morrer e abrir
// espaço pro próximo spawn. O delay precisa cobrir TODA a janela de revanche
// (REMATCH_TIMEOUT_MS) — senão o bot sairia em 3-6s e o pedido de revanche do
// humano falharia ("revanche indisponível") na maioria das partidas. Ao fim do
// delay, se houver revanche pendente ou nova partida, o bot fica; senão sai.
const scheduledLeaves = new Set<string>();
const scheduleBotLeave = (room: ServerRoom): void => {
  if (scheduledLeaves.has(room.code)) return;
  scheduledLeaves.add(room.code);
  const delay =
    getRematchTimeoutMs() + randomBetween(LEAVE_DELAY_MIN_MS, LEAVE_DELAY_MAX_MS);
  setTimeout(() => {
    scheduledLeaves.delete(room.code);
    // Re-checa: se uma revanche está pendente ou já começou nova partida,
    // o bot precisa ficar na sala. Será re-agendado quando a próxima
    // partida acabar (via novo gameOver).
    const current = getAllRooms().get(room.code);
    if (current) {
      if (current.rematch) return;
      if (current.status === "playing") return;
    }
    // Limpa as dificuldades dos bots dessa sala pra não vazar memória.
    for (const p of room.players.filter((pl) => pl.isBot)) {
      botDifficulties.delete(p.socketId);
    }
    removeBotFromRoom(room.code);
    console.log(`[botManager] bot saiu da sala ${room.code}`);
  }, delay);
};
