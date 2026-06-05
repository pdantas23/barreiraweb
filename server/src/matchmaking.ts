// === Matchmaking (Partida Rápida) ===
//
// Fila única em memória. Quando um jogador entra:
//  - se já há outro REAL esperando (e não é a mesma conta) → casa os dois na
//    hora numa sala privada e avisa ambos (matchFound);
//  - senão entra na fila, recebe status a cada STATUS_INTERVAL_MS, e se ninguém
//    aparecer em MATCH_TIMEOUT_MS cai numa sala com bot.
//
// O módulo NÃO conhece io/lobby/botManager direto — recebe tudo via `init(deps)`
// (injeção). Isso mantém a fila testável de forma isolada e o acoplamento no
// index.ts, que já costura lobby + broadcastGameStart + botManager.

import type { MatchFoundPayload, MatchmakingStatusPayload } from "@barreira/shared";
import type { Platform } from "./lobby.js";
import { LobbyError } from "./lobby.js";

// Tempo na fila antes de cair no bot — SORTEADO por jogador entre min e max
// (não fixo, pra parecer orgânico). Configurável pra testes.
const MATCH_TIMEOUT_MIN_MS = Number(process.env.MM_TIMEOUT_MIN_MS ?? 12_000);
const MATCH_TIMEOUT_MAX_MS = Number(process.env.MM_TIMEOUT_MAX_MS ?? 20_000);
// Frequência do matchmakingStatus enquanto aguarda.
const STATUS_INTERVAL_MS = Number(process.env.MM_STATUS_MS ?? 2_000);

const pickTimeout = (): number =>
  Math.round(MATCH_TIMEOUT_MIN_MS + Math.random() * (MATCH_TIMEOUT_MAX_MS - MATCH_TIMEOUT_MIN_MS));

export type QueuedPlayer = {
  socketId: string;
  clientId: string | null;
  authUserId: string | null;
  name: string;
  platform: Platform | null;
  joinedAt: number;
};

// Resultado de criar uma sala humano-vs-humano (injetado pelo index.ts).
export type HumanMatchResult = { code: string; password: string | null } | null;
// Resultado de criar uma sala humano-vs-bot.
export type BotMatchResult = { code: string; botName: string } | null;

export type MatchmakingDeps = {
  // Cria a sala privada com os 2 humanos já dentro + dispara gameStart.
  createHumanMatch: (host: QueuedPlayer, guest: QueuedPlayer) => HumanMatchResult;
  // Cria a sala com o humano (host) + um bot guest + dispara gameStart.
  createBotMatch: (host: QueuedPlayer) => BotMatchResult;
  emitMatchFound: (socketId: string, payload: MatchFoundPayload) => void;
  emitStatus: (socketId: string, payload: MatchmakingStatusPayload) => void;
};

let deps: MatchmakingDeps | null = null;
export const initMatchmaking = (d: MatchmakingDeps): void => {
  deps = d;
};

// Fila FIFO + timers por socket. Cada entrada guarda o prazo sorteado até o
// bot (`estimatedMs`) pra mandar no status (contador regressivo do cliente).
const queue: QueuedPlayer[] = [];
type Timers = { status: NodeJS.Timeout; timeout: NodeJS.Timeout; estimatedMs: number };
const timers = new Map<string, Timers>();

const clearTimers = (socketId: string): void => {
  const t = timers.get(socketId);
  if (t) {
    clearInterval(t.status);
    clearTimeout(t.timeout);
    timers.delete(socketId);
  }
};

const removeFromQueue = (socketId: string): QueuedPlayer | null => {
  const idx = queue.findIndex((p) => p.socketId === socketId);
  if (idx === -1) return null;
  const [removed] = queue.splice(idx, 1);
  clearTimers(socketId);
  return removed ?? null;
};

// Mesma conta (ou mesmo aparelho/aba) não pode pegar os 2 lados. Anônimos
// (authUserId null) podem casar entre si; clientId null idem.
const isSamePlayer = (a: QueuedPlayer, b: QueuedPlayer): boolean =>
  a.socketId === b.socketId ||
  (a.clientId !== null && a.clientId === b.clientId) ||
  (a.authUserId !== null && a.authUserId === b.authUserId);

export const isInQueue = (socketId: string): boolean =>
  queue.some((p) => p.socketId === socketId);

export const queueSize = (): number => queue.length;

// Entra na fila. Lança LobbyError("already-in-queue") se já estiver (anti-spam).
export const joinMatchmaking = (player: QueuedPlayer): void => {
  if (!deps) throw new LobbyError("internal-error", "matchmaking não inicializado");

  // Anti-spam: socket, aparelho (clientId) ou conta (authUserId) já na fila.
  if (queue.some((p) => isSamePlayer(p, player))) {
    throw new LobbyError("already-in-queue");
  }

  // Há um oponente real compatível esperando? Casa na hora.
  const opponent = queue.find((p) => !isSamePlayer(p, player));
  if (opponent) {
    removeFromQueue(opponent.socketId);
    const result = deps.createHumanMatch(opponent, player);
    if (result) {
      deps.emitMatchFound(opponent.socketId, {
        roomCode: result.code,
        opponentName: player.name,
        password: null, // host já está dentro
        isBot: false,
      });
      deps.emitMatchFound(player.socketId, {
        roomCode: result.code,
        opponentName: opponent.name,
        password: result.password,
        isBot: false,
      });
      return;
    }
    // Falhou criar a sala (ex.: oponente caiu nesse meio-tempo) — re-enfileira
    // o oponente e segue pra colocar o novo player na fila normalmente.
    enqueue(opponent);
  }

  enqueue(player);
};

// Coloca na fila + agenda status periódico e o fallback do bot.
const enqueue = (player: QueuedPlayer): void => {
  queue.push(player);
  const estimatedMs = pickTimeout();
  const status = setInterval(() => emitStatusFor(player), STATUS_INTERVAL_MS);
  const timeout = setTimeout(() => onTimeout(player.socketId), estimatedMs);
  timers.set(player.socketId, { status, timeout, estimatedMs });
  emitStatusFor(player); // status inicial imediato (cliente já recebe o estimatedMs)
};

const emitStatusFor = (player: QueuedPlayer): void => {
  if (!deps) return;
  const position = queue.findIndex((p) => p.socketId === player.socketId) + 1;
  if (position === 0) return; // já saiu da fila
  deps.emitStatus(player.socketId, {
    waitTime: Date.now() - player.joinedAt,
    position,
    estimatedMs: timers.get(player.socketId)?.estimatedMs ?? MATCH_TIMEOUT_MAX_MS,
  });
};

// 15s sem par → cai no bot.
const onTimeout = (socketId: string): void => {
  if (!deps) return;
  const player = removeFromQueue(socketId);
  if (!player) return;
  const result = deps.createBotMatch(player);
  if (!result) return; // sala não pôde ser criada — desiste silenciosamente
  deps.emitMatchFound(socketId, {
    roomCode: result.code,
    opponentName: result.botName,
    password: null, // humano é o host
    isBot: true,
  });
};

// Cancela a busca (botão Cancelar ou desconexão). Idempotente.
export const leaveMatchmaking = (socketId: string): boolean => {
  return removeFromQueue(socketId) !== null;
};

// Pra testes: limpa fila e timers.
export const _resetMatchmaking = (): void => {
  for (const sid of [...timers.keys()]) clearTimers(sid);
  queue.length = 0;
};

// Maior prazo possível — usado nos testes pra avançar timers com folga.
export const getMatchTimeoutMs = (): number => MATCH_TIMEOUT_MAX_MS;
