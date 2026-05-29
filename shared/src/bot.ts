// === Bot do Barreira — 3 dificuldades ===
//
// Substitui o antigo sistema de "personalidades" fixas por 3 níveis simples:
// fácil, médio e difícil. Cada nível é STATELESS (recebe só o estado atual)
// e usa aleatoriedade POR JOGADA — então o bot varia de partida pra partida
// e dentro da mesma partida, sem nunca repetir a mesma sequência. Não há
// estilo fixo: a variação vem de sorteios a cada decisão, não de um perfil.
//
// Resumo do comportamento:
//   fácil  — avança em direção ao objetivo, mas erra ~30% das vezes (move
//            aleatório); usa parede raramente e mal escolhida; nunca usa a
//            última parede (sempre guarda reserva); nunca bloqueia bem.
//   médio  — avança consistente via pathfinding (nunca volta casas); ~40% das
//            jogadas tenta atrasar o humano com a melhor parede disponível;
//            guarda reserva (não gasta a última à toa).
//   difícil— minimax otimizado (ver minimaxOpponent.ts): equilibra avanço e
//            bloqueio, sempre competente, com variação entre jogadas de mesmo
//            valor.

import { BOARD_SIZE, goalRow, opponentOf } from "./board";
import { getValidMoves } from "./moves";
import type { GameState, Move, PlayerId, WallPlacement } from "./types";
import { minimaxOpponentMove } from "./minimaxOpponent";
import {
  allPossiblePlacements,
  canPlaceWall,
  neighbors,
  registerWall,
} from "./walls";

export type BotDifficulty = "easy" | "medium" | "hard";

const UNREACHABLE = 999;

const rowOf = (idx: number): number => Math.floor(idx / BOARD_SIZE);
const pieceOf = (state: GameState, id: PlayerId): number =>
  id === 1 ? state.p1 : state.p2;
const pickRandom = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

// BFS: menor número de passos de `from` até qualquer casa da linha-objetivo.
// UNREACHABLE se a parede trancou o caminho.
const shortestPathDistance = (
  state: GameState,
  from: number,
  targetRow: number,
): number => {
  if (rowOf(from) === targetRow) return 0;
  const visited = new Set<number>([from]);
  const queue: Array<[number, number]> = [[from, 0]];
  let head = 0;
  while (head < queue.length) {
    const [cur, dist] = queue[head++];
    for (const n of neighbors(state.walls, cur)) {
      if (visited.has(n)) continue;
      if (rowOf(n) === targetRow) return dist + 1;
      visited.add(n);
      queue.push([n, dist + 1]);
    }
  }
  return UNREACHABLE;
};

// === Peça ===

// Move(s) de peça que MINIMIZAM a própria distância ao objetivo. Sorteia entre
// empates — garante avanço (nunca volta casas) com variação natural.
const greedyPieceMove = (state: GameState, botId: PlayerId): Move | null => {
  const goal = goalRow(botId);
  const key = botId === 1 ? "p1" : "p2";
  const scored = getValidMoves(state, botId).map((to) => {
    const sim = { ...state, [key]: to } as GameState;
    return { to, dist: shortestPathDistance(sim, to, goal) };
  });
  if (scored.length === 0) return null;
  const best = Math.min(...scored.map((m) => m.dist));
  const ties = scored.filter((m) => m.dist === best);
  return { kind: "piece", to: pickRandom(ties).to };
};

// === Paredes ===

// Paredes legais que NÃO trancam o caminho de nenhum jogador.
const legalWalls = (state: GameState, botId: PlayerId): WallPlacement[] => {
  if (state.wallsLeft[botId] <= 0) return [];
  const out: WallPlacement[] = [];
  for (const placement of allPossiblePlacements()) {
    if (!canPlaceWall(state.walls, placement)) continue;
    const sim = { ...state, walls: registerWall(state.walls, placement) };
    if (shortestPathDistance(sim, state.p1, goalRow(1)) === UNREACHABLE) continue;
    if (shortestPathDistance(sim, state.p2, goalRow(2)) === UNREACHABLE) continue;
    out.push(placement);
  }
  return out;
};

// Melhor parede pra atrasar o humano: maximiza (ganho na distância do humano −
// penalidade na própria). Sorteia entre empates pra variar. Devolve também o
// ganho puro do humano pra o caller decidir se vale a pena.
const bestBlockingWall = (
  state: GameState,
  botId: PlayerId,
): { placement: WallPlacement; humanGain: number } | null => {
  const humanId = opponentOf(botId);
  const humanGoal = goalRow(humanId);
  const botGoal = goalRow(botId);
  const humanBase = shortestPathDistance(state, pieceOf(state, humanId), humanGoal);
  const botBase = shortestPathDistance(state, pieceOf(state, botId), botGoal);

  let bestNet = -Infinity;
  let pool: Array<{ placement: WallPlacement; humanGain: number }> = [];
  for (const placement of legalWalls(state, botId)) {
    const sim = { ...state, walls: registerWall(state.walls, placement) };
    const humanGain =
      shortestPathDistance(sim, pieceOf(state, humanId), humanGoal) - humanBase;
    const botPenalty =
      shortestPathDistance(sim, pieceOf(state, botId), botGoal) - botBase;
    const net = humanGain - botPenalty; // equilibra atrasar o humano vs. atrapalhar a si
    if (net > bestNet) {
      bestNet = net;
      pool = [{ placement, humanGain }];
    } else if (net === bestNet) {
      pool.push({ placement, humanGain });
    }
  }
  return pool.length > 0 ? pickRandom(pool) : null;
};

// Fallback: garante SEMPRE devolver uma jogada legal se existir alguma.
const anyMove = (state: GameState, botId: PlayerId): Move | null => {
  const piece = greedyPieceMove(state, botId);
  if (piece) return piece;
  const walls = legalWalls(state, botId);
  return walls.length > 0 ? { kind: "wall", placement: pickRandom(walls) } : null;
};

// === Níveis ===

// FÁCIL: avança com erros (~30% move aleatório). Parede rara (~12%), mal
// escolhida (aleatória) e SÓ com reserva (>= 2 na mão → nunca usa a última).
const easyMove = (state: GameState, botId: PlayerId): Move | null => {
  if (state.wallsLeft[botId] >= 2 && Math.random() < 0.12) {
    const walls = legalWalls(state, botId);
    if (walls.length > 0) return { kind: "wall", placement: pickRandom(walls) };
  }
  const pieceMoves = getValidMoves(state, botId);
  if (pieceMoves.length === 0) return anyMove(state, botId);
  if (Math.random() < 0.3) return { kind: "piece", to: pickRandom(pieceMoves) };
  return greedyPieceMove(state, botId) ?? anyMove(state, botId);
};

// MÉDIO: avança consistente (greedy, nunca volta casas). ~40% das jogadas
// tenta atrasar o humano com a MELHOR parede — mas só se ela de fato aumenta
// a distância dele (>= 1) e guardando reserva (não gasta a última à toa,
// exceto se o humano estiver a <= 2 do objetivo).
const mediumMove = (state: GameState, botId: PlayerId): Move | null => {
  const humanId = opponentOf(botId);
  const wallsLeft = state.wallsLeft[botId];
  const humanDist = shortestPathDistance(
    state,
    pieceOf(state, humanId),
    goalRow(humanId),
  );
  const mayUseLastWall = humanDist <= 2; // emergência: humano quase ganhando
  const canWall = wallsLeft > 0 && (wallsLeft > 1 || mayUseLastWall);

  if (canWall && Math.random() < 0.4) {
    const block = bestBlockingWall(state, botId);
    if (block && block.humanGain >= 1) {
      return { kind: "wall", placement: block.placement };
    }
  }
  return greedyPieceMove(state, botId) ?? anyMove(state, botId);
};

// DIFÍCIL: minimax otimizado (equilibra avanço e bloqueio, varia entre jogadas
// equivalentes). Ver minimaxOpponent.ts.
const hardMove = (state: GameState, botId: PlayerId): Move | null =>
  minimaxOpponentMove(state, botId) ?? anyMove(state, botId);

// Entrada única: escolhe a jogada do bot conforme a dificuldade.
export const botMove = (
  state: GameState,
  botId: PlayerId,
  difficulty: BotDifficulty,
): Move | null => {
  switch (difficulty) {
    case "hard":
      return hardMove(state, botId);
    case "medium":
      return mediumMove(state, botId);
    case "easy":
    default:
      return easyMove(state, botId);
  }
};
